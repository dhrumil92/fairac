// =============================================================================
// src/modules/admin/admin.controller.js
// Admin HTTP Controller
// =============================================================================

const { validationResult } = require('express-validator');
const adminService = require('./admin.service');

const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
    return true;
  }
  return false;
};

// POST /api/v1/admin/recharge
const rechargeWallet = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const result = await adminService.rechargeWallet({
      admin:               req.user,
      student_identifier:  req.body.student_identifier,
      amount:              parseFloat(req.body.amount),
      note:                req.body.note,
    });
    res.status(200).json({
      success: true,
      message: `₹${result.amount_added} recharged to ${result.student.name}'s wallet. New balance: ₹${result.new_balance}`,
      data: result,
    });
  } catch (err) { next(err); }
};

// POST /api/v1/admin/deduct
const deductWallet = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const result = await adminService.deductWallet({
      admin:               req.user,
      student_identifier:  req.body.student_identifier,
      amount:              parseFloat(req.body.amount),
      note:                req.body.note,
    });
    res.status(200).json({
      success: true,
      message: `₹${result.amount_deducted} deducted from ${result.student.name}'s wallet.`,
      data: result,
    });
  } catch (err) { next(err); }
};

// GET /api/v1/admin/students
// ?search=name_or_email_or_mobile
const getStudents = async (req, res, next) => {
  try {
    const students = await adminService.getStudents({
      admin:  req.user,
      search: req.query.search,
    });
    res.status(200).json({
      success: true,
      data: { students, count: students.length },
    });
  } catch (err) { next(err); }
};

// GET /api/v1/admin/rooms
const getRooms = async (req, res, next) => {
  try {
    const rooms = await adminService.getRooms({ admin: req.user });
    res.status(200).json({
      success: true,
      data: { rooms, count: rooms.length },
    });
  } catch (err) { next(err); }
};

// GET /api/v1/admin/sessions/active
const getActiveSessions = async (req, res, next) => {
  try {
    const sessions = await adminService.getActiveSessions({ admin: req.user });
    res.status(200).json({
      success: true,
      data: { sessions, count: sessions.length },
    });
  } catch (err) { next(err); }
};

// GET /api/v1/admin/dashboard
const getDashboard = async (req, res, next) => {
  try {
    const overview = await adminService.getDashboardOverview({ admin: req.user });
    res.status(200).json({ success: true, data: { overview } });
  } catch (err) { next(err); }
};

// GET /api/v1/admin/reports
// ?month=6&year=2026
const getReports = async (req, res, next) => {
  try {
    const reports = await adminService.getReports({
      admin: req.user,
      month: req.query.month ? parseInt(req.query.month, 10) : null,
      year:  req.query.year  ? parseInt(req.query.year, 10)  : null,
    });
    res.status(200).json({ success: true, data: reports });
  } catch (err) { next(err); }
};

// GET /api/v1/admin/transactions
// ?page=1&limit=7
const getTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 7;
    const { transactions, pagination } = await adminService.getTransactions({ admin: req.user, page, limit });
    res.status(200).json({ success: true, data: { transactions, pagination } });
  } catch (err) { next(err); }
};

module.exports = {
  rechargeWallet,
  deductWallet,
  getStudents,
  getRooms,
  getActiveSessions,
  getDashboard,
  getReports,
  getTransactions,
};
