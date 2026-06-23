// =============================================================================
// src/modules/rooms/rooms.routes.js
// Room Management Routes & Validation
// =============================================================================
//
// ROUTE ORDER IS CRITICAL IN EXPRESS.
// Express matches routes in the order they are defined.
// '/invite/accept' MUST be defined BEFORE '/invite' — otherwise Express would
// try to match 'accept' as an :id parameter.
//
// Similarly, '/my' and '/invitations' MUST come BEFORE '/:id'
// to avoid being captured as dynamic parameters.
//
// =============================================================================

const express    = require('express');
const { body, param } = require('express-validator');
const controller = require('./rooms.controller');
const { authenticate, authorizeRoles } = require('../../middleware/auth');

const router = express.Router();

// ─── Validation Rules ─────────────────────────────────────────────────────

const createRoomValidation = [
  body('hostel_code')
    .notEmpty().withMessage('Hostel Code is required.')
    .isString().withMessage('Hostel Code must be a string.'),

  body('room_no')
    .trim()
    .notEmpty().withMessage('Room number is required.')
    .isLength({ max: 20 }).withMessage('Room number must not exceed 20 characters.'),

  body('capacity')
    .optional()
    .isInt({ min: 1, max: 20 }).withMessage('Capacity must be between 1 and 20.'),

  body('rate_per_unit')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('Rate per unit must be greater than 0.'),
];

const inviteValidation = [
  body('room_id')
    .notEmpty().withMessage('room_id is required.')
    .isInt({ min: 1 }).withMessage('room_id must be a positive integer.'),

  body('identifier')
    .trim()
    .notEmpty().withMessage('Email or mobile number of the invitee is required.'),
];

const invitationActionValidation = [
  body('invitation_id')
    .notEmpty().withMessage('invitation_id is required.')
    .isInt({ min: 1 }).withMessage('invitation_id must be a positive integer.'),
];

// ─── Routes ───────────────────────────────────────────────────────────────

// NOTE: /my and /invitations defined BEFORE /:id to avoid route collision

// GET /api/v1/rooms/my — get my current room
router.get('/my', authenticate, controller.getMyRoom);

// GET /api/v1/rooms/invitations — get my pending invitations
router.get('/invitations', authenticate, controller.getMyInvitations);

// POST /api/v1/rooms — create a new room (students only)
router.post(
  '/',
  authenticate,
  authorizeRoles('student', 'admin'),
  createRoomValidation,
  controller.createRoom
);

// POST /api/v1/rooms/invite — invite a roommate (owner only; enforced in service)
router.post(
  '/invite',
  authenticate,
  inviteValidation,
  controller.inviteRoommate
);

// POST /api/v1/rooms/invite/accept — accept an invitation
router.post(
  '/invite/accept',
  authenticate,
  invitationActionValidation,
  controller.acceptInvitation
);

// POST /api/v1/rooms/invite/reject — reject an invitation
router.post(
  '/invite/reject',
  authenticate,
  invitationActionValidation,
  controller.rejectInvitation
);

// PATCH /api/v1/rooms/:id/leave — leave a room
router.patch('/:id/leave', authenticate, controller.leaveRoom);

module.exports = router;
