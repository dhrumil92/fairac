// =============================================================================
// src/modules/rooms/rooms.service.js
// Room Management Business Logic
// =============================================================================

const db = require('../../config/db');
const { createError } = require('../../middleware/errorHandler');

// ─── Helper: getActiveRoomMembership ──────────────────────────────────────
// Checks if a user is currently in any room (left_at IS NULL).
// Returns the membership row if found, or null.
//
// WHY REUSE THIS?
//   Multiple service functions need to check this: createRoom (can't create if
//   already in one), acceptInvitation (can't join if already in one), etc.
//   Extracting it avoids repeating the same SQL in 3 places.
//
const getActiveRoomMembership = async (u_id) => {
  const result = await db.query(
    `SELECT rm.rm_id, rm.r_id, rm.role, r.room_no, r.room_name
     FROM room_members rm
     JOIN rooms r ON r.r_id = rm.r_id
     WHERE rm.u_id = $1 AND rm.left_at IS NULL
     LIMIT 1`,
    [u_id]
  );
  return result.rows[0] || null;
};

// =============================================================================
// createRoom
// =============================================================================
// Creates a new room and makes the creator the room OWNER.
//
// BUSINESS RULES:
//   1. Student must NOT already be in an active room (one room at a time)
//   2. hostel_code must be valid
//   3. room_no must be unique within the hostel (unique constraint on DB)
//   4. Creator is automatically added to room_members as 'owner'
//
// TRANSACTION: rooms INSERT + room_members INSERT must be atomic.
//   If room is created but owner record fails → orphaned room with no owner.
//
const createRoom = async ({ u_id, room_no, room_name, capacity, rate_per_unit }) => {
  // Fetch fresh user data to get accurate hostel_id
  const freshUserResult = await db.query(`SELECT hostel_id FROM users WHERE u_id = $1`, [u_id]);
  const hostel_id = freshUserResult.rows[0]?.hostel_id;

  if (!hostel_id) {
    throw createError(403, 'Your account is not linked to a hostel. Please join a hostel first.');
  }

  // Rule 1: Check if user already has an active room
  const existingMembership = await getActiveRoomMembership(u_id);
  if (existingMembership) {
    throw createError(
      409,
      `You are already a member of Room ${existingMembership.room_no}. Leave it before creating a new one.`
    );
  }

  const norm_room_no = room_no.trim().toUpperCase();

  // Check if room already exists
  const existingRoomResult = await db.query(
    `SELECT r_id, is_active FROM rooms WHERE hostel_id = $1 AND room_no = $2 LIMIT 1`,
    [hostel_id, norm_room_no]
  );

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    let room;
    if (existingRoomResult.rows.length > 0) {
      const existingRoom = existingRoomResult.rows[0];
      if (existingRoom.is_active) {
        throw createError(409, `Room number "${room_no}" already exists and is currently occupied.`);
      }

      // Room exists but is inactive -> CLAIM IT
      const updateResult = await client.query(
        `UPDATE rooms 
         SET is_active = TRUE, created_by = $1, room_name = $2, capacity = $3, rate_per_unit = $4
         WHERE r_id = $5
         RETURNING r_id, room_no, room_name, capacity, rate_per_unit, created_at`,
        [u_id, room_name ? room_name.trim() : null, capacity || 4, rate_per_unit || 8.00, existingRoom.r_id]
      );
      room = updateResult.rows[0];
    } else {
      // Insert new room
      const insertResult = await client.query(
        `INSERT INTO rooms (hostel_id, created_by, room_no, room_name, capacity, rate_per_unit)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING r_id, room_no, room_name, capacity, rate_per_unit, created_at`,
        [hostel_id, u_id, norm_room_no, room_name ? room_name.trim() : null, capacity || 4, rate_per_unit || 8.00]
      );
      room = insertResult.rows[0];
    }

    // Add creator as OWNER in room_members. 
    // Use UPSERT because the user might be claiming a room they were previously in.
    await client.query(
      `INSERT INTO room_members (r_id, u_id, role, joined_at, left_at) 
       VALUES ($1, $2, 'owner', NOW(), NULL)
       ON CONFLICT (r_id, u_id) DO UPDATE 
       SET left_at = NULL, joined_at = NOW(), role = 'owner'`,
      [room.r_id, u_id]
    );

    await client.query('COMMIT');

    return room;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// =============================================================================
// getMyRoom
// =============================================================================
// Returns the current user's room details + all active roommates.
//
// WHY TWO QUERIES?
//   Query 1 fetches the room details.
//   Query 2 fetches the list of active members.
//   We could do it in one complex JOIN, but two clear queries are more readable
//   and maintainable. Performance difference at this scale is negligible.
//
const getMyRoom = async (u_id) => {
  // Find the user's active room membership
  const membershipResult = await db.query(
    `SELECT rm.r_id, rm.role AS my_role, rm.joined_at,
            r.room_no, r.room_name, r.capacity, h.rate_per_unit AS rate_per_unit,
            r.hostel_id, h.name AS hostel_name,
            r.created_by, r.is_active AS room_active, h.is_active AS hostel_active
     FROM room_members rm
     JOIN rooms r ON r.r_id = rm.r_id
     JOIN hostels h ON h.hostel_id = r.hostel_id
     WHERE rm.u_id = $1 AND rm.left_at IS NULL
     LIMIT 1`,
    [u_id]
  );

  if (membershipResult.rows.length === 0) {
    throw createError(404, 'You are not currently in any room.');
  }

  const room = membershipResult.rows[0];

  // Fetch all active members of this room
  const membersResult = await db.query(
    `SELECT u.u_id, u.name, u.email, u.mobile, rm.role, rm.joined_at
     FROM room_members rm
     JOIN users u ON u.u_id = rm.u_id
     WHERE rm.r_id = $1 AND rm.left_at IS NULL
     ORDER BY rm.joined_at ASC`,
    [room.r_id]
  );

  return {
    r_id:          room.r_id,
    room_no:       room.room_no,
    room_name:     room.room_name,
    capacity:      room.capacity,
    rate_per_unit: room.rate_per_unit,
    hostel_name:   room.hostel_name,
    my_role:       room.my_role,
    joined_at:     room.joined_at,
    room_active:   room.room_active,
    hostel_active: room.hostel_active,
    members:       membersResult.rows,
    members_count: membersResult.rows.length,
  };
};

// =============================================================================
// inviteRoommate
// =============================================================================
// Sends a room invitation to another student.
//
// BUSINESS RULES:
//   1. Sender must be the room OWNER (only owner can invite)
//   2. Invitee must exist in the system (registered)
//   3. Cannot invite yourself
//   4. Invitee must not already be in this room
//   5. Invitee must not have a PENDING invitation for this room already
//   6. Room must not be at full capacity
//
const inviteRoommate = async ({ inviter_u_id, room_id, identifier }) => {
  // Rule 1: Verify inviter is the OWNER of this room
  const ownerCheck = await db.query(
    `SELECT rm_id FROM room_members
     WHERE r_id = $1 AND u_id = $2 AND role = 'owner' AND left_at IS NULL`,
    [room_id, inviter_u_id]
  );
  if (ownerCheck.rows.length === 0) {
    throw createError(403, 'Only the room owner can invite roommates.');
  }

  // Rule 2 & 3: Find invitee by email or mobile
  const inviteeResult = await db.query(
    `SELECT u_id, name, email, hostel_id FROM users WHERE email = $1 OR mobile = $1 LIMIT 1`,
    [identifier.toLowerCase()]
  );
  if (inviteeResult.rows.length === 0) {
    throw createError(404, 'No registered user found with that email or mobile number.');
  }

  const invitee = inviteeResult.rows[0];

  // Rule 3: Cannot invite yourself
  if (invitee.u_id === inviter_u_id) {
    throw createError(400, 'You cannot invite yourself.');
  }

  // Rule 4: Invitee must not already be an active member of ANY room
  const alreadyInAnyRoom = await db.query(
    `SELECT r.room_no FROM room_members rm
     JOIN rooms r ON r.r_id = rm.r_id
     WHERE rm.u_id = $1 AND rm.left_at IS NULL AND r.is_active = TRUE LIMIT 1`,
    [invitee.u_id]
  );
  if (alreadyInAnyRoom.rows.length > 0) {
    throw createError(409, `${invitee.name} is already an active member of Room ${alreadyInAnyRoom.rows[0].room_no}.`);
  }

  // Rule 6: Check capacity
  const capacityCheck = await db.query(
    `SELECT r.capacity,
            (SELECT COUNT(*) FROM room_members WHERE r_id = $1 AND left_at IS NULL) AS current_count
     FROM rooms r WHERE r.r_id = $1`,
    [room_id]
  );
  const { capacity, current_count } = capacityCheck.rows[0];
  if (parseInt(current_count) >= parseInt(capacity)) {
    throw createError(409, `Room is full (${capacity}/${capacity} members).`);
  }

  // Rule 5: Check for existing pending invitation (uq_ri_pending constraint also guards this)
  const existingInvite = await db.query(
    `SELECT invitation_id, status FROM room_invitations
     WHERE room_id = $1 AND sent_to = $2`,
    [room_id, invitee.u_id]
  );
  if (existingInvite.rows.length > 0) {
    const status = existingInvite.rows[0].status;
    if (status === 'pending') {
      throw createError(409, `${invitee.name} already has a pending invitation for this room.`);
    }
    // If previously rejected, expired, OR accepted (but they left the room),
    // we need to delete the old record before inserting new
    // (because of the uq_ri_pending unique constraint on room_id+sent_to)
    await db.query(
      `DELETE FROM room_invitations WHERE room_id = $1 AND sent_to = $2`,
      [room_id, invitee.u_id]
    );
  }

  // Create the invitation (expires in 48 hours)
  const inviteResult = await db.query(
    `INSERT INTO room_invitations (room_id, sent_by, sent_to, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '48 hours')
     RETURNING invitation_id, status, created_at, expires_at`,
    [room_id, inviter_u_id, invitee.u_id]
  );

  return {
    invitation: inviteResult.rows[0],
    invited_user: { name: invitee.name, email: invitee.email },
  };
};

// =============================================================================
// getMyInvitations
// =============================================================================
// Returns all PENDING room invitations for the logged-in user.
//
const getMyInvitations = async (u_id) => {
  const result = await db.query(
    `SELECT ri.invitation_id, ri.status, ri.created_at, ri.expires_at,
            r.r_id, r.room_no, r.room_name,
            h.name AS hostel_name,
            u.name AS invited_by_name, u.email AS invited_by_email,
            (SELECT COUNT(*) FROM room_members WHERE r_id = r.r_id AND left_at IS NULL) AS current_members,
            r.capacity
     FROM room_invitations ri
     JOIN rooms r ON r.r_id = ri.room_id
     JOIN hostels h ON h.hostel_id = r.hostel_id
     JOIN users u ON u.u_id = ri.sent_by
     WHERE ri.sent_to = $1 AND ri.status = 'pending'
     ORDER BY ri.created_at DESC`,
    [u_id]
  );
  return result.rows;
};

// =============================================================================
// acceptInvitation
// =============================================================================
// Accepts a room invitation and adds the user as a room member.
//
// BUSINESS RULES:
//   1. Invitation must be PENDING (not already accepted/rejected/expired)
//   2. Invitation must belong to the requesting user
//   3. User must not already be in another active room (one room at a time)
//   4. Room must not be at full capacity
//
// TRANSACTION: Update invitation status + insert room_member atomically.
//
const acceptInvitation = async ({ u_id, invitation_id }) => {
  // Rule 1 & 2: Fetch and validate the invitation
  const inviteResult = await db.query(
    `SELECT ri.*, r.room_no, r.room_name, r.capacity
     FROM room_invitations ri
     JOIN rooms r ON r.r_id = ri.room_id
     WHERE ri.invitation_id = $1`,
    [invitation_id]
  );

  if (inviteResult.rows.length === 0) {
    throw createError(404, 'Invitation not found.');
  }

  const invite = inviteResult.rows[0];

  // Belongs to this user?
  if (invite.sent_to !== u_id) {
    throw createError(403, 'This invitation was not sent to you.');
  }

  if (invite.status !== 'pending') {
    throw createError(409, `This invitation has already been ${invite.status}.`);
  }

  // Check if expired
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    await db.query(
      `UPDATE room_invitations SET status = 'expired' WHERE invitation_id = $1`,
      [invitation_id]
    );
    throw createError(410, 'This invitation has expired.');
  }

  // Rule 3: One room at a time
  const existing = await getActiveRoomMembership(u_id);
  if (existing) {
    throw createError(409, `You are already a member of Room ${existing.room_no}. Leave it first.`);
  }

  // Rule 4: Capacity check
  const countResult = await db.query(
    `SELECT COUNT(*) AS cnt FROM room_members WHERE r_id = $1 AND left_at IS NULL`,
    [invite.room_id]
  );
  const currentMembersCount = parseInt(countResult.rows[0].cnt);
  if (currentMembersCount >= parseInt(invite.capacity)) {
    throw createError(409, 'Room is now full. Cannot join.');
  }

  const roleToAssign = currentMembersCount === 0 ? 'owner' : 'member';

  // Transaction: mark invitation accepted + add to room_members
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE room_invitations
       SET status = 'accepted', responded_at = NOW()
       WHERE invitation_id = $1`,
      [invitation_id]
    );

    // If the room was empty, claiming it reactivates it
    if (currentMembersCount === 0) {
      await client.query(
        `UPDATE rooms SET is_active = TRUE, created_by = $1 WHERE r_id = $2`,
        [u_id, invite.room_id]
      );
    }

    // If the user was previously in this room, they already have a row.
    // uq_rm_active is a UNIQUE (r_id, u_id) constraint. We must UPSERT to avoid violating it.
    await client.query(
      `INSERT INTO room_members (r_id, u_id, role, joined_at, left_at) 
       VALUES ($1, $2, $3, NOW(), NULL)
       ON CONFLICT (r_id, u_id) DO UPDATE 
       SET left_at = NULL, joined_at = NOW(), role = $3`,
      [invite.room_id, u_id, roleToAssign]
    );

    await client.query('COMMIT');

    return {
      message: `Successfully joined Room ${invite.room_no}.`,
      room_id: invite.room_id,
      room_no: invite.room_no,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// =============================================================================
// rejectInvitation
// =============================================================================
// Rejects a room invitation. Simple status update.
//
const rejectInvitation = async ({ u_id, invitation_id }) => {
  const inviteResult = await db.query(
    `SELECT * FROM room_invitations WHERE invitation_id = $1`,
    [invitation_id]
  );

  if (inviteResult.rows.length === 0) {
    throw createError(404, 'Invitation not found.');
  }

  const invite = inviteResult.rows[0];

  if (invite.sent_to !== u_id) {
    throw createError(403, 'This invitation was not sent to you.');
  }

  if (invite.status !== 'pending') {
    throw createError(409, `This invitation has already been ${invite.status}.`);
  }

  await db.query(
    `UPDATE room_invitations
     SET status = 'rejected', responded_at = NOW()
     WHERE invitation_id = $1`,
    [invitation_id]
  );

  return { message: 'Invitation rejected.' };
};

// =============================================================================
// leaveRoom
// =============================================================================
// Removes the user from a room by setting left_at to NOW().
//
// BUSINESS RULES:
//   1. User must be an active member of the specified room
//   2. User cannot leave if they are an active SESSION participant
//      (session status = 'active' and sp.status = 'accepted')
//   3. If the owner leaves and there are other members → transfer ownership
//      to the next oldest member (by joined_at)
//   4. If owner leaves and is the only member → mark room as inactive
//
const leaveRoom = async ({ u_id, room_id }) => {
  // Rule 1: Confirm active membership
  const memberResult = await db.query(
    `SELECT rm_id, role FROM room_members
     WHERE r_id = $1 AND u_id = $2 AND left_at IS NULL`,
    [room_id, u_id]
  );

  if (memberResult.rows.length === 0) {
    throw createError(404, 'You are not an active member of this room.');
  }

  const { role } = memberResult.rows[0];

  // Rule 2: Cannot leave if in an active session
  const activeSessionCheck = await db.query(
    `SELECT sp.sp_id FROM session_participants sp
     JOIN sessions s ON s.session_id = sp.session_id
     WHERE sp.u_id = $1
       AND s.r_id = $2
       AND s.status = 'active'
       AND sp.status = 'accepted'
       AND sp.left_at IS NULL
     LIMIT 1`,
    [u_id, room_id]
  );

  if (activeSessionCheck.rows.length > 0) {
    throw createError(
      409,
      'You cannot leave the room while participating in an active session. End the session first.'
    );
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Set left_at for this member
    await client.query(
      `UPDATE room_members SET left_at = NOW() WHERE r_id = $1 AND u_id = $2 AND left_at IS NULL`,
      [room_id, u_id]
    );

    // Rule 3 & 4: If the owner is leaving, handle ownership
    if (role === 'owner') {
      const remainingResult = await client.query(
        `SELECT u_id FROM room_members
         WHERE r_id = $1 AND left_at IS NULL
         ORDER BY joined_at ASC LIMIT 1`,
        [room_id]
      );

      if (remainingResult.rows.length > 0) {
        // Transfer ownership to longest-staying remaining member
        const newOwnerId = remainingResult.rows[0].u_id;
        await client.query(
          `UPDATE room_members SET role = 'owner' WHERE r_id = $1 AND u_id = $2 AND left_at IS NULL`,
          [room_id, newOwnerId]
        );
      } else {
        // No members left → deactivate room
        await client.query(
          `UPDATE rooms SET is_active = FALSE WHERE r_id = $1`,
          [room_id]
        );
      }
    }

    await client.query('COMMIT');

    return { message: 'You have successfully left the room.' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
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
