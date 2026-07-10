// =============================================================================
// src/modules/auth/auth.controller.js
// Authentication HTTP Controller
// =============================================================================
//
// Controllers are the bridge between HTTP and business logic.
// They are responsible for:
//   1. Reading data from req (body, params, query, user)
//   2. Calling the appropriate service function
//   3. Sending the HTTP response
//   4. Calling next(err) if anything goes wrong
//
// Controllers do NOT contain business logic, DB queries, or validation rules.
// Those belong in service.js and routes.js respectively.
//
// =============================================================================

const { validationResult } = require('express-validator');
const authService = require('./auth.service');

// ─── handleValidationErrors ────────────────────────────────────────────────
// A helper used at the top of every controller function.
// If express-validator found any errors, this sends a 400 response immediately
// and returns true (so we know to stop processing).
//
// EXAMPLE ERROR RESPONSE:
// {
//   "success": false,
//   "message": "Validation failed",
//   "errors": [
//     { "field": "email", "message": "Must be a valid email address" },
//     { "field": "password", "message": "Must be at least 8 characters" }
//   ]
// }
//
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({
        field:   e.path,
        message: e.msg,
      })),
    });
    return true; // signal: stop processing
  }
  return false; // no errors, continue
};

// =============================================================================
// register
// POST /api/v1/auth/register
// =============================================================================
// Registers a new student.
//
// Request Body:
//   { name, email, mobile, password }
//
// Success Response (201 Created):
//   { success: true, message, data: { user, token } }
//
const register = async (req, res, next) => {
  try {
    // Step 1: Check validation results from routes.js
    if (handleValidationErrors(req, res)) return;

    // Step 2: Extract validated data from request body
    const { name, email, mobile, password, secret_code } = req.body;

    // Step 3: Call service (all business logic lives there)
    const result = await authService.registerStudent({ name, email, mobile, password, secret_code });

    // Step 4: Send success response
    // 201 = "Created" — more accurate than 200 when a new resource is created
    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: result,
    });
  } catch (err) {
    // Pass to global error handler (errorHandler.js)
    next(err);
  }
};

// =============================================================================
// login
// POST /api/v1/auth/login
// =============================================================================
// Logs in a student or admin (same endpoint — role determined by DB lookup).
//
// Request Body:
//   { identifier, password }
//   identifier = email OR mobile number
//
// Success Response (200 OK):
//   { success: true, message, data: { user, token } }
//
const login = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const { identifier, password } = req.body;

    const result = await authService.loginUser({ identifier, password });

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

// =============================================================================
// getMe
// GET /api/v1/auth/me
// =============================================================================
// Returns the currently authenticated user's profile.
// Protected route — requires a valid JWT (authenticate middleware runs first).
//
// req.user is set by the authenticate middleware in auth.js
//
// Success Response (200 OK):
//   { success: true, data: { user } }
//
const getMe = async (req, res, next) => {
  try {
    // req.user.u_id is decoded from the JWT by authenticate middleware
    const user = await authService.getMe(req.user.u_id);

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { name, email, mobile } = req.body;
    const result = await authService.updateProfile(req.user.u_id, { name, email, mobile });

    res.json({
      status: 'success',
      message: result.message,
      data: { user: result.user },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// leaveHostel
// =============================================================================
const leaveHostel = async (req, res, next) => {
  try {
    const user = await authService.leaveHostel(req.user.u_id);
    res.status(200).json({
      success: true,
      message: 'You have left the hostel successfully.',
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

// =============================================================================
// joinHostel
// =============================================================================
const joinHostel = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const { secret_code } = req.body;
    const { user, token } = await authService.joinHostel(req.user.u_id, secret_code);
    
    res.status(200).json({
      success: true,
      message: 'Joined hostel successfully.',
      data: { user, token },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  leaveHostel,
  joinHostel
};

// =============================================================================
// changePassword
// =============================================================================
const changePassword = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user.u_id, currentPassword, newPassword);
    res.status(200).json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (err) {
    next(err);
  }
};

// =============================================================================
// updatePushToken
// =============================================================================
const updatePushToken = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const { pushToken } = req.body;
    await authService.updatePushToken(req.user.u_id, pushToken);
    res.status(200).json({
      success: true,
      message: 'Push token updated successfully.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports.changePassword = changePassword;
module.exports.updatePushToken = updatePushToken;
