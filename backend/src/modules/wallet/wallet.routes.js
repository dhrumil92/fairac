// =============================================================================
// src/modules/wallet/wallet.routes.js
// Wallet Routes
// =============================================================================

const express    = require('express');
const controller = require('./wallet.controller');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

// All wallet routes require authentication
router.use(authenticate);

// GET /api/v1/wallet — balance + monthly stats
router.get('/', controller.getWallet);

// GET /api/v1/wallet/transactions — paginated history
// ?page=1&limit=20&type=consumption|recharge|adjustment|refund
router.get('/transactions', controller.getTransactions);

module.exports = router;
