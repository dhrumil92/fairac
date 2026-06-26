// =============================================================================
// src/modules/rooms/rooms.controller.js
// Room Management HTTP Controller
// =============================================================================

const { validationResult } = require('express-validator');
const roomsService = require('./rooms.service');

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



// POST /api/v1/rooms
// Protected — student creates a new room and becomes its owner
const createRoom = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const { room_no, room_name, capacity, rate_per_unit } = req.body;

    const room = await roomsService.createRoom({
      u_id: req.user.u_id,
      hostel_id: req.user.hostel_id,
      room_no,
      room_name,
      capacity,
      rate_per_unit,
    });

    res.status(201).json({
      success: true,
      message: `Room ${room.room_no} created successfully. You are the room owner.`,
      data: { room },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/rooms/my
// Protected — get my current room + roommates
const getMyRoom = async (req, res, next) => {
  try {
    const room = await roomsService.getMyRoom(req.user.u_id);
    res.status(200).json({ success: true, data: { room } });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/rooms/invite
// Protected — room owner invites a student by email or mobile
const inviteRoommate = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const { room_id, identifier } = req.body;

    const result = await roomsService.inviteRoommate({
      inviter_u_id: req.user.u_id,
      room_id,
      identifier,
    });

    res.status(201).json({
      success: true,
      message: `Invitation sent to ${result.invited_user.name} (${result.invited_user.email}).`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/rooms/invitations
// Protected — see my pending room invitations
const getMyInvitations = async (req, res, next) => {
  try {
    const invitations = await roomsService.getMyInvitations(req.user.u_id);
    res.status(200).json({
      success: true,
      data: { invitations, count: invitations.length },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/rooms/invite/accept
// Protected — accept a room invitation
const acceptInvitation = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const result = await roomsService.acceptInvitation({
      u_id: req.user.u_id,
      invitation_id: req.body.invitation_id,
    });

    res.status(200).json({ success: true, message: result.message, data: result });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/rooms/invite/reject
// Protected — reject a room invitation
const rejectInvitation = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const result = await roomsService.rejectInvitation({
      u_id: req.user.u_id,
      invitation_id: req.body.invitation_id,
    });

    res.status(200).json({ success: true, message: result.message });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/rooms/:id/leave
// Protected — leave a room
const leaveRoom = async (req, res, next) => {
  try {
    const result = await roomsService.leaveRoom({
      u_id: req.user.u_id,
      room_id: parseInt(req.params.id, 10),
    });

    res.status(200).json({ success: true, message: result.message });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createRoom,
  getMyRoom,
  inviteRoommate,
  getMyInvitations,
  acceptInvitation,
  rejectInvitation,
  leaveRoom,
};
