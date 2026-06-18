// =============================================================================
// src/modules/auth/auth.service.js
// Authentication Business Logic
// =============================================================================
//
// This file contains PURE business logic — no HTTP, no req/res objects.
// Every function takes plain data, does its job, and returns plain data or
// throws an error.
//
// WHY NO req/res HERE?
//   If we mixed HTTP concerns into the service, we couldn't test the business
//   logic without spinning up an HTTP server. Services are meant to be
//   framework-agnostic — they work the same whether called from an Express
//   route, a CLI script, or a test file.
//
// =============================================================================

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../../config/db');
const { createError } = require('../../middleware/errorHandler');

// ─── generateToken ─────────────────────────────────────────────────────────
// Creates a signed JWT token for a given user.
//
// PAYLOAD includes:
//   u_id      — User's database ID (used to fetch user in subsequent requests)
//   email     — Convenient for display without a DB lookup
//   role      — 'student' or 'admin' (controls route access)
//   hostel_id — Admins need this to scope their queries to their hostel only
//
// The token is signed with JWT_SECRET from .env.
// If anyone tampers with the payload, jwt.verify() will reject it.
//
// EXPIRY: Set in JWT_EXPIRES_IN (.env). Default: '7d' (7 days).
// After expiry, the user must log in again to get a new token.
//
const generateToken = (user) => {
  const payload = {
    u_id:      user.u_id,
    email:     user.email,
    role:      user.role,
    hostel_id: user.hostel_id,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// =============================================================================
// registerStudent
// =============================================================================
// Registers a new student account.
//
// STEPS:
//   1. Check if email already exists → reject with 409 (Conflict)
//   2. Check if mobile already exists → reject with 409
//   3. Hash the password (bcrypt, cost factor from .env)
//   4. Open a DB transaction:
//      a. INSERT into users
//      b. INSERT into wallets (every student gets a wallet on registration)
//      c. COMMIT
//   5. Generate and return JWT
//
// WHY A TRANSACTION FOR STEPS 4a + 4b?
//   If the INSERT into users succeeds but INSERT into wallets fails (e.g. DB
//   crash), we'd have a user with no wallet — a broken state. The transaction
//   ensures BOTH succeed or NEITHER happens. Atomicity is the 'A' in ACID.
//
// WHY HASH BEFORE THE TRANSACTION?
//   bcrypt is CPU-intensive (intentionally slow). Running it inside a DB
//   transaction would hold the DB client longer than needed. We hash first,
//   then open the transaction — keeps the transaction short and fast.
//
const registerStudent = async ({ name, email, mobile, password }) => {
  // ── Step 1 & 2: Uniqueness checks ────────────────────────────────────────
  // We run a single query that checks both email and mobile at once.
  // More efficient than two separate queries.
  const existingUser = await db.query(
    `SELECT u_id, email, mobile FROM users WHERE email = $1 OR mobile = $2 LIMIT 1`,
    [email.toLowerCase(), mobile]
  );

  if (existingUser.rows.length > 0) {
    const existing = existingUser.rows[0];
    if (existing.email === email.toLowerCase()) {
      throw createError(409, 'An account with this email already exists.');
    }
    throw createError(409, 'An account with this mobile number already exists.');
  }

  // ── Step 3: Hash password ─────────────────────────────────────────────────
  // bcrypt.hash() is async and intentionally slow (cost factor = 10 rounds).
  // This makes brute-force attacks computationally expensive.
  // NEVER store plaintext passwords.
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // ── Step 4: Transaction — insert user + wallet ────────────────────────────
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Insert the new student
    const userResult = await client.query(
      `INSERT INTO users (name, email, mobile, password_hash, role)
       VALUES ($1, $2, $3, $4, 'student')
       RETURNING u_id, name, email, mobile, role, hostel_id, created_at`,
      [name.trim(), email.toLowerCase(), mobile, passwordHash]
    );

    const newUser = userResult.rows[0];

    // Immediately create a wallet for this user (balance starts at ₹0)
    await client.query(
      `INSERT INTO wallets (u_id, balance) VALUES ($1, 0.00)`,
      [newUser.u_id]
    );

    await client.query('COMMIT');

    // ── Step 5: Generate and return token ────────────────────────────────────
    const token = generateToken(newUser);

    return {
      user: {
        u_id:       newUser.u_id,
        name:       newUser.name,
        email:      newUser.email,
        mobile:     newUser.mobile,
        role:       newUser.role,
        created_at: newUser.created_at,
      },
      token,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    // Re-throw so the controller's catch block handles it
    throw err;
  } finally {
    // ALWAYS release client back to pool — even if an error occurred
    client.release();
  }
};

// =============================================================================
// loginUser
// =============================================================================
// Authenticates a user (student OR admin — same endpoint).
//
// STEPS:
//   1. Find user by email OR mobile (users can log in with either)
//   2. If not found → 401 (don't reveal "email not found" — security)
//   3. Check is_active flag → 403 if suspended
//   4. Compare provided password against stored bcrypt hash
//   5. If mismatch → 401 (don't reveal "wrong password" separately — security)
//   6. Generate and return JWT
//
// WHY SAME 401 MESSAGE FOR "user not found" AND "wrong password"?
//   Giving different messages for each case is a security vulnerability called
//   "user enumeration". An attacker could figure out which emails are registered
//   by checking which error they get. Always use a generic message: "Invalid
//   credentials."
//
const loginUser = async ({ identifier, password }) => {
  // ── Step 1: Find user by email OR mobile ─────────────────────────────────
  // `identifier` is whatever the user typed — could be email or mobile number.
  // We check both columns in one query.
  const userResult = await db.query(
    `SELECT u_id, name, email, mobile, password_hash, role, hostel_id, is_active
     FROM users
     WHERE email = $1 OR mobile = $1
     LIMIT 1`,
    [identifier.toLowerCase()]
  );

  // ── Step 2: User not found ────────────────────────────────────────────────
  if (userResult.rows.length === 0) {
    throw createError(401, 'Invalid email/mobile or password.');
  }

  const user = userResult.rows[0];

  // ── Step 3: Suspended account check ──────────────────────────────────────
  if (!user.is_active) {
    throw createError(403, 'Your account has been suspended. Please contact the admin.');
  }

  // ── Step 4 & 5: Compare password ──────────────────────────────────────────
  // bcrypt.compare() hashes the provided password with the SAME salt that was
  // used to hash the stored password, then compares them.
  // This is a constant-time operation — resistant to timing attacks.
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    throw createError(401, 'Invalid email/mobile or password.');
  }

  // ── Step 6: Generate token ────────────────────────────────────────────────
  const token = generateToken(user);

  return {
    user: {
      u_id:      user.u_id,
      name:      user.name,
      email:     user.email,
      mobile:    user.mobile,
      role:      user.role,
      hostel_id: user.hostel_id,
    },
    token,
  };
};

// =============================================================================
// getMe
// =============================================================================
// Returns the current logged-in user's profile.
// Used by the frontend to restore session state on page refresh.
//
// We look up fresh data from DB (not just JWT payload) to ensure
// suspended accounts are caught even with a valid token.
//
const getMe = async (u_id) => {
  const result = await db.query(
    `SELECT u_id, name, email, mobile, role, hostel_id, is_active, created_at
     FROM users WHERE u_id = $1`,
    [u_id]
  );

  if (result.rows.length === 0) {
    throw createError(404, 'User not found.');
  }

  const user = result.rows[0];

  if (!user.is_active) {
    throw createError(403, 'Your account has been suspended.');
  }

  return user;
};

// =============================================================================
// updateProfile
// =============================================================================
const updateProfile = async (u_id, { name, email, mobile }) => {
  // Check if new email/mobile is taken by someone else
  const existingUser = await db.query(
    `SELECT u_id FROM users WHERE (email = $1 OR mobile = $2) AND u_id != $3 LIMIT 1`,
    [email.toLowerCase(), mobile, u_id]
  );

  if (existingUser.rows.length > 0) {
    throw createError(409, 'Email or mobile number is already in use by another account.');
  }

  const result = await db.query(
    `UPDATE users 
     SET name = $1, email = $2, mobile = $3 
     WHERE u_id = $4 
     RETURNING u_id, name, email, mobile, role, hostel_id, created_at`,
    [name.trim(), email.toLowerCase(), mobile, u_id]
  );

  if (result.rows.length === 0) {
    throw createError(404, 'User not found.');
  }

  return {
    user: result.rows[0],
    message: 'Profile updated successfully.'
  };
};

module.exports = {
  registerStudent,
  loginUser,
  getMe,
  updateProfile,
};
