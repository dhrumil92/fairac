// =============================================================================
// src/middleware/auth.js
// JWT Authentication & Role Authorization Middleware
// =============================================================================
//
// WHY JWT?
//   HTTP is stateless — the server doesn't remember who you are between
//   requests. JWTs solve this by having the client send a signed token with
//   every request. The server verifies the signature (not a DB lookup) to
//   confirm identity. Fast, scalable, and no server-side sessions needed.
//
// TOKEN FORMAT:
//   The client must send the token in the Authorization header:
//   Authorization: Bearer <token>
//
// WHAT IS IN THE TOKEN PAYLOAD?
//   { u_id, email, role, hostel_id, iat, exp }
//
// =============================================================================

const jwt = require('jsonwebtoken');
const { createError } = require('./errorHandler');

// ─── authenticate ──────────────────────────────────────────────────────────
// Verifies the JWT token and attaches the decoded user to req.user.
// Use this on any route that requires a logged-in user.
//
// USAGE:
//   router.get('/wallet', authenticate, walletController.getWallet);
//
const authenticate = (req, res, next) => {
  try {
    // Step 1: Extract token from Authorization header
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError(401, 'Access denied. No token provided.');
    }

    const token = authHeader.split(' ')[1]; // Get the part after "Bearer "

    // Step 2: Verify signature and decode payload
    // If the token is expired or signature is invalid, jwt.verify throws.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Step 3: Attach decoded user info to request object
    // Now any subsequent middleware or controller can access req.user
    req.user = decoded;

    next(); // Proceed to the route handler
  } catch (err) {
    // jwt.verify throws specific errors we should handle cleanly
    if (err.name === 'TokenExpiredError') {
      return next(createError(401, 'Token expired. Please log in again.'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(createError(401, 'Invalid token.'));
    }
    next(err);
  }
};

// ─── authorizeRoles ────────────────────────────────────────────────────────
// Authorization middleware — checks if the authenticated user has
// one of the required roles.
//
// WHY SEPARATE FROM authenticate?
//   Separation of concerns. Authentication = "who are you?".
//   Authorization = "are you allowed to do this?".
//   Different routes need different role requirements.
//
// USAGE:
//   // Only admins:
//   router.post('/recharge', authenticate, authorizeRoles('admin'), controller);
//
//   // Both students and admins:
//   router.get('/rooms', authenticate, authorizeRoles('student', 'admin'), controller);
//
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    // req.user is set by authenticate middleware (must run first)
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        createError(403, `Access denied. Required role: ${roles.join(' or ')}.`)
      );
    }
    next();
  };
};

module.exports = { authenticate, authorizeRoles };
