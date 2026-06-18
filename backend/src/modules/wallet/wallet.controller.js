// =============================================================================
// src/modules/wallet/wallet.controller.js
// Wallet HTTP Controller
// =============================================================================

const walletService = require('./wallet.service');

// GET /api/v1/wallet
// Returns wallet balance + monthly stats for the dashboard
const getWallet = async (req, res, next) => {
  try {
    const [wallet, monthlyStats] = await Promise.all([
      walletService.getWallet(req.user.u_id),
      walletService.getMonthlyStats(req.user.u_id),
    ]);

    res.status(200).json({
      success: true,
      data: {
        wallet: {
          wallet_id:       wallet.wallet_id,
          balance:         parseFloat(wallet.balance),
          total_recharged: parseFloat(wallet.total_recharged),
          total_spent:     parseFloat(wallet.total_spent),
          updated_at:      wallet.updated_at,
        },
        this_month: {
          units_consumed: parseFloat(monthlyStats.monthly_units),
          cost:           parseFloat(monthlyStats.monthly_cost),
          sessions_count: parseInt(monthlyStats.sessions_count, 10),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/wallet/transactions
// Returns paginated transaction history
// Query params: ?page=1&limit=20&type=consumption
const getTransactions = async (req, res, next) => {
  try {
    const { page, limit, type } = req.query;
    const result = await walletService.getTransactions(req.user.u_id, {
      page,
      limit,
      type,
    });

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { getWallet, getTransactions };
