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

// POST /api/v1/admin/rooms
const createRoom = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const { room_no, room_name, capacity } = req.body;
    const room = await adminService.createRoom({
      admin: req.user,
      room_no,
      room_name,
      capacity,
    });
    res.status(201).json({
      success: true,
      message: 'Room created successfully',
      data: { room },
    });
  } catch (err) { next(err); }
};

// POST /api/v1/admin/rooms/:id/toggle-status
const toggleRoomStatus = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const { is_active } = req.body;
    const result = await adminService.toggleRoomStatus({ admin: req.user, room_id: req.params.id, is_active });
    res.status(200).json({ success: true, message: `Room ${is_active ? 'activated' : 'deactivated'} successfully`, data: result });
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

// GET /api/v1/admin/hostels
const getHostels = async (req, res, next) => {
  try {
    const hostels = await adminService.getHostelsOverview({ admin: req.user });
    res.status(200).json({ success: true, data: hostels });
  } catch (err) { next(err); }
};

// POST /api/v1/admin/hostels
const addHostel = async (req, res, next) => {
  try {
    const { hostel_code, hostel_name, address, admin_name, admin_mobile, admin_email, admin_password } = req.body;
    
    if (!hostel_code || !hostel_name || !admin_name || !admin_mobile || !admin_email || !admin_password) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const result = await adminService.createHostel({
      admin: req.user,
      hostelData: { hostel_code, name: hostel_name, address },
      adminData: { name: admin_name, email: admin_email, mobile: admin_mobile, password: admin_password }
    });

    res.status(201).json({ success: true, message: 'Hostel created successfully', data: result });
  } catch (err) { next(err); }
};

// GET /api/v1/admin/hostels/:id
const getHostelDetails = async (req, res, next) => {
  try {
    const details = await adminService.getHostelDetails({ admin: req.user, hostel_id: req.params.id });
    res.status(200).json({ success: true, data: details });
  } catch (err) { next(err); }
};

// PUT /api/v1/admin/hostels/:id
const updateHostel = async (req, res, next) => {
  try {
    const result = await adminService.updateHostel({ admin: req.user, hostel_id: req.params.id, hostelData: req.body });
    res.status(200).json({ success: true, message: 'Hostel updated successfully', data: result });
  } catch (err) { next(err); }
};

// PUT /api/v1/admin/hostels/:id/admin
const updateHostelAdmin = async (req, res, next) => {
  try {
    const result = await adminService.updateHostelAdmin({ admin: req.user, hostel_id: req.params.id, adminData: req.body });
    res.status(200).json({ success: true, message: 'Hostel admin updated successfully', data: result });
  } catch (err) { next(err); }
};

// POST /api/v1/admin/hostels/:id/toggle-status
const toggleHostelStatus = async (req, res, next) => {
  try {
    const { is_active } = req.body;
    const result = await adminService.toggleHostelStatus({ admin: req.user, hostel_id: req.params.id, is_active });
    res.status(200).json({ success: true, message: `Hostel ${is_active ? 'activated' : 'deactivated'} successfully`, data: result });
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
    const transactions = await adminService.getTransactions({
      admin: req.user,
      page:  req.query.page,
      limit: req.query.limit,
      type:  req.query.type,
      date:  req.query.date,
      student: req.query.student,
    });
    res.status(200).json({ success: true, data: transactions });
  } catch (err) { next(err); }
};

// GET /api/v1/admin/rooms/:id
const getRoomDetails = async (req, res, next) => {
  try {
    const details = await adminService.getRoomDetails({
      admin: req.user,
      room_id: parseInt(req.params.id, 10),
    });
    res.status(200).json({ success: true, data: details });
  } catch (err) { next(err); }
};

// PATCH /api/v1/admin/rooms/:id/remove-member
const removeMemberFromRoom = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const result = await adminService.removeMemberFromRoom({
      admin: req.user,
      room_id: parseInt(req.params.id, 10),
      u_id: parseInt(req.body.u_id, 10),
    });
    res.status(200).json({ success: true, message: result.message });
  } catch (err) { next(err); }
};

// POST /api/v1/admin/rooms/:id/invite
const inviteStudentToRoom = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const result = await adminService.inviteStudentToRoom({
      admin: req.user,
      room_id: parseInt(req.params.id, 10),
      identifier: req.body.student_identifier,
    });
    res.status(200).json({ success: true, message: result.message });
  } catch (err) { next(err); }
};

module.exports = {
  rechargeWallet,
  deductWallet,
  getStudents,
  getRooms,
  createRoom,
  toggleRoomStatus,
  getActiveSessions,
  getDashboard,
  getHostels,
  addHostel,
  getReports,
  getTransactions,
  getRoomDetails,
  removeMemberFromRoom,
  inviteStudentToRoom,
  getHostelDetails,
  updateHostel,
  updateHostelAdmin,
  toggleHostelStatus,
};
