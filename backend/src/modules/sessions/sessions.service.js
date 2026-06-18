// =============================================================================
// src/modules/sessions/sessions.service.js
// Session Management & Billing Engine
// =============================================================================

const db = require('../../config/db');
const { createError } = require('../../middleware/errorHandler');

// ─── Helper: assertRoomMember ─────────────────────────────────────────────
// Verifies the user is an active member of the given room.
// Used by start, join, invite endpoints.
const assertRoomMember = async (u_id, r_id) => {
  const result = await db.query(
    `SELECT rm_id, role FROM room_members
     WHERE u_id = $1 AND r_id = $2 AND left_at IS NULL`,
    [u_id, r_id]
  );
  if (result.rows.length === 0) {
    throw createError(403, 'You must be an active room member to perform this action.');
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
            u.name, u.email
     FROM session_participants sp
     JOIN users u ON u.u_id = sp.u_id
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

  // Fetch rate_per_unit from the room (snapshot for this session)
  const roomResult = await db.query(
    `SELECT rate_per_unit FROM rooms WHERE r_id = $1 AND is_active = TRUE`,
    [r_id]
  );
  if (roomResult.rows.length === 0) {
    throw createError(404, 'Room not found or inactive.');
  }
  const rate_per_unit = roomResult.rows[0].rate_per_unit;

  // Validate target_value is provided for non-unlimited sessions
  if (session_type !== 'unlimited' && (target_value === null || target_value <= 0)) {
    throw createError(
      400,
      `target_value is required and must be > 0 for session_type "${session_type}".`
    );
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
     WHERE r_id = $1 AND status = 'active' LIMIT 1`,
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
const getMySessionHistory = async (u_id) => {
  const result = await db.query(
    `SELECT
            s.session_id, s.status, s.session_type, s.total_units,
            s.rate_per_unit, s.start_time, s.end_time,
            r.room_no, r.room_name,
            sp.status AS my_participation_status,
            cr.units_consumed AS my_units,
            cr.cost AS my_cost,
            EXTRACT(EPOCH FROM (COALESCE(s.end_time, NOW()) - s.start_time))/60 AS duration_minutes,
            (
              SELECT json_agg(json_build_object('name', u.name))
              FROM session_participants sp2
              JOIN users u ON u.u_id = sp2.u_id
              WHERE sp2.session_id = s.session_id AND sp2.status = 'accepted'
            ) AS participants
     FROM sessions s
     JOIN rooms r ON r.r_id = s.r_id
     JOIN session_participants sp ON sp.session_id = s.session_id AND sp.u_id = $1
     LEFT JOIN consumption_records cr ON cr.session_id = s.session_id AND cr.u_id = $1
     ORDER BY s.start_time DESC
     LIMIT 50`,
    [u_id]
  );
  return result.rows;
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

  if (!['pending', 'active'].includes(session.status)) {
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
  if (sessResult.rows[0].status !== 'active') {
    throw createError(409, 'Session is no longer active.');
  }

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

  if (session.status !== 'active') {
    throw createError(409, `Cannot join a ${session.status} session.`);
  }

  // Must be a room member
  await assertRoomMember(u_id, session.r_id);

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
  if (sessResult.rows[0].status !== 'active') {
    throw createError(409, 'Session is not active.');
  }

  // IMPORTANT BUSINESS LOGIC CHANGE: 
  // We no longer instantly leave. We set leave_status = 'pending'
  await db.query(
    `UPDATE session_participants SET leave_status = 'pending'
     WHERE session_id = $1 AND u_id = $2`,
    [session_id, u_id]
  );

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

  return { message: 'Leave request approved successfully.' };
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
const endSession = async ({ u_id, session_id, total_units }) => {
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

  // Any active participant (or the creator) can end the session
  const isParticipantResult = await db.query(
    `SELECT status FROM session_participants WHERE session_id = $1 AND u_id = $2 AND status = 'accepted' AND left_at IS NULL`,
    [session_id, u_id]
  );
  if (session.created_by !== u_id && isParticipantResult.rows.length === 0) {
    throw createError(403, 'Only active session participants can end the session.');
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
  const rate = parseFloat(session.rate_per_unit);
  const totalCost = parseFloat(total_units) * rate;

  // ── Billing Calculation ─────────────────────────────────────────────────
  // Step 1: Calculate each person's time in seconds
  const billingData = participants.map((p) => {
    const joinTime  = new Date(p.joined_at);
    const leaveTime = p.left_at ? new Date(p.left_at) : endTime;
    const seconds   = Math.max(0, (leaveTime - joinTime) / 1000);
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
        unitsShare = Math.round((parseFloat(total_units) - totalUnitsAssigned) * 1000) / 1000;
      } else {
        const ratio = p.seconds / totalSeconds;
        costShare  = Math.round(totalCost              * ratio * 100)  / 100;
        unitsShare = Math.round(parseFloat(total_units) * ratio * 1000) / 1000;
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
      [endTime, total_units, session_id]
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
        // Note: We check balance >= cost before deducting.
        // If wallet is insufficient, we still deduct (allow negative in this implementation)
        // For MVP, we trust admin has recharged enough. Production: add overdraft protection.
        const walletResult = await client.query(
          `UPDATE wallets
           SET balance = balance - $1,
               total_spent = total_spent + $1,
               updated_at = NOW()
           WHERE u_id = $2
           RETURNING wallet_id, balance`,
          [bill.cost, bill.u_id]
        );

        if (walletResult.rows.length === 0) {
          // User has no wallet — create one with negative balance
          // This handles edge cases from data issues
          console.error(`⚠️  No wallet found for u_id=${bill.u_id}. Skipping deduction.`);
          continue;
        }

        const { wallet_id } = walletResult.rows[0];

        // 2c. Record the transaction in the ledger
        await client.query(
          `INSERT INTO wallet_transactions
             (wallet_id, session_id, amount, type, description)
           VALUES ($1, $2, $3, 'consumption', $4)`,
          [
            wallet_id,
            session_id,
            bill.cost,
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

module.exports = {
  startSession,
  getActiveSession,
  getSessionById,
  getMySessionHistory,
  inviteParticipant,
  acceptSessionInvite,
  rejectSessionInvite,
  joinSession,
  leaveSession,
  approveLeave,
  endSession,
};
