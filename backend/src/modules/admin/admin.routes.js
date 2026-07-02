// =============================================================================
// src/modules/admin/admin.routes.js
// Admin Routes & Validation
// =============================================================================

const express    = require('express');
const { body }   = require('express-validator');
const controller = require('./admin.controller');
const { authenticate, authorizeRoles } = require('../../middleware/auth');

const router = express.Router();

// All admin routes: must be logged in
router.use(authenticate);





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

// POST /api/v1/admin/recharge — recharge a student's wallet (Super Admin ONLY)
// Note: Since this route is defined before the next routes, but we want it
// to use the full walletActionValidation, we just define it here.
// Wait, actually I will move the `/recharge` route definition to the main routes section
// and use `authorizeRoles('super_admin')` inline.

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

const createRoomValidation = [
  body('room_no').trim().notEmpty().withMessage('Room number is required.'),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1.'),
];

const toggleRoomValidation = [
  body('is_active').isBoolean().withMessage('is_active must be a boolean.'),
];

// ─── Routes ───────────────────────────────────────────────────────────────

// ─── Regular Admin Routes (Also accessible by Super Admin) ────────────────
router.use(authorizeRoles('admin', 'super_admin'));

// GET /api/v1/admin/dashboard — overview stats
router.get('/dashboard', controller.getDashboard);

// GET /api/v1/admin/hostels — list all hostels (Super Admin ONLY)
router.get('/hostels', authorizeRoles('super_admin'), controller.getHostels);

// POST /api/v1/admin/hostels — create new hostel (Super Admin ONLY)
router.post('/hostels', authorizeRoles('super_admin'), controller.addHostel);

// GET /api/v1/admin/hostels/:id — get a specific hostel details (Super Admin ONLY)
router.get('/hostels/:id', authorizeRoles('super_admin'), controller.getHostelDetails);

// PUT /api/v1/admin/hostels/:id — update hostel details (Super Admin ONLY)
router.put('/hostels/:id', authorizeRoles('super_admin'), controller.updateHostel);

// PUT /api/v1/admin/hostels/:id/admin — update admin details for a hostel (Super Admin ONLY)
router.put('/hostels/:id/admin', authorizeRoles('super_admin'), controller.updateHostelAdmin);

// POST /api/v1/admin/hostels/:id/toggle-status — deactivate/activate hostel (Super Admin ONLY)
router.post('/hostels/:id/toggle-status', authorizeRoles('super_admin'), controller.toggleHostelStatus);

// GET /api/v1/admin/students — list students (?search=)
router.get('/students', controller.getStudents);

// PUT /api/v1/admin/students/:id/status — toggle student status
router.put('/students/:id/status', controller.toggleStudentStatus);

// POST /api/v1/admin/rooms/bulk-toggle — activate or deactivate ALL rooms
router.post('/rooms/bulk-toggle', toggleRoomValidation, controller.bulkToggleRooms);

// GET /api/v1/admin/rooms — list rooms
router.get('/rooms', controller.getRooms);

// POST /api/v1/admin/rooms — create new room
router.post('/rooms', createRoomValidation, controller.createRoom);


// POST /api/v1/admin/rooms/:id/toggle-status — activate/deactivate room
router.post('/rooms/:id/toggle-status', toggleRoomValidation, controller.toggleRoomStatus);

// GET /api/v1/admin/sessions/active — active sessions across hostel
router.get('/sessions/active', controller.getActiveSessions);

// GET /api/v1/admin/reports/chart — chart data (?mode=day&date=... OR ?mode=month&month=...&year=...)
router.get('/reports/chart', controller.getChartData);

// GET /api/v1/admin/reports — monthly reports (?month=6&year=2026)
router.get('/reports', controller.getReports);

// GET /api/v1/admin/transactions — all hostel transactions
router.get('/transactions', controller.getTransactions);

// POST /api/v1/admin/recharge — recharge a student's wallet (Super Admin ONLY)
// Note: We bypass the global `router.use(authorizeRoles)` by having it authorize against BOTH,
// but for THIS specific route, we ADD an extra authorizeRoles('super_admin') which will
// restrict it further to ONLY super_admin.
router.post('/recharge', authorizeRoles('super_admin'), walletActionValidation, controller.rechargeWallet);

// POST /api/v1/admin/deduct — manual deduction (note required)
router.post('/deduct', deductValidation, controller.deductWallet);

// GET /api/v1/admin/rooms/:id — get room details
router.get('/rooms/:id', controller.getRoomDetails);

// PATCH /api/v1/admin/rooms/:id/remove-member — remove a member from a room
router.patch('/rooms/:id/remove-member', removeMemberValidation, controller.removeMemberFromRoom);

// POST /api/v1/admin/rooms/:id/invite — invite a student to a room
router.post('/rooms/:id/invite', inviteValidation, controller.inviteStudentToRoom);

module.exports = router;
