// =============================================================================
// src/modules/auth/auth.routes.js
// Authentication Routes & Input Validation
// =============================================================================
//
// This file is responsible for:
//   1. Defining the URL paths and HTTP methods
//   2. Declaring input validation rules (express-validator)
//   3. Connecting routes to controller functions
//
// WHY EXPRESS-VALIDATOR HERE (not in controller or service)?
//   Validation is an HTTP-layer concern — it deals with the shape of the
//   request. Routes are the first thing that sees the request, so they are
//   the right place to declare what the request MUST look like. Controllers
//   just check if validation passed.
//
// HOW EXPRESS-VALIDATOR WORKS:
//   Each check() call creates a middleware that validates one field.
//   The results accumulate in req. Then in the controller, validationResult(req)
//   retrieves all the errors found.
//
// =============================================================================

const express    = require('express');
const { body }   = require('express-validator');
const controller = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

// ─── Validation Rule Sets ──────────────────────────────────────────────────
// Declaring these as constants keeps the route definitions clean and readable.
// They can also be reused across multiple routes if needed.

const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters.'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Must be a valid email address.')
    .normalizeEmail(), // lowercases, removes dots in gmail, etc.

  body('mobile')
    .trim()
    .notEmpty()
    .withMessage('Mobile number is required.')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Must be a valid 10-digit Indian mobile number (starts with 6-9).'),

  body('password')
    .notEmpty()
    .withMessage('Password is required.')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters.')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter.')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number.'),
];

const updateProfileValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters.'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Must be a valid email address.')
    .normalizeEmail(),

  body('mobile')
    .trim()
    .notEmpty()
    .withMessage('Mobile number is required.')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Must be a valid 10-digit Indian mobile number (starts with 6-9).'),
];

const loginValidation = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('Email or mobile number is required.'),

  body('password')
    .notEmpty()
    .withMessage('Password is required.'),
];

// ─── Routes ───────────────────────────────────────────────────────────────

// POST /api/v1/auth/register
// Public route — no token needed
// Validation runs before the controller
router.post('/register', registerValidation, controller.register);

// POST /api/v1/auth/login
// Public route — no token needed (this is where you GET the token)
router.post('/login', loginValidation, controller.login);

// GET /api/v1/auth/me
// Protected route — authenticate middleware verifies JWT first
// If token is missing/invalid, authenticate sends 401 before controller runs
router.get('/me', authenticate, controller.getMe);

// PUT /api/v1/auth/profile
// Protected route — updates the user's profile details
router.put('/profile', authenticate, updateProfileValidation, controller.updateProfile);

module.exports = router;
