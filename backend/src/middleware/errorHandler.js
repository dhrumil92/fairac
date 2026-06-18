// =============================================================================
// src/middleware/errorHandler.js
// Global Error Handling Middleware
// =============================================================================
//
// WHY A GLOBAL ERROR HANDLER?
//   Without this, if any route throws an error, Express sends back an ugly
//   HTML page with a stack trace — exposing internal details to the client.
//
//   With this, ALL errors flow through one place. We:
//   1. Log the full error on the server (for debugging)
//   2. Send a clean, consistent JSON response to the client
//   3. Never leak stack traces to the client in production
//
// HOW IT WORKS:
//   In Express, a middleware with 4 parameters (err, req, res, next) is
//   automatically treated as an ERROR handler. It only activates when
//   next(err) is called or when an async error is uncaught.
//
// HOW TO USE IN ROUTES:
//   try {
//     // ... some logic
//   } catch (err) {
//     next(err); // passes to this handler
//   }
//
// =============================================================================

const errorHandler = (err, req, res, next) => {
  // Log the full error internally (visible only on server logs)
  console.error(`❌ [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.error(err.stack || err.message);

  // Determine the HTTP status code
  // If the error object has a `statusCode` property (set by us), use it.
  // Otherwise default to 500 (Internal Server Error)
  const statusCode = err.statusCode || 500;

  // Build a clean error response
  const response = {
    success: false,
    message: err.message || 'Internal server error',
  };

  // In development, also send the stack trace for easier debugging
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

// =============================================================================
// createError — Custom Error Factory
// =============================================================================
// A utility to create errors with a specific HTTP status code.
//
// USAGE:
//   throw createError(404, 'User not found');
//   throw createError(401, 'Invalid credentials');
//   throw createError(400, 'Email already in use');
//
const createError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

module.exports = { errorHandler, createError };
