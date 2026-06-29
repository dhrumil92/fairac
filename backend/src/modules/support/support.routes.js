const express = require('express');
const router = express.Router();
const supportController = require('./support.controller');
const { authenticate, authorizeRoles } = require('../../middleware/auth');

router.post('/', authenticate, supportController.createTicket);
router.get('/my', authenticate, supportController.getMyTickets);
router.get('/unseen-count', authenticate, authorizeRoles('admin', 'super_admin'), supportController.getUnseenCount);
router.put('/mark-seen', authenticate, authorizeRoles('admin', 'super_admin'), supportController.markAllSeen);
router.get('/', authenticate, authorizeRoles('admin', 'super_admin'), supportController.getTickets);
router.put('/:id/resolve', authenticate, authorizeRoles('admin', 'super_admin'), supportController.resolveTicket);

module.exports = router;
