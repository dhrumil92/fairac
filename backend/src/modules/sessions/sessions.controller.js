// =============================================================================
// src/modules/sessions/sessions.controller.js
// Session Management HTTP Controller
// =============================================================================

const { validationResult } = require('express-validator');
const sessionsService = require('./sessions.service');

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

// POST /api/v1/sessions/start (Used by Web App)
const startSession = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const { r_id, session_type, target_value, participant_ids } = req.body;

    const session = await sessionsService.startSession({
      u_id: req.user.u_id,
      r_id,
      session_type,
      target_value,
      participant_ids: participant_ids || [],
    });

    res.status(201).json({
      success: true,
      message: 'Session started. AC cost tracking is now active.',
      data: { session },
    });
  } catch (err) { next(err); }
};

// POST /api/v1/sessions/book (Used by Mobile App BLE Flow)
const bookSession = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const { r_id, booking_type, booking_value } = req.body;

    const bookingInfo = await sessionsService.bookSession({
      u_id: req.user.u_id,
      r_id,
      booking_type,
      booking_value
    });

    res.status(201).json({
      success: true,
      message: 'Session booked. Proceed to connect via Bluetooth.',
      data: bookingInfo,
    });
  } catch (err) { next(err); }
};

// POST /api/v1/sessions/:id/activate
const activateSession = async (req, res, next) => {
  try {
    const result = await sessionsService.activateSession({
      u_id: req.user.u_id,
      session_id: parseInt(req.params.id, 10),
    });
    res.status(200).json({ success: true, message: result.message });
  } catch (err) { next(err); }
};

// POST /api/v1/sessions/:id/cancel
const cancelSession = async (req, res, next) => {
  try {
    const result = await sessionsService.cancelSession({
      u_id: req.user.u_id,
      session_id: parseInt(req.params.id, 10),
    });
    res.status(200).json({ success: true, message: result.message });
  } catch (err) { next(err); }
};

// POST /api/v1/sessions/sync (Used by Mobile App BLE Flow)
const syncSession = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const { session_id, total_units } = req.body;

    const result = await sessionsService.syncSession({
      u_id: req.user.u_id,
      session_id,
      total_units
    });

    res.status(200).json({
      success: true,
      message: 'Session synced and settled successfully.',
      data: result,
    });
  } catch (err) { next(err); }
};

// GET /api/v1/sessions/active
const getActiveSession = async (req, res, next) => {
  try {
    const session = await sessionsService.getActiveSession(req.user.u_id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'No active session found.' });
    }
    res.status(200).json({ success: true, data: session });
  } catch (err) { next(err); }
};

// GET /api/v1/sessions/my
const getMySessionHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 7, type, date, scope = 'me' } = req.query;
    const data = await sessionsService.getMySessionHistory(req.user.u_id, { page, limit, type, date, scope });
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

// GET /api/v1/sessions/:id
const getSessionById = async (req, res, next) => {
  try {
    const session = await sessionsService.getSessionById(
      parseInt(req.params.id, 10)
    );
    res.status(200).json({ success: true, data: { session } });
  } catch (err) { next(err); }
};

// POST /api/v1/sessions/:id/end
const endSession = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const result = await sessionsService.endSession({
      u_id:        req.user.u_id,
      role:        req.user.role,
      session_id:  parseInt(req.params.id, 10),
      total_units: req.body.total_units,
    });

    res.status(200).json({
      success: true,
      message: `Session ended. Total cost ₹${result.total_cost.toFixed(2)} split among ${result.billing_summary.length} participant(s).`,
      data: result,
    });
  } catch (err) { next(err); }
};

// POST /api/v1/sessions/:id/join
const joinSession = async (req, res, next) => {
  try {
    const result = await sessionsService.joinSession({
      u_id:       req.user.u_id,
      session_id: parseInt(req.params.id, 10),
    });
    res.status(200).json({ success: true, message: result.message });
  } catch (err) { next(err); }
};

// POST /api/v1/sessions/participants/invite
const inviteParticipant = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const result = await sessionsService.inviteParticipant({
      u_id:        req.user.u_id,
      session_id:  req.body.session_id,
      invitee_id:  req.body.invitee_id,
    });
    res.status(201).json({ success: true, message: result.message });
  } catch (err) { next(err); }
};

// POST /api/v1/sessions/participants/accept
const acceptSessionInvite = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const result = await sessionsService.acceptSessionInvite({
      u_id:       req.user.u_id,
      session_id: req.body.session_id,
    });
    res.status(200).json({ success: true, message: result.message });
  } catch (err) { next(err); }
};

// POST /api/v1/sessions/participants/reject
const rejectSessionInvite = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const result = await sessionsService.rejectSessionInvite({
      u_id:       req.user.u_id,
      session_id: req.body.session_id,
    });
    res.status(200).json({ success: true, message: result.message });
  } catch (err) { next(err); }
};

// POST /api/v1/sessions/participants/leave
const leaveSession = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const result = await sessionsService.leaveSession({
      u_id:       req.user.u_id,
      session_id: req.body.session_id,
    });
    res.status(200).json({ success: true, message: result.message });
  } catch (err) { next(err); }
};

// POST /api/v1/sessions/participants/leave/approve
const approveLeaveSession = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const result = await sessionsService.approveLeave({
      approver_id:  req.user.u_id,
      session_id:   req.body.session_id,
      leaving_u_id: req.body.leaving_u_id,
    });
    res.status(200).json({ success: true, message: result.message });
  } catch (err) { next(err); }
};

// POST /api/v1/sessions/participants/leave/reject
const rejectLeaveSession = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const result = await sessionsService.rejectLeave({
      approver_id:  req.user.u_id,
      session_id:   req.body.session_id,
      leaving_u_id: req.body.leaving_u_id,
    });
    res.status(200).json({ success: true, message: result.message });
  } catch (err) { next(err); }
};

module.exports = {
  startSession,
  getActiveSession,
  getSessionById,
  getMySessionHistory,
  bookSession,
  activateSession,
  cancelSession,
  syncSession,
  endSession,
  joinSession,
  inviteParticipant,
  acceptSessionInvite,
  rejectSessionInvite,
  leaveSession,
  approveLeaveSession,
  rejectLeaveSession
};
