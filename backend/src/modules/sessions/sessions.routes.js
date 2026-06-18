// =============================================================================
// src/modules/sessions/sessions.routes.js
// Session Routes & Validation
// =============================================================================
//
// CRITICAL ROUTE ORDER (same principle as rooms.routes.js):
//   Static paths (/active, /my, /participants/*) MUST come before /:id
//   to prevent Express from treating them as id parameters.
//
// =============================================================================

const express        = require('express');
const { body }       = require('express-validator');
const controller     = require('./sessions.controller');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

// All session routes require authentication
router.use(authenticate);

// ─── Validation Rules ─────────────────────────────────────────────────────

const startSessionValidation = [
  body('r_id')
    .notEmpty().withMessage('r_id (room ID) is required.')
    .isInt({ min: 1 }).withMessage('r_id must be a positive integer.'),

  body('session_type')
    .optional()
    .isIn(['unlimited', 'duration', 'unit', 'budget'])
    .withMessage('session_type must be: unlimited, duration, unit, or budget.'),

  body('target_value')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('target_value must be a positive number.'),

  body('participant_ids')
    .optional()
    .isArray()
    .withMessage('participant_ids must be an array of user IDs.'),
];

const endSessionValidation = [
  body('total_units')
    .notEmpty().withMessage('total_units (kWh consumed) is required.')
    .isFloat({ min: 0 }).withMessage('total_units must be 0 or greater.'),
];

const participantActionValidation = [
  body('session_id')
    .notEmpty().withMessage('session_id is required.')
    .isInt({ min: 1 }).withMessage('session_id must be a positive integer.'),
];

const approveLeaveValidation = [
  body('session_id')
    .notEmpty().withMessage('session_id is required.')
    .isInt({ min: 1 }).withMessage('session_id must be a positive integer.'),
  body('leaving_u_id')
    .notEmpty().withMessage('leaving_u_id is required.')
    .isInt({ min: 1 }).withMessage('leaving_u_id must be a positive integer.'),
];

const inviteValidation = [
  body('session_id')
    .notEmpty().withMessage('session_id is required.')
    .isInt({ min: 1 }).withMessage('session_id must be a positive integer.'),

  body('invitee_id')
    .notEmpty().withMessage('invitee_id is required.')
    .isInt({ min: 1 }).withMessage('invitee_id must be a positive integer.'),
];

// ─── Routes ───────────────────────────────────────────────────────────────

// Static routes first — before any /:id routes

// GET /api/v1/sessions/active — get active session in my room
router.get('/active', controller.getActiveSession);

// GET /api/v1/sessions/my — my session history
router.get('/my', controller.getMySessionHistory);

// POST /api/v1/sessions/start — start a new session
router.post('/start', startSessionValidation, controller.startSession);

// POST /api/v1/sessions/participants/invite
router.post('/participants/invite', inviteValidation, controller.inviteParticipant);

// POST /api/v1/sessions/participants/accept
router.post('/participants/accept', participantActionValidation, controller.acceptSessionInvite);

// POST /api/v1/sessions/participants/reject
router.post('/participants/reject', participantActionValidation, controller.rejectSessionInvite);

// POST /api/v1/sessions/participants/leave
router.post('/participants/leave', participantActionValidation, controller.leaveSession);

// POST /api/v1/sessions/participants/leave/approve
router.post('/participants/leave/approve', approveLeaveValidation, controller.approveLeaveSession);

// Dynamic routes after static ones

// GET /api/v1/sessions/:id — get specific session details
router.get('/:id', controller.getSessionById);

// POST /api/v1/sessions/:id/end — end session and run billing
router.post('/:id/end', endSessionValidation, controller.endSession);

// POST /api/v1/sessions/:id/join — join a running session
router.post('/:id/join', controller.joinSession);

module.exports = router;
