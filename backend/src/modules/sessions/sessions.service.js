// =============================================================================
// src/modules/sessions/sessions.service.js
// Session Management & Billing Engine
// =============================================================================

const db = require('../../config/db');
const { createError } = require('../../middleware/errorHandler');
const { sendPushNotification } = require('../../utils/push');

// ─── Helper: assertRoomMember ─────────────────────────────────────────────
// Verifies the user is an active member of the given room.
// Used by start, join, invite endpoints.
const assertRoomMember = async (u_id, r_id) => {
  const result = await db.query(
    `SELECT rm.rm_id, rm.role, u.is_active 
     FROM room_members rm
     JOIN users u ON u.u_id = rm.u_id
     WHERE rm.u_id = $1 AND rm.r_id = $2 AND rm.left_at IS NULL`,
    [u_id, r_id]
  );
  if (result.rows.length === 0) {
    throw createError(403, 'You must be an active room member to perform this action.');
  }
  if (!result.rows[0].is_active) {
    throw createError(403, 'Account Suspended, Cannot participate into session');
  }
  return result.rows[0];
};

// ─── Helper: getSessionWithParticipants ───────────────────────────────────
// Fetches a session along with all its participants and their details.
const getSessionWithParticipants = async (session_id) => {
  const sessionResult = await db.query(
    `SELECT s.*, r.room_no, r.room_name, r.hostel_id,
            u.name AS creator_name
     FROM sessions s
     JOIN rooms r ON r.r_id = s.r_id
     JOIN users u ON u.u_id = s.created_by
     WHERE s.session_id = $1`,
    [session_id]
  );

  if (sessionResult.rows.length === 0) {
    throw createError(404, 'Session not found.');
  }

  const session = sessionResult.rows[0];

  const participantsResult = await db.query(
    `SELECT sp.sp_id, sp.u_id, sp.status, sp.leave_status, sp.joined_at, sp.left_at,
            u.name, u.email,
            cr.units_consumed AS units_consumed,
            cr.cost AS cost
     FROM session_participants sp
     JOIN users u ON u.u_id = sp.u_id
     LEFT JOIN consumption_records cr ON cr.session_id = sp.session_id AND cr.u_id = sp.u_id
     WHERE sp.session_id = $1
     ORDER BY sp.joined_at ASC NULLS LAST`,
    [session_id]
  );

  return { ...session, participants: participantsResult.rows };
};

// =============================================================================
// startSession
// =============================================================================
// Creates a new AC session in a room. The creator is automatically added
// as an accepted participant.
//
// BUSINESS RULES:
//   1. Caller must be an active room member
//   2. Room must NOT already have an active/pending session
//      (enforced by unique partial index uq_sess_one_active_per_room)
//   3. session_type & target_value are validated together
//   4. rate_per_unit is SNAPSHOT from the room — not live (billing integrity)
//   5. participant_ids are optional — creator can add others later
//
// TRANSACTION: session INSERT + participant INSERT for creator + any invited
// participants all in one atomic block.
//
const startSession = async ({
  u_id,
  r_id,
  session_type = 'unlimited',
  target_value = null,
  participant_ids = [],
}) => {
  // Rule 1: Must be a room member
  await assertRoomMember(u_id, r_id);

  // Fetch rate_per_unit from the hostel (snapshot for this session)
  const roomResult = await db.query(
    `SELECT h.rate_per_unit, h.is_active AS hostel_active, r.is_active AS room_active
     FROM rooms r 
     JOIN hostels h ON h.hostel_id = r.hostel_id 
     WHERE r.r_id = $1`,
    [r_id]
  );
  if (roomResult.rows.length === 0) {
    throw createError(404, 'Room not found.');
  }
  
  const { rate_per_unit, hostel_active, room_active } = roomResult.rows[0];
  if (!room_active) {
    throw createError(403, 'Your room is deactivated, cannot start AC.');
  }
  if (!hostel_active) {
    throw createError(403, 'This hostel is currently inactive. New AC sessions cannot be started.');
  }

  // --- TEMP DISABLED FOR TESTING ---
  // Compressor Safety Cooldown: Prevent rapid cycling by enforcing a 5-minute cooldown
  // const lastSessionResult = await db.query(
  //   `SELECT end_time FROM sessions 
  //    WHERE r_id = $1 AND status = 'completed' AND end_time IS NOT NULL
  //    ORDER BY end_time DESC LIMIT 1`,
  //   [r_id]
  // );
  // if (lastSessionResult.rows.length > 0) {
  //   const lastEndTime = new Date(lastSessionResult.rows[0].end_time);
  //   const timeDiffMs = new Date() - lastEndTime;
  //   const cooldownMs = 5 * 60 * 1000; // 5 minutes
  //   if (timeDiffMs < cooldownMs) {
  //     const remainingMinutes = Math.ceil((cooldownMs - timeDiffMs) / 60000);
  //     throw createError(403, `Compressor cooling down to prevent damage. Please wait ${remainingMinutes} minute(s) before starting a new session.`);
  //   }
  // }
  // ---------------------------------

  // Validate target_value is provided for non-unlimited sessions
  if (session_type !== 'unlimited' && (target_value === null || target_value <= 0)) {
    throw createError(
      400,
      `target_value is required and must be > 0 for session_type "${session_type}".`
    );
  }

  // Loophole Fix: User must have a minimum wallet balance of 50 to start a session
  const walletCheck = await db.query(`SELECT balance FROM wallets WHERE u_id = $1`, [u_id]);
  if (walletCheck.rows.length === 0) {
    throw createError(400, 'No wallet found. Please contact support.');
  }
  
  const balance = parseFloat(walletCheck.rows[0].balance);
  if (balance < 50) {
    throw createError(400, 'Minimum wallet balance of ₹50 is required to start a session. Please recharge.');
  }

  // Prevent booking beyond what the current balance can afford
  const AC_POWER_KW = 1.5;
  if (session_type === 'budget') {
    if (target_value > balance) {
      throw createError(400, `Cannot book a budget of ₹${target_value} with a wallet balance of ₹${balance}.`);
    }
  } else if (session_type === 'unit') {
    const maxUnits = balance / rate_per_unit;
    if (target_value > maxUnits) {
      throw createError(400, `Cannot book ${target_value} units. Your balance (₹${balance}) only covers ${maxUnits.toFixed(2)} units.`);
    }
  } else if (session_type === 'duration') {
    const maxHours = balance / (AC_POWER_KW * rate_per_unit);
    if (target_value > maxHours) {
      throw createError(400, `Cannot book ${target_value} hours. Your balance (₹${balance}) only covers ${maxHours.toFixed(2)} hours.`);
    }
  }

  // Validate participant_ids are all room members (excluding creator)
  const validIds = participant_ids.filter((id) => id !== u_id);
  if (validIds.length > 0) {
    const memberCheck = await db.query(
      `SELECT u_id FROM room_members
       WHERE r_id = $1 AND u_id = ANY($2::bigint[]) AND left_at IS NULL`,
      [r_id, validIds]
    );
    if (memberCheck.rows.length !== validIds.length) {
      throw createError(
        400,
        'One or more invited participants are not active members of this room.'
      );
    }
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Create the session
    // NOTE: If another active/pending session already exists in this room,
    // the uq_sess_one_active_per_room index will throw a unique violation.
    let sessionResult;
    try {
      sessionResult = await client.query(
        `INSERT INTO sessions
           (r_id, created_by, session_type, target_value, rate_per_unit, status, start_time)
         VALUES ($1, $2, $3, $4, $5, 'active', NOW())
         RETURNING *`,
        [r_id, u_id, session_type, target_value, rate_per_unit]
      );
    } catch (err) {
      if (err.code === '23505' && err.constraint === 'uq_sess_one_active_per_room') {
        throw createError(
          409,
          'This room already has an active session. End it before starting a new one.'
        );
      }
      throw err;
    }

    const session = sessionResult.rows[0];

    // Auto-add creator as accepted participant (they started it, they're using the AC)
    await client.query(
      `INSERT INTO session_participants (session_id, u_id, status, joined_at)
       VALUES ($1, $2, 'accepted', NOW())`,
      [session.session_id, u_id]
    );

    // Invite additional participants
    if (validIds.length > 0) {
      const inviteValues = validIds
        .map((_, i) => `($1, $${i + 2}, 'invited')`)
        .join(', ');
      await client.query(
        `INSERT INTO session_participants (session_id, u_id, status)
         VALUES ${inviteValues}`,
        [session.session_id, ...validIds]
      );
    }

    await client.query('COMMIT');

    return await getSessionWithParticipants(session.session_id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// =============================================================================
// getActiveSession
// =============================================================================
// Returns the currently active session for the caller's room.
//
const getActiveSession = async (u_id) => {
  // Find caller's room
  const roomResult = await db.query(
    `SELECT r_id FROM room_members WHERE u_id = $1 AND left_at IS NULL LIMIT 1`,
    [u_id]
  );
  if (roomResult.rows.length === 0) {
    throw createError(404, 'You are not in any room.');
  }
  const { r_id } = roomResult.rows[0];

  const sessionResult = await db.query(
    `SELECT session_id FROM sessions
     WHERE r_id = $1 AND status IN ('active', 'booked') LIMIT 1`,
    [r_id]
  );

  if (sessionResult.rows.length === 0) {
    return null; // No active session — not an error
  }

  return await getSessionWithParticipants(sessionResult.rows[0].session_id);
};

// =============================================================================
// getSessionById
// =============================================================================
const getSessionById = async (session_id) => {
  return await getSessionWithParticipants(session_id);
};

// =============================================================================
// getMySessionHistory
// =============================================================================
// Returns all sessions the caller has participated in (as creator or participant).
//
const getMySessionHistory = async (u_id, { page = 1, limit = 7, type = null, date = null, scope = 'me' } = {}) => {
  const offset = (page - 1) * limit;

  let r_id = null;
  if (scope === 'room') {
    const roomResult = await db.query(
      `SELECT r_id FROM room_members WHERE u_id = $1 AND left_at IS NULL LIMIT 1`,
      [u_id]
    );
    if (roomResult.rows.length > 0) {
      r_id = roomResult.rows[0].r_id;
    }
  }

  const joinClause = scope === 'room' && r_id 
    ? `LEFT JOIN session_participants sp ON sp.session_id = s.session_id AND sp.u_id = $1`
    : `JOIN session_participants sp ON sp.session_id = s.session_id AND sp.u_id = $1`;
    
  const whereClause = scope === 'room' && r_id
    ? `s.r_id = ${r_id}`
    : `sp.status IN ('accepted', 'left')`;

  const countQuery = `
    SELECT COUNT(*) FROM sessions s
    ${joinClause}
    WHERE ${whereClause}
      AND ($2::text IS NULL OR s.session_type = $2::text)
      AND ($3::date IS NULL OR s.start_time::date = $3::date)
  `;
  const countResult = await db.query(countQuery, [u_id, type || null, date || null]);
  const total = parseInt(countResult.rows[0].count, 10);
  const total_pages = Math.ceil(total / limit);

  // Count sessions in the current calendar month only
  const monthCountResult = await db.query(
    `SELECT COUNT(*) FROM sessions s
     JOIN session_participants sp ON sp.session_id = s.session_id AND sp.u_id = $1
     WHERE DATE_TRUNC('month', s.start_time) = DATE_TRUNC('month', NOW())`,
    [u_id]
  );
  const this_month_count = parseInt(monthCountResult.rows[0].count, 10);

  const query = `
    SELECT
            s.session_id, s.status, s.session_type, s.total_units,
            s.rate_per_unit, s.start_time, s.end_time,
            r.room_no, r.room_name,
            sp.status AS my_participation_status,
            cr.units_consumed AS my_units,
            cr.cost AS my_cost,
            -- Fallback: if only one participant, my_cost = total session cost
            COALESCE(
              cr.cost,
              CASE 
                WHEN (SELECT COUNT(*) FROM session_participants sp3 WHERE sp3.session_id = s.session_id AND sp3.status IN ('accepted','left')) = 1
                THEN s.total_units * s.rate_per_unit
                ELSE NULL
              END
            ) AS my_cost_display,
            (s.total_units * s.rate_per_unit) AS total_cost,
            EXTRACT(EPOCH FROM (COALESCE(s.end_time, NOW()) - s.start_time))/60 AS duration_minutes,
            (
              SELECT json_agg(json_build_object('name', u.name))
              FROM session_participants sp2
              JOIN users u ON u.u_id = sp2.u_id
              WHERE sp2.session_id = s.session_id AND sp2.status IN ('accepted', 'left')
            ) AS participants
     FROM sessions s
     JOIN rooms r ON r.r_id = s.r_id
     ${joinClause}
     LEFT JOIN consumption_records cr ON cr.session_id = s.session_id AND cr.u_id = $1
     WHERE ${whereClause}
       AND ($2::text IS NULL OR s.session_type = $2::text)
       AND ($3::date IS NULL OR s.start_time::date = $3::date)
     ORDER BY s.start_time DESC
     LIMIT $4 OFFSET $5
  `;
  const result = await db.query(query, [u_id, type || null, date || null, limit, offset]);
  
  return {
    sessions: result.rows,
    this_month_count,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total_pages,
      has_next: page < total_pages,
      has_prev: page > 1,
    }
  };
};

// =============================================================================
// Helper: validateParticipantBalance
// =============================================================================
const validateParticipantBalance = async (u_id, session_id, actionContext = 'join') => {
  const walletCheck = await db.query(`SELECT balance FROM wallets WHERE u_id = $1`, [u_id]);
  if (walletCheck.rows.length === 0) throw createError(400, 'No wallet found.');
  const balance = parseFloat(walletCheck.rows[0].balance);
  
  const sessionResult = await db.query(
    `SELECT s.session_type, s.target_value, r.rate_per_unit
     FROM sessions s
     JOIN rooms r ON r.r_id = s.r_id
     WHERE s.session_id = $1`,
    [session_id]
  );
  if (sessionResult.rows.length === 0) throw createError(404, 'Session not found.');
  
  const { session_type, target_value, rate_per_unit } = sessionResult.rows[0];
  const AC_POWER_KW = 4.5;

  // New BLE Offline Architecture Types (target_value = max_kwh)
  if (['units', 'amount', 'duration'].includes(session_type)) {
    const required_balance = parseFloat((parseFloat(target_value) * parseFloat(rate_per_unit)).toFixed(2));
    if (balance < required_balance) {
      throw createError(400, actionContext === 'invite'
        ? `Cannot invite this user. Their balance (₹${balance.toFixed(2)}) is lower than the max session cost (₹${required_balance.toFixed(2)}).`
        : `Cannot participate. Your balance (₹${balance.toFixed(2)}) is lower than the max session cost (₹${required_balance.toFixed(2)}).`
      );
    }
  } 
  // Old Web App Architecture Types
  else if (session_type === 'unlimited') {
    if (balance < 50) {
      throw createError(400, actionContext === 'invite' 
        ? `Cannot invite this user. Their wallet balance is below ₹50.`
        : `Minimum wallet balance of ₹50 is required. Please recharge.`
      );
    }
  } else if (session_type === 'budget' && target_value > balance) {
    throw createError(400, actionContext === 'invite'
      ? `Cannot invite this user. Their balance (₹${balance}) is lower than the session budget (₹${target_value}).`
      : `Cannot participate. Your balance (₹${balance}) is lower than the session budget (₹${target_value}).`
    );
  } else if (session_type === 'unit') {
    const maxUnits = balance / rate_per_unit;
    if (target_value > maxUnits) {
      throw createError(400, actionContext === 'invite'
        ? `Cannot invite this user. Their balance (₹${balance}) cannot cover ${target_value} units.`
        : `Cannot participate. Your balance (₹${balance}) cannot cover ${target_value} units.`
      );
    }
  }
};

// =============================================================================
// inviteParticipant
// =============================================================================
// Invites an additional participant to an active or pending session.
// Only the session creator can invite.
//
const inviteParticipant = async ({ u_id, session_id, invitee_id }) => {
  // Fetch session
  const sessResult = await db.query(
    `SELECT session_id, r_id, created_by, status FROM sessions WHERE session_id = $1`,
    [session_id]
  );
  if (sessResult.rows.length === 0) throw createError(404, 'Session not found.');

  const session = sessResult.rows[0];

  if (!['pending', 'active', 'booked'].includes(session.status)) {
    throw createError(409, `Cannot invite to a ${session.status} session.`);
  }

  // Allow any accepted participant or the creator to invite
  const isParticipantResult = await db.query(
    `SELECT status FROM session_participants WHERE session_id = $1 AND u_id = $2 AND status = 'accepted' AND left_at IS NULL`,
    [session_id, u_id]
  );
  if (session.created_by !== u_id && isParticipantResult.rows.length === 0) {
    throw createError(403, 'Only active session participants can invite others.');
  }

  // Invitee must be a room member
  await assertRoomMember(invitee_id, session.r_id);

  // Invitee must have sufficient balance for this session
  await validateParticipantBalance(invitee_id, session_id, 'invite');

  // Not already a participant
  const existing = await db.query(
    `SELECT status FROM session_participants WHERE session_id = $1 AND u_id = $2`,
    [session_id, invitee_id]
  );
  if (existing.rows.length > 0) {
    const status = existing.rows[0].status;
    if (status === 'rejected' || status === 'left') {
      await db.query(
        `UPDATE session_participants SET status = 'invited', leave_status = 'none', left_at = NULL WHERE session_id = $1 AND u_id = $2`,
        [session_id, invitee_id]
      );
      return { message: 'Participant re-invited successfully.' };
    }
    throw createError(
      409,
      `User is already a participant with status: ${status}.`
    );
  }

  await db.query(
    `INSERT INTO session_participants (session_id, u_id, status) VALUES ($1, $2, 'invited')`,
    [session_id, invitee_id]
  );

  // Notify the invitee with Accept/Reject action buttons
  const inviterData = await db.query('SELECT name FROM users WHERE u_id = $1', [u_id]);
  const inviterName = inviterData.rows[0]?.name || 'Your roommate';
  const roomData = await db.query('SELECT room_no FROM rooms WHERE r_id = $1', [session.r_id]);
  const roomNo = roomData.rows[0]?.room_no || '';
  await sendPushNotification(
    invitee_id,
    '⚡ Session Invitation',
    `${inviterName} invited you to join the AC session in Room ${roomNo}. Your share will be deducted from your wallet.`,
    { type: 'SESSION_INVITE', categoryId: 'SESSION_INVITE', session_id: session_id }
  );

  return { message: 'Participant invited successfully.' };
};

// =============================================================================
// acceptSessionInvite
// =============================================================================
// The invited participant accepts → sets joined_at and status = 'accepted'.
//
const acceptSessionInvite = async ({ u_id, session_id }) => {
  const spResult = await db.query(
    `SELECT sp_id, status FROM session_participants
     WHERE session_id = $1 AND u_id = $2`,
    [session_id, u_id]
  );
  if (spResult.rows.length === 0) throw createError(404, 'No invitation found for you in this session.');

  const sp = spResult.rows[0];
  if (sp.status !== 'invited') {
    throw createError(409, `You have already ${sp.status} this session.`);
  }

  // Check session is still active
  const sessResult = await db.query(
    `SELECT status FROM sessions WHERE session_id = $1`, [session_id]
  );
  if (!['active', 'booked'].includes(sessResult.rows[0].status)) {
    throw createError(409, 'Session is no longer active or booked.');
  }

  // Validate the user has enough balance to accept
  await validateParticipantBalance(u_id, session_id, 'accept');

  await db.query(
    `UPDATE session_participants
     SET status = 'accepted', joined_at = NOW()
     WHERE session_id = $1 AND u_id = $2`,
    [session_id, u_id]
  );

  return { message: 'You have joined the session. AC costs will be tracked from now.' };
};

// =============================================================================
// rejectSessionInvite
// =============================================================================
const rejectSessionInvite = async ({ u_id, session_id }) => {
  const spResult = await db.query(
    `SELECT sp_id, status FROM session_participants
     WHERE session_id = $1 AND u_id = $2`,
    [session_id, u_id]
  );
  if (spResult.rows.length === 0) throw createError(404, 'No invitation found for you in this session.');

  if (spResult.rows[0].status !== 'invited') {
    throw createError(409, `You have already ${spResult.rows[0].status} this session.`);
  }

  await db.query(
    `UPDATE session_participants SET status = 'rejected'
     WHERE session_id = $1 AND u_id = $2`,
    [session_id, u_id]
  );

  return { message: 'Session invitation rejected. You will not be charged.' };
};

// =============================================================================
// joinSession
// =============================================================================
// A room member joins a running session without an explicit invitation.
// (e.g., student returns from class, AC is already on, they join)
//
const joinSession = async ({ u_id, session_id }) => {
  // Verify session exists and is active
  const sessResult = await db.query(
    `SELECT session_id, r_id, status FROM sessions WHERE session_id = $1`,
    [session_id]
  );
  if (sessResult.rows.length === 0) throw createError(404, 'Session not found.');
  const session = sessResult.rows[0];

  if (!['active', 'booked'].includes(session.status)) {
    throw createError(409, `Cannot join a ${session.status} session.`);
  }

  // Must be a room member
  await assertRoomMember(u_id, session.r_id);

  // Validate the user has enough balance to join
  await validateParticipantBalance(u_id, session_id, 'join');

  // Check if already a participant
  const existing = await db.query(
    `SELECT status FROM session_participants WHERE session_id = $1 AND u_id = $2`,
    [session_id, u_id]
  );
  if (existing.rows.length > 0) {
    const status = existing.rows[0].status;
    if (status === 'accepted') throw createError(409, 'You are already in this session.');
    if (status === 'invited') {
      // Auto-accept the pending invite
      await db.query(
        `UPDATE session_participants SET status = 'accepted', joined_at = NOW()
         WHERE session_id = $1 AND u_id = $2`,
        [session_id, u_id]
      );
      return { message: 'Joined session (accepted pending invite). AC costs tracked from now.' };
    }
  }

  // Insert as new participant
  await db.query(
    `INSERT INTO session_participants (session_id, u_id, status, joined_at)
     VALUES ($1, $2, 'accepted', NOW())`,
    [session_id, u_id]
  );

  return { message: 'Joined session successfully. AC costs will be tracked from now.' };
};

// =============================================================================
// leaveSession
// =============================================================================
// A participant requests to leave an active session early.
// Their billing window stops at left_at only after approval.
//
const leaveSession = async ({ u_id, session_id }) => {
  const spResult = await db.query(
    `SELECT sp_id, status, joined_at FROM session_participants
     WHERE session_id = $1 AND u_id = $2`,
    [session_id, u_id]
  );
  if (spResult.rows.length === 0) throw createError(404, 'You are not a participant in this session.');

  const sp = spResult.rows[0];
  if (sp.status !== 'accepted') {
    throw createError(409, `Cannot leave a session with status "${sp.status}".`);
  }
  if (sp.left_at) {
    throw createError(409, 'You have already left this session.');
  }

  // Check session is still active
  const sessResult = await db.query(
    `SELECT status FROM sessions WHERE session_id = $1`, [session_id]
  );
  if (!['active', 'booked'].includes(sessResult.rows[0].status)) {
    throw createError(409, 'Session is not active or booked.');
  }

  // IMPORTANT BUSINESS LOGIC CHANGE: 
  // We no longer instantly leave. We set leave_status = 'pending'
  await db.query(
    `UPDATE session_participants SET leave_status = 'pending'
     WHERE session_id = $1 AND u_id = $2`,
    [session_id, u_id]
  );

  // Notify other active participants to approve/reject the leave request
  const leaverData = await db.query('SELECT name FROM users WHERE u_id = $1', [u_id]);
  const leaverName = leaverData.rows[0]?.name || 'Your roommate';
  const otherParticipants = await db.query(
    `SELECT u_id FROM session_participants WHERE session_id = $1 AND u_id != $2 AND status = 'accepted' AND left_at IS NULL`,
    [session_id, u_id]
  );
  for (const p of otherParticipants.rows) {
    await sendPushNotification(
      p.u_id,
      '🚪 Leave Request',
      `${leaverName} wants to leave the AC session early. Approve or reject their request.`,
      { type: 'LEAVE_REQUEST', categoryId: 'LEAVE_REQUEST', session_id: session_id, leaving_u_id: u_id }
    );
  }

  return { message: 'Leave request sent. Awaiting approval from a roommate.' };
};

// =============================================================================
// approveLeave
// =============================================================================
// Approves a roommate's request to leave the session.
//
const approveLeave = async ({ approver_id, session_id, leaving_u_id }) => {
  // Verifying approver is in the session and active
  const approverResult = await db.query(
    `SELECT status FROM session_participants WHERE session_id = $1 AND u_id = $2 AND status = 'accepted' AND left_at IS NULL`,
    [session_id, approver_id]
  );
  if (approverResult.rows.length === 0) {
    throw createError(403, 'You must be an active participant to approve a leave request.');
  }

  // Verifying leaver requested to leave
  const leaverResult = await db.query(
    `SELECT leave_status FROM session_participants WHERE session_id = $1 AND u_id = $2`,
    [session_id, leaving_u_id]
  );
  if (leaverResult.rows.length === 0 || leaverResult.rows[0].leave_status !== 'pending') {
    throw createError(404, 'No pending leave request found for this user.');
  }

  // Set the leaver's status to left, update left_at, clear leave_status
  await db.query(
    `UPDATE session_participants SET status = 'left', left_at = NOW(), leave_status = 'none'
     WHERE session_id = $1 AND u_id = $2`,
    [session_id, leaving_u_id]
  );

  // ── Deadlock Prevention ────────────────────────────────────────────────────
  // After the leaver is removed, check if the approver is now the LAST remaining
  // active participant. If so, auto-cancel the approver's own pending leave
  // request (if any), because nobody is left to approve it.
  // The approver must now either stay or End Session themselves.
  const remainingResult = await db.query(
    `SELECT u_id FROM session_participants
     WHERE session_id = $1 AND status = 'accepted' AND left_at IS NULL AND u_id != $2`,
    [session_id, approver_id]
  );
  if (remainingResult.rows.length === 0) {
    // Approver is now alone — cancel their own pending leave if any
    await db.query(
      `UPDATE session_participants SET leave_status = 'none'
       WHERE session_id = $1 AND u_id = $2 AND leave_status = 'pending'`,
      [session_id, approver_id]
    );
  }

  // Notify the leaver that their request was approved
  const approverData = await db.query('SELECT name FROM users WHERE u_id = $1', [approver_id]);
  const approverName = approverData.rows[0]?.name || 'Your roommate';
  await sendPushNotification(
    leaving_u_id,
    '✅ Leave Approved',
    `${approverName} approved your leave request. Your billing has stopped.`,
    { type: 'LEAVE_APPROVED', categoryId: 'SESSION_UPDATE', session_id: session_id }
  );

  return { message: 'Leave request approved successfully.' };
};

// =============================================================================
// rejectLeave
// =============================================================================
// Rejects a roommate's request to leave the session.
//
const rejectLeave = async ({ approver_id, session_id, leaving_u_id }) => {
  // Verifying approver is in the session and active
  const approverResult = await db.query(
    `SELECT status FROM session_participants WHERE session_id = $1 AND u_id = $2 AND status = 'accepted' AND left_at IS NULL`,
    [session_id, approver_id]
  );
  if (approverResult.rows.length === 0) {
    throw createError(403, 'You must be an active participant to reject a leave request.');
  }

  // Verifying leaver requested to leave
  const leaverResult = await db.query(
    `SELECT leave_status FROM session_participants WHERE session_id = $1 AND u_id = $2`,
    [session_id, leaving_u_id]
  );
  if (leaverResult.rows.length === 0 || leaverResult.rows[0].leave_status !== 'pending') {
    throw createError(404, 'No pending leave request found for this user.');
  }

  // Clear the leaver's leave_status
  await db.query(
    `UPDATE session_participants SET leave_status = 'none'
     WHERE session_id = $1 AND u_id = $2`,
    [session_id, leaving_u_id]
  );

  // Notify the leaver that their request was rejected
  const rejectApproverData = await db.query('SELECT name FROM users WHERE u_id = $1', [approver_id]);
  const rejectApproverName = rejectApproverData.rows[0]?.name || 'Your roommate';
  await sendPushNotification(
    leaving_u_id,
    '❌ Leave Rejected',
    `${rejectApproverName} rejected your leave request. You are still in the session.`,
    { type: 'LEAVE_REJECTED', categoryId: 'SESSION_UPDATE', session_id: session_id }
  );

  return { message: 'Leave request rejected successfully.' };
};

// =============================================================================
// endSession — Contains the BILLING ENGINE
// =============================================================================
// Ends a session and calculates each participant's fair share of the cost.
//
// BILLING ALGORITHM:
// ──────────────────
// Input: total_units (kWh) entered manually (MVP)
//
// For each participant with status IN ('accepted', 'left'):
//   effective_join  = sp.joined_at
//   effective_leave = sp.left_at  ?? session.end_time
//   person_seconds  = (effective_leave - effective_join) in seconds
//
// total_person_seconds = SUM(all person_seconds)
//
// For each participant:
//   share_ratio    = person_seconds / total_person_seconds
//   cost_share     = ROUND(total_cost × share_ratio, 2)
//   units_share    = ROUND(total_units × share_ratio, 3)
//
// Rounding correction:
//   Last participant gets: total_cost - SUM(other costs)
//   This ensures we never have a fractional rupee left over.
//
// TRANSACTION SCOPE:
//   All of the following happen atomically:
//   1. UPDATE sessions (status = 'completed', end_time, total_units)
//   2. INSERT consumption_records (one per billed participant)
//   3. UPDATE wallets (deduct balance, update total_spent)
//   4. INSERT wallet_transactions (one per billed participant)
//
const endSession = async ({ u_id, role, session_id, total_units }) => {
  // Fetch session
  const sessResult = await db.query(
    `SELECT s.*, r.rate_per_unit AS room_rate
     FROM sessions s
     JOIN rooms r ON r.r_id = s.r_id
     WHERE s.session_id = $1`,
    [session_id]
  );
  if (sessResult.rows.length === 0) throw createError(404, 'Session not found.');

  const session = sessResult.rows[0];

  if (role === 'admin') {
    total_units = session.total_units || 0;
  }

  // If no units passed in, rely strictly on what the DB already has recorded from the ESP32.
  if (!total_units || parseFloat(total_units) === 0) {
    if (session.total_units && parseFloat(session.total_units) > 0) {
      total_units = session.total_units;
    } else {
      total_units = 0.0000;
    }
  }

  // Any active participant (or the creator, or admin) can end the session
  const isParticipantResult = await db.query(
    `SELECT status FROM session_participants WHERE session_id = $1 AND u_id = $2 AND status = 'accepted' AND left_at IS NULL`,
    [session_id, u_id]
  );
  if (role !== 'admin' && session.created_by !== u_id && isParticipantResult.rows.length === 0) {
    throw createError(403, 'Only active session participants can end the session.');
  }
  if (session.status === 'booked') {
    // Session never successfully started via Bluetooth. Just refund the hold!
    return await syncSession({ u_id, session_id, total_units: 0 });
  }
  if (session.status !== 'active') {
    throw createError(409, `Session is already ${session.status}.`);
  }
  if (total_units < 0) {
    throw createError(400, 'total_units cannot be negative.');
  }

  // Fetch all participants who actually participated (accepted or left)
  const participantsResult = await db.query(
    `SELECT sp.u_id, sp.joined_at, sp.left_at, sp.status
     FROM session_participants sp
     WHERE sp.session_id = $1 AND sp.status IN ('accepted', 'left')
     ORDER BY sp.joined_at ASC`,
    [session_id]
  );

  const participants = participantsResult.rows;
  const endTime = new Date();
  const sessionStartTime = new Date(session.start_time);
  const sessionDurationMs = endTime.getTime() - sessionStartTime.getTime();
  const rate = parseFloat(session.rate_per_unit);
  
  let finalTotalUnits = parseFloat(total_units);
  let totalCost = finalTotalUnits * rate;

  // ── SPAM PREVENTION & GRACE PERIOD ───────────────────────────────────────
  if (sessionDurationMs <= 60000) {
    // Under 60 seconds: Grace Period (Full refund for mistakes/hardware faults)
    totalCost = 0;
    finalTotalUnits = 0;
  } else {
    // Over 60 seconds: Enforce minimum connection fee of ₹0.10
    if (rate > 0 && totalCost < 0.10) {
      totalCost = 0.10;
      finalTotalUnits = 0.10 / rate;
    }
  }

  // ── Grace Period Configurations ─────────────────────────────────────────
  const JOIN_GRACE_MINUTES = 5;
  const LEAVE_GRACE_MINUTES = 5;
  const JOIN_GRACE_MS = JOIN_GRACE_MINUTES * 60 * 1000;
  const LEAVE_GRACE_MS = LEAVE_GRACE_MINUTES * 60 * 1000;

  // ── Billing Calculation ─────────────────────────────────────────────────
  // Step 1: Calculate each person's time in seconds
  
  const billingData = participants.map((p) => {
    const joinTime = new Date(p.joined_at);
    let effectiveJoinTime = joinTime;

    // Join Grace Period Logic
    // If accepted within 5 minutes of start, treat as joining at start
    if (joinTime.getTime() - sessionStartTime.getTime() <= JOIN_GRACE_MS) {
      effectiveJoinTime = sessionStartTime;
    }

    let effectiveLeaveTime = p.left_at ? new Date(p.left_at) : endTime;

    // Leave Grace Period Logic
    // If left within 5 minutes of end, treat as leaving at end
    if (p.left_at && (endTime.getTime() - effectiveLeaveTime.getTime() <= LEAVE_GRACE_MS)) {
      effectiveLeaveTime = endTime;
    }

    const seconds = Math.max(0, (effectiveLeaveTime.getTime() - effectiveJoinTime.getTime()) / 1000);
    return { u_id: p.u_id, seconds };
  });

  const totalSeconds = billingData.reduce((sum, p) => sum + p.seconds, 0);

  let billingResults = [];

  if (totalSeconds === 0 || participants.length === 0) {
    // Edge case: nobody was actually present (e.g. all left immediately)
    // Session ends with 0 charges for everyone
    billingResults = participants.map((p) => ({
      u_id:           p.u_id,
      units_consumed: 0,
      cost:           0,
    }));
  } else {
    // Step 2: Calculate proportional shares
    let totalCostAssigned  = 0;
    let totalUnitsAssigned = 0;

    billingResults = billingData.map((p, index) => {
      const isLast = index === billingData.length - 1;

      let costShare, unitsShare;

      if (isLast) {
        // Give last participant the remainder to avoid rounding gaps
        costShare  = Math.round((totalCost  - totalCostAssigned)  * 100) / 100;
        unitsShare = Math.round((finalTotalUnits - totalUnitsAssigned) * 1000) / 1000;
      } else {
        const ratio = p.seconds / totalSeconds;
        costShare  = Math.round(totalCost              * ratio * 100)  / 100;
        unitsShare = Math.round(finalTotalUnits * ratio * 1000) / 1000;
        totalCostAssigned  += costShare;
        totalUnitsAssigned += unitsShare;
      }

      return { u_id: p.u_id, units_consumed: unitsShare, cost: costShare };
    });
  }

  // ── Transaction ──────────────────────────────────────────────────────────
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Mark session as completed
    await client.query(
      `UPDATE sessions
       SET status = 'completed', end_time = $1, total_units = $2
       WHERE session_id = $3`,
      [endTime, finalTotalUnits, session_id]
    );

    // 1.5 Reset the live power on the device to 0W so the UI immediately reflects it
    await client.query(
      `UPDATE devices SET current_power_w = 0 WHERE r_id = $1`,
      [session.r_id]
    );

    // 2. For each billed participant:
    for (const bill of billingResults) {
      // 2a. Insert consumption record
      await client.query(
        `INSERT INTO consumption_records (session_id, u_id, units_consumed, cost)
         VALUES ($1, $2, $3, $4)`,
        [session_id, bill.u_id, bill.units_consumed, bill.cost]
      );

      if (bill.cost > 0) {
        // 2b. Deduct from wallet
        const walletResult = await client.query(
          `SELECT wallet_id, balance FROM wallets WHERE u_id = $1 FOR UPDATE`,
          [bill.u_id]
        );

        if (walletResult.rows.length === 0) {
          console.error(`⚠️  No wallet found for u_id=${bill.u_id}. Skipping deduction.`);
          continue;
        }

        const { wallet_id, balance } = walletResult.rows[0];
        const currentBalance = parseFloat(balance);
        const actualDeduction = bill.cost; // Fix: Deduct full amount, allow negative balance for debt


        // Deduct from wallet
        await client.query(
          `UPDATE wallets
           SET balance = balance - $1,
               total_spent = total_spent + $1,
               updated_at = NOW()
           WHERE wallet_id = $2`,
          [actualDeduction, wallet_id]
        );

        // 2c. Record the transaction in the ledger
        await client.query(
          `INSERT INTO wallet_transactions
             (wallet_id, session_id, amount, type, description)
           VALUES ($1, $2, $3, 'consumption', $4)`,
          [
            wallet_id,
            session_id,
            actualDeduction,
            `AC Session #${session_id} — ${bill.units_consumed} kWh`,
          ]
        );
      }
    }

    await client.query('COMMIT');

    // Return a summary of what happened
    return {
      session_id,
      status:      'completed',
      total_units: parseFloat(total_units),
      total_cost:  totalCost,
      rate_per_unit: rate,
      billing_summary: billingResults,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// =============================================================================
// bookSession (BLE Offline Architecture)
// =============================================================================
const bookSession = async ({ u_id, r_id, booking_type, booking_value }) => {
  await assertRoomMember(u_id, r_id);

  const roomResult = await db.query(
    `SELECT h.rate_per_unit, h.is_active AS hostel_active, r.is_active AS room_active
     FROM rooms r 
     JOIN hostels h ON h.hostel_id = r.hostel_id 
     WHERE r.r_id = $1`,
    [r_id]
  );
  if (roomResult.rows.length === 0) throw createError(404, 'Room not found.');
  const { rate_per_unit, hostel_active, room_active } = roomResult.rows[0];
  if (!room_active) throw createError(403, 'Your room is deactivated, cannot start AC.');
  if (!hostel_active) throw createError(403, 'This hostel is inactive.');

  const walletCheck = await db.query(`SELECT wallet_id, balance FROM wallets WHERE u_id = $1`, [u_id]);
  if (walletCheck.rows.length === 0) throw createError(400, 'No wallet found.');
  const balance = parseFloat(walletCheck.rows[0].balance);
  const wallet_id = walletCheck.rows[0].wallet_id;
  if (balance < 50) throw createError(400, 'Minimum wallet balance of ₹50 is required.');

  // Prevent multiple active or booked sessions in the same room
  const existingSession = await db.query(
    `SELECT session_id FROM sessions WHERE r_id = $1 AND status IN ('active', 'booked')`,
    [r_id]
  );
  if (existingSession.rows.length > 0) {
    throw createError(409, 'A session is already active or booked in this room. Please stop it first.');
  }

  // Max assumed AC power draw (3-ton AC at minimum temp = 4.5kW worst case)
  // Used to conservatively block funds for duration-based bookings.
  const AC_POWER_KW = 4.5;
  let max_kwh = 0;
  let max_duration_sec = 0; // 0 means no time limit (for units/amount bookings)
  
  if (booking_type === 'units') {
    max_kwh = parseFloat(booking_value);
    max_duration_sec = 0; // No time limit; ESP32 enforces kWh limit only
  } else if (booking_type === 'amount') {
    max_kwh = parseFloat(booking_value) / rate_per_unit;
    max_duration_sec = 0; // No time limit; ESP32 enforces kWh limit only
  } else if (booking_type === 'duration') {
    const duration_hours = parseFloat(booking_value);
    max_kwh = duration_hours * AC_POWER_KW; // Worst-case block (refunded based on actual use)
    max_duration_sec = Math.round(duration_hours * 3600); // ESP32 enforces this hard time limit
  } else {
    throw createError(400, 'Invalid booking type.');
  }

  const block_amount = max_kwh * rate_per_unit;
  if (block_amount > balance) {
    throw createError(400, `Insufficient funds. Booking requires ₹${block_amount.toFixed(2)} but your balance is ₹${balance.toFixed(2)}.`);
  }

  const client = await db.getClient();
  let bookingResult;
  try {
    await client.query('BEGIN');

    // 1. Create a "booked" session record
    const sessionRes = await client.query(
      `INSERT INTO sessions (r_id, created_by, status, rate_per_unit, target_value, session_type)
       VALUES ($1, $2, 'booked', $3, $4, $5)
       RETURNING session_id`,
      [r_id, u_id, rate_per_unit, max_kwh, booking_type]
    );
    const session_id = sessionRes.rows[0].session_id;

    // 2. Block the funds (Debit)
    await client.query(
      `UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE u_id = $2`,
      [block_amount, u_id]
    );

    // 3. Record transaction
    await client.query(
      `INSERT INTO wallet_transactions (wallet_id, session_id, amount, type, description)
       VALUES ($1, $2, $3, 'consumption', $4)`,
      [wallet_id, session_id, block_amount, 'AC Booking Hold']
    );

    // 4. Add creator as a participant automatically
    await client.query(
      `INSERT INTO session_participants (session_id, u_id, status, joined_at)
       VALUES ($1, $2, 'accepted', NOW())`,
      [session_id, u_id]
    );

    await client.query('COMMIT');
    bookingResult = { session_id, max_kwh, max_duration_sec, block_amount, rate_per_unit };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return bookingResult;
};

// =============================================================================
// activateSession (BLE Offline Architecture)
// =============================================================================
// Called by the mobile app after successfully starting the AC via BLE.
const activateSession = async ({ u_id, session_id }) => {
  const result = await db.query(
    `UPDATE sessions SET status = 'active', start_time = NOW()
     WHERE session_id = $1 AND status = 'booked' AND created_by = $2
     RETURNING session_id`,
    [session_id, u_id]
  );
  if (result.rows.length === 0) {
    throw createError(404, 'Session not found or already active.');
  }
  return { message: 'Session activated successfully.' };
};

// =============================================================================
// cancelSession (BLE Offline Architecture)
// =============================================================================
// Called if the mobile app fails to start the AC via BLE after booking.
// Refunds the completely blocked amount.
const cancelSession = async ({ u_id, session_id }) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE sessions SET status = 'cancelled'
       WHERE session_id = $1 AND status = 'booked' AND created_by = $2
       RETURNING session_id`,
      [session_id, u_id]
    );
    if (result.rows.length === 0) {
      throw createError(404, 'Session not found or cannot be cancelled.');
    }
    
    // Reverse the hold
    const txRes = await client.query(
      `SELECT amount, wallet_id FROM wallet_transactions 
       WHERE session_id = $1 AND type = 'consumption' AND description = 'AC Booking Hold'`,
      [session_id]
    );
    
    if (txRes.rows.length > 0) {
      const { amount, wallet_id } = txRes.rows[0];
      await client.query(
        `UPDATE wallets SET balance = balance + $1 WHERE wallet_id = $2`,
        [amount, wallet_id]
      );
      await client.query(
        `INSERT INTO wallet_transactions (wallet_id, session_id, amount, type, description)
         VALUES ($1, $2, $3, 'refund', 'AC Booking Hold Cancelled')`,
        [wallet_id, session_id, amount]
      );
    }
    await client.query('COMMIT');
    return { message: 'Session cancelled and fully refunded.' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// =============================================================================
// syncSession (BLE Offline Architecture — Fair Cost Split)
// =============================================================================
// When a session ends (manually or autonomously), the mobile app sends the
// final kWh reading. This function:
//   1. Calculates the ACTUAL total cost from the true kWh consumed.
//   2. Looks at ALL accepted participants and their joined_at / left_at times.
//   3. Splits the cost PROPORTIONALLY based on participation time.
//      (e.g. if user A was in for 60min and user B for 30min → 67% / 33% split)
//   4. Deducts each participant's share from their respective wallet.
//   5. Refunds the CREATOR (who pre-paid the full blocked amount) the excess:
//      i.e. the full blocked amount - the creator's own share.
// =============================================================================
const syncSession = async ({ u_id, session_id, total_units }) => {
  const sessionResult = await db.query(
    `SELECT * FROM sessions WHERE session_id = $1 AND status IN ('booked', 'active')`,
    [session_id]
  );
  if (sessionResult.rows.length === 0) {
    throw createError(404, 'Active/Booked session not found or already settled.');
  }
  const session = sessionResult.rows[0];
  const rate_per_unit = parseFloat(session.rate_per_unit);
  const max_kwh = parseFloat(session.target_value);
  const blocked_amount = max_kwh * rate_per_unit;

  // Cap actual consumption at the booked limit (never overcharge)
  const actual_consumed = Math.min(parseFloat(total_units), max_kwh);
  const actual_total_cost = parseFloat((actual_consumed * rate_per_unit).toFixed(2));

  // ── Fetch all accepted participants with their timestamps ──────────────────
  const participantsResult = await db.query(
    `SELECT sp.u_id, sp.joined_at, sp.left_at, w.wallet_id
     FROM session_participants sp
     JOIN wallets w ON w.u_id = sp.u_id
     WHERE sp.session_id = $1 AND sp.status IN ('accepted', 'left')
     ORDER BY sp.joined_at ASC NULLS LAST`,
    [session_id]
  );
  const participants = participantsResult.rows;

  if (participants.length === 0) {
    throw createError(400, 'No accepted participants found for this session.');
  }

  // ── Calculate each participant's time share ────────────────────────────────
  // Session end time (use NOW() as proxy since we're settling right now)
  const sessionEnd = new Date();
  const sessionStart = new Date(session.start_time);

  let shares = participants.map((p) => {
    const joinTime = new Date(p.joined_at || session.start_time);
    const leaveTime = p.left_at ? new Date(p.left_at) : sessionEnd;
    const participationMs = Math.max(0, leaveTime.getTime() - joinTime.getTime());
    return { ...p, participationMs };
  });

  const totalMs = shares.reduce((sum, p) => sum + p.participationMs, 0);

  if (totalMs === 0) {
    // Edge case: all joined and left at the same ms — split equally
    shares = shares.map((p) => ({ ...p, sharePercent: 1 / shares.length }));
  } else {
    shares = shares.map((p) => ({ ...p, sharePercent: p.participationMs / totalMs }));
  }

  // Assign costs — last participant absorbs any rounding remainder
  let assignedSoFar = 0;
  shares = shares.map((p, idx) => {
    let cost;
    if (idx === shares.length - 1) {
      // Last participant gets the remainder to avoid floating point drift
      cost = parseFloat((actual_total_cost - assignedSoFar).toFixed(2));
    } else {
      cost = parseFloat((actual_total_cost * p.sharePercent).toFixed(2));
      assignedSoFar += cost;
    }
    return { ...p, cost, units: parseFloat((actual_consumed * p.sharePercent).toFixed(4)) };
  });

  const creatorShare = shares.find((p) => String(p.u_id) === String(session.created_by));
  // The creator pre-paid 'blocked_amount'. Refund = blocked - creator's share
  const creatorRefund = parseFloat((blocked_amount - (creatorShare?.cost || actual_total_cost)).toFixed(2));

  const client = await db.getClient();
  let settlementResult;
  try {
    await client.query('BEGIN');

    // 1. Mark session completed with real kWh
    await client.query(
      `UPDATE sessions SET status = 'completed', end_time = NOW(), total_units = $1 WHERE session_id = $2`,
      [actual_consumed, session_id]
    );

    // 2. Refund creator: blocked_amount - their_own_share
    if (creatorRefund > 0.01) {
      const creatorWalletRow = await client.query(
        `SELECT wallet_id FROM wallets WHERE u_id = $1`, [session.created_by]
      );
      const creatorWalletId = creatorWalletRow.rows[0]?.wallet_id;
      if (creatorWalletId) {
        await client.query(
          `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE wallet_id = $2`,
          [creatorRefund, creatorWalletId]
        );
        await client.query(
          `INSERT INTO wallet_transactions (wallet_id, session_id, amount, type, description)
           VALUES ($1, $2, $3, 'recharge', $4)`,
          [creatorWalletId, session_id, creatorRefund, 'AC Session Refund (Unused + Co-pay)']
        );
      }
    }

    // 3. Deduct each NON-CREATOR participant's share from their wallet
    for (const p of shares) {
      if (String(p.u_id) === String(session.created_by)) continue; // Skip creator (already handled via refund)
      if (p.cost <= 0) continue;

      // Check sufficient balance
      const balRow = await client.query(`SELECT balance FROM wallets WHERE wallet_id = $1`, [p.wallet_id]);
      const balance = parseFloat(balRow.rows[0]?.balance || 0);
      const deduct = Math.min(p.cost, balance); // Never go negative

      await client.query(
        `UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE wallet_id = $2`,
        [deduct, p.wallet_id]
      );
      await client.query(
        `INSERT INTO wallet_transactions (wallet_id, session_id, amount, type, description)
         VALUES ($1, $2, $3, 'consumption', $4)`,
        [p.wallet_id, session_id, deduct,
          `AC Session #${session_id} (${(p.sharePercent * 100).toFixed(0)}% share)`]
      );
    }

    // 4. Write consumption_records for every participant (for history display)
    for (const p of shares) {
      await client.query(
        `INSERT INTO consumption_records (session_id, u_id, units_consumed, cost, recorded_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (session_id, u_id) DO UPDATE
           SET units_consumed = EXCLUDED.units_consumed,
               cost = EXCLUDED.cost,
               recorded_at = EXCLUDED.recorded_at`,
        [session_id, p.u_id, p.units, p.cost]
      );
    }

    await client.query('COMMIT');
    settlementResult = {
      actual_consumed,
      actual_total_cost,
      creator_refund: creatorRefund,
      billing_summary: shares.map((p) => ({
        u_id: p.u_id,
        share_percent: parseFloat((p.sharePercent * 100).toFixed(1)),
        units: p.units,
        cost: p.cost,
      })),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return settlementResult;
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
  inviteParticipant,
  acceptSessionInvite,
  rejectSessionInvite,
  joinSession,
  leaveSession,
  approveLeave,
  rejectLeave,
  endSession
};
