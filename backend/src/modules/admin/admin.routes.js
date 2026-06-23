// =============================================================================
// src/modules/admin/admin.routes.js
// Admin Routes & Validation
// =============================================================================

const express    = require('express');
const { body }   = require('express-validator');
const controller = require('./admin.controller');
const { authenticate, authorizeRoles } = require('../../middleware/auth');

const router = express.Router();

// All admin routes: must be logged in AND have 'admin' role
// authorizeRoles sends 403 automatically if role doesn't match
router.use(authenticate);
router.use(authorizeRoles('admin'));

// ─── Validation Rules ─────────────────────────────────────────────────────

const walletActionValidation = [
  body('student_identifier')
    .trim()
    .notEmpty()
    .withMessage('student_identifier (email or mobile) is required.'),

  body('amount')
    .notEmpty().withMessage('amount is required.')
    .isFloat({ min: 0.01 }).withMessage('amount must be greater than ₹0.'),
];

const deductValidation = [
  ...walletActionValidation,
  body('note')
    .trim()
    .notEmpty()
    .withMessage('A reason/note is mandatory for deductions.'),
];

const removeMemberValidation = [
  body('u_id')
    .notEmpty().withMessage('User ID is required.')
    .isInt({ min: 1 }).withMessage('User ID must be a positive integer.'),
];

const inviteValidation = [
  body('student_identifier')
    .trim()
    .notEmpty()
    .withMessage('Student identifier (email or mobile) is required.'),
];

// ─── Routes ───────────────────────────────────────────────────────────────

// GET /api/v1/admin/dashboard — overview stats
router.get('/dashboard', controller.getDashboard);

// GET /api/v1/admin/students — list students (?search=)
router.get('/students', controller.getStudents);

// GET /api/v1/admin/rooms — list rooms
router.get('/rooms', controller.getRooms);

// GET /api/v1/admin/sessions/active — active sessions across hostel
router.get('/sessions/active', controller.getActiveSessions);

// GET /api/v1/admin/reports — monthly reports (?month=6&year=2026)
router.get('/reports', controller.getReports);

// GET /api/v1/admin/transactions — all hostel transactions
router.get('/transactions', controller.getTransactions);

// POST /api/v1/admin/recharge — recharge a student's wallet
router.post('/recharge', walletActionValidation, controller.rechargeWallet);

// POST /api/v1/admin/deduct — manual deduction (note required)
router.post('/deduct', deductValidation, controller.deductWallet);

// GET /api/v1/admin/rooms/:id — get room details
router.get('/rooms/:id', controller.getRoomDetails);

// PATCH /api/v1/admin/rooms/:id/remove-member — remove a member from a room
router.patch('/rooms/:id/remove-member', removeMemberValidation, controller.removeMemberFromRoom);

// POST /api/v1/admin/rooms/:id/invite — invite a student to a room
router.post('/rooms/:id/invite', inviteValidation, controller.inviteStudentToRoom);

module.exports = router;
