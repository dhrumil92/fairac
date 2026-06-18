// =============================================================================
// src/modules/wallet/wallet.service.js
// Wallet Business Logic
// =============================================================================

const db = require('../../config/db');
const { createError } = require('../../middleware/errorHandler');

// =============================================================================
// getWallet
// =============================================================================
// Returns the student's wallet with balance and lifetime stats.
//
// WHY RETURN total_recharged AND total_spent separately?
//   The dashboard needs to show: "You have spent ₹350 this month" and
//   "You have recharged ₹1500 total". These fields make that calculation
//   trivial. Without them, the frontend would have to SUM all transactions.
//
const getWallet = async (u_id) => {
  const result = await db.query(
    `SELECT w.wallet_id, w.balance, w.total_recharged, w.total_spent,
            w.created_at, w.updated_at,
            u.name, u.email
     FROM wallets w
     JOIN users u ON u.u_id = w.u_id
     WHERE w.u_id = $1`,
    [u_id]
  );

  if (result.rows.length === 0) {
    throw createError(404, 'Wallet not found. Please contact support.');
  }

  return result.rows[0];
};

// =============================================================================
// getTransactions
// =============================================================================
// Returns paginated transaction history for a student's wallet.
//
// WHY PAGINATION?
//   A student who has been using FairAC for a year might have 500+ transaction
//   records. Returning all of them at once would be slow and wastes bandwidth.
//   Pagination (page=1, limit=20) returns a manageable chunk at a time.
//
// HOW PAGINATION WORKS IN SQL:
//   LIMIT  = how many rows per page
//   OFFSET = how many rows to skip = (page - 1) × limit
//   Example: page=2, limit=10 → OFFSET=10 (skip first 10, return next 10)
//
// WHY COUNT(*) OVER()?
//   Window function — counts total matching rows WITHOUT a second query.
//   More efficient than running two separate COUNT and SELECT queries.
//
const getTransactions = async (u_id, { page = 1, limit = 20, type = null }) => {
  // Validate and sanitize pagination inputs
  const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20)); // Cap at 100
  const offset   = (pageNum - 1) * limitNum;

  // Build optional type filter
  const typeFilter = type ? `AND wt.type = '${type}'` : '';

  const result = await db.query(
    `SELECT
       wt.txn_id,
       wt.amount,
       wt.type,
       wt.description,
       wt.created_at,
       wt.session_id,
       -- Session info (only for consumption transactions)
       s.start_time   AS session_start,
       s.end_time     AS session_end,
       r.room_no,
       -- Running balance (cumulative sum for mini-statement view)
       COUNT(*) OVER() AS total_count
     FROM wallet_transactions wt
     JOIN wallets w ON w.wallet_id = wt.wallet_id
     LEFT JOIN sessions s ON s.session_id = wt.session_id
     LEFT JOIN rooms r ON r.r_id = s.r_id
     WHERE w.u_id = $1 ${typeFilter}
     ORDER BY wt.created_at DESC
     LIMIT $2 OFFSET $3`,
    [u_id, limitNum, offset]
  );

  const total     = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
  const totalPages = Math.ceil(total / limitNum);

  return {
    transactions: result.rows.map((row) => {
      const { total_count, ...txn } = row; // Remove meta field from each row
      return txn;
    }),
    pagination: {
      page:        pageNum,
      limit:       limitNum,
      total,
      total_pages: totalPages,
      has_next:    pageNum < totalPages,
      has_prev:    pageNum > 1,
    },
  };
};

// =============================================================================
// getMonthlyStats
// =============================================================================
// Returns this month's consumption stats for the student dashboard.
//
// WHY NEEDED?
//   The dashboard shows "This Month: 18.5 kWh / ₹350"
//   This requires filtering consumption_records by current calendar month.
//
const getMonthlyStats = async (u_id) => {
  const result = await db.query(
    `SELECT
       COALESCE(SUM(cr.units_consumed), 0) AS monthly_units,
       COALESCE(SUM(cr.cost), 0)           AS monthly_cost,
       COUNT(DISTINCT cr.session_id)        AS sessions_count
     FROM consumption_records cr
     WHERE cr.u_id = $1
       AND DATE_TRUNC('month', cr.recorded_at) = DATE_TRUNC('month', NOW())`,
    [u_id]
  );

  return result.rows[0];
};

module.exports = { getWallet, getTransactions, getMonthlyStats };
