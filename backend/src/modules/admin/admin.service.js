// =============================================================================
// src/modules/admin/admin.service.js
// Admin Dashboard Business Logic
// =============================================================================
//
// WHY SCOPE EVERY QUERY TO hostel_id?
//   Admins only manage their own hostel. If we don't filter by hostel_id,
//   an admin of Hostel A could see students, rooms, and transactions from
//   Hostel B — a serious data privacy violation.
//
//   Every function here takes `hostel_id` from `req.user.hostel_id` (set
//   in the JWT during login) and filters all queries by it.
//
// =============================================================================

const db = require('../../config/db');
const { createError } = require('../../middleware/errorHandler');

// ─── Helper: assertAdmin ──────────────────────────────────────────────────
// Ensures the caller is an admin AND has a hostel_id.
// Called at the top of every admin service function.
const assertAdmin = (user) => {
  if (user.role !== 'admin') {
    throw createError(403, 'Access denied. Admin role required.');
  }
  if (!user.hostel_id) {
    throw createError(403, 'Admin account is not linked to a hostel. Contact support.');
  }
};

// =============================================================================
// rechargeWallet
// =============================================================================
// Admin adds balance to a student's wallet.
//
// PROCESS:
//   1. Verify admin + hostel_id
//   2. Find student by email or mobile
//   3. Verify student belongs to admin's hostel (via their room membership)
//   4. Transaction: UPDATE wallet + INSERT wallet_transaction
//
// WHY VERIFY STUDENT BELONGS TO ADMIN'S HOSTEL?
//   Without this check, an admin could recharge any user in the system.
//   We restrict to students who have a room in the admin's hostel.
//
const rechargeWallet = async ({ admin, student_identifier, amount, note }) => {
  assertAdmin(admin);

  if (amount <= 0) {
    throw createError(400, 'Recharge amount must be greater than ₹0.');
  }

  // Find the student
  const studentResult = await db.query(
    `SELECT u_id, name, email, hostel_id FROM users
     WHERE (email = $1 OR mobile = $1) AND role = 'student' AND is_active = TRUE
     LIMIT 1`,
    [student_identifier.toLowerCase()]
  );

  if (studentResult.rows.length === 0) {
    throw createError(404, 'No active student found with that email or mobile number.');
  }

  const student = studentResult.rows[0];

  // Verify student belongs to this admin's hostel
  if (student.hostel_id !== admin.hostel_id) {
    throw createError(
      403,
      `${student.name} does not belong to your hostel. You can only recharge your hostel's students.`
    );
  }

  // Transaction: update wallet + add transaction record
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const walletResult = await client.query(
      `UPDATE wallets
       SET balance         = balance + $1,
           total_recharged = total_recharged + $1,
           updated_at      = NOW()
       WHERE u_id = $2
       RETURNING wallet_id, balance`,
      [amount, student.u_id]
    );

    if (walletResult.rows.length === 0) {
      throw createError(500, `No wallet found for ${student.name}. Contact support.`);
    }

    const { wallet_id, balance } = walletResult.rows[0];

    await client.query(
      `INSERT INTO wallet_transactions (wallet_id, amount, type, description)
       VALUES ($1, $2, 'recharge', $3)`,
      [
        wallet_id,
        amount,
        note || `Admin recharge by ${admin.email}`,
      ]
    );

    await client.query('COMMIT');

    return {
      student:     { u_id: student.u_id, name: student.name, email: student.email },
      amount_added: parseFloat(amount),
      new_balance:  parseFloat(balance),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// =============================================================================
// deductWallet
// =============================================================================
// Admin manually deducts from a student's wallet (correction / penalty).
//
const deductWallet = async ({ admin, student_identifier, amount, note }) => {
  assertAdmin(admin);

  if (amount <= 0) {
    throw createError(400, 'Deduction amount must be greater than ₹0.');
  }
  if (!note) {
    throw createError(400, 'A reason/note is required for manual deductions.');
  }

  const studentResult = await db.query(
    `SELECT u_id, name, email, hostel_id FROM users
     WHERE (email = $1 OR mobile = $1) AND role = 'student' AND is_active = TRUE LIMIT 1`,
    [student_identifier.toLowerCase()]
  );
  if (studentResult.rows.length === 0) {
    throw createError(404, 'Student not found.');
  }

  const student = studentResult.rows[0];

  if (student.hostel_id !== admin.hostel_id) {
    throw createError(
      403,
      `${student.name} does not belong to your hostel.`
    );
  }

  // Check wallet balance
  const walletResult = await db.query(
    `SELECT wallet_id, balance FROM wallets WHERE u_id = $1`, [student.u_id]
  );
  if (walletResult.rows.length === 0) throw createError(500, 'Wallet not found.');

  const wallet = walletResult.rows[0];
  if (parseFloat(wallet.balance) < amount) {
    throw createError(
      409,
      `Insufficient balance. Student has ₹${wallet.balance}, deduction is ₹${amount}.`
    );
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE wallets SET balance = balance - $1, total_spent = total_spent + $1, updated_at = NOW()
       WHERE u_id = $2`,
      [amount, student.u_id]
    );

    await client.query(
      `INSERT INTO wallet_transactions (wallet_id, amount, type, description)
       VALUES ($1, $2, 'adjustment', $3)`,
      [wallet.wallet_id, amount, `Admin deduction: ${note}`]
    );

    await client.query('COMMIT');

    return {
      student:       { u_id: student.u_id, name: student.name },
      amount_deducted: parseFloat(amount),
      reason:          note,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// =============================================================================
// getStudents
// =============================================================================
// Lists all students who have a room in this admin's hostel.
//
const getStudents = async ({ admin, search }) => {
  assertAdmin(admin);
  let query = `
    SELECT 
      u.u_id, u.name, u.email, u.mobile, u.is_active, u.created_at,
      w.balance,
      r.room_no,
      rm.role AS room_role
    FROM users u
    LEFT JOIN wallets w ON w.u_id = u.u_id
    LEFT JOIN room_members rm ON rm.u_id = u.u_id AND rm.left_at IS NULL
    LEFT JOIN rooms r ON r.r_id = rm.r_id
    WHERE u.role = 'student' AND u.hostel_id = $1
  `;

  const params = [admin.hostel_id];

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.mobile ILIKE $${params.length})`;
  }

  query += ` ORDER BY u.name ASC`;

  const result = await db.query(query, params);
  return result.rows;
};

// =============================================================================
// getRooms
// =============================================================================
// Lists all rooms in this admin's hostel with member counts and active sessions.
//
const getRooms = async ({ admin }) => {
  assertAdmin(admin);

  const result = await db.query(
    `SELECT
       r.r_id, r.room_no, r.room_name, r.capacity, r.rate_per_unit, r.is_active,
       (SELECT COUNT(*) FROM room_members WHERE r_id = r.r_id AND left_at IS NULL) AS member_count,
       (SELECT COUNT(*) FROM sessions WHERE r_id = r.r_id AND status = 'active') AS active_sessions,
       owner.name AS owner_name
     FROM rooms r
     LEFT JOIN users owner ON owner.u_id = r.created_by
     WHERE r.hostel_id = $1
     ORDER BY r.room_no ASC`,
    [admin.hostel_id]
  );
  return result.rows;
};

// =============================================================================
// getActiveSessions
// =============================================================================
// Lists all currently active sessions across the admin's hostel.
//
const getActiveSessions = async ({ admin }) => {
  assertAdmin(admin);

  const result = await db.query(
    `SELECT
       s.session_id, s.session_type, s.start_time,
       r.room_no, r.room_name,
       u.name AS creator_name,
       EXTRACT(EPOCH FROM (NOW() - s.start_time))/60 AS running_minutes,
       (SELECT COUNT(*) FROM session_participants
        WHERE session_id = s.session_id AND status = 'accepted') AS active_participants
     FROM sessions s
     JOIN rooms r ON r.r_id = s.r_id
     JOIN users u ON u.u_id = s.created_by
     WHERE s.status = 'active' AND r.hostel_id = $1
     ORDER BY s.start_time ASC`,
    [admin.hostel_id]
  );
  return result.rows;
};

// =============================================================================
// getDashboardOverview
// =============================================================================
// Summary stats for the admin dashboard homepage.
//
const getDashboardOverview = async ({ admin }) => {
  assertAdmin(admin);

  const result = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM rooms WHERE hostel_id = $1 AND is_active = TRUE)
         AS total_rooms,

       (SELECT COUNT(DISTINCT rm.u_id) FROM room_members rm
        JOIN rooms r ON r.r_id = rm.r_id
        WHERE r.hostel_id = $1 AND rm.left_at IS NULL)
         AS total_students,

       (SELECT COUNT(*) FROM sessions s
        JOIN rooms r ON r.r_id = s.r_id
        WHERE r.hostel_id = $1 AND s.status = 'active')
         AS active_sessions,

       (SELECT COALESCE(SUM(cr.units_consumed), 0) FROM consumption_records cr
        JOIN sessions s ON s.session_id = cr.session_id
        JOIN rooms r ON r.r_id = s.r_id
        WHERE r.hostel_id = $1)
         AS total_units_consumed,

       (SELECT COALESCE(SUM(wt.amount), 0) FROM wallet_transactions wt
        JOIN wallets w ON w.wallet_id = wt.wallet_id
        JOIN users u ON u.u_id = w.u_id
        JOIN room_members rm ON rm.u_id = u.u_id
        JOIN rooms r ON r.r_id = rm.r_id
        WHERE r.hostel_id = $1 AND wt.type = 'recharge')
         AS total_recharged,

       (SELECT COALESCE(SUM(cr.cost), 0) FROM consumption_records cr
        JOIN sessions s ON s.session_id = cr.session_id
        JOIN rooms r ON r.r_id = s.r_id
        WHERE r.hostel_id = $1)
         AS total_billed
    `,
    [admin.hostel_id]
  );

  return result.rows[0];
};

// =============================================================================
// getReports
// =============================================================================
// Generates per-room and per-student consumption reports.
//
const getReports = async ({ admin, month, year }) => {
  assertAdmin(admin);

  const targetMonth = month || new Date().getMonth() + 1;
  const targetYear  = year  || new Date().getFullYear();

  // Room-wise report
  const roomReport = await db.query(
    `SELECT
       r.room_no, r.room_name,
       COUNT(DISTINCT s.session_id)      AS sessions_count,
       COALESCE(SUM(s.total_units), 0)   AS total_units,
       COALESCE(SUM(cr.cost), 0)         AS total_cost
     FROM rooms r
     LEFT JOIN sessions s ON s.r_id = r.r_id
       AND EXTRACT(MONTH FROM s.start_time) = $2
       AND EXTRACT(YEAR  FROM s.start_time) = $3
       AND s.status = 'completed'
     LEFT JOIN consumption_records cr ON cr.session_id = s.session_id
     WHERE r.hostel_id = $1
     GROUP BY r.r_id, r.room_no, r.room_name
     ORDER BY total_cost DESC`,
    [admin.hostel_id, targetMonth, targetYear]
  );

  // Student-wise report
  const studentReport = await db.query(
    `SELECT
       u.name, u.email,
       r.room_no,
       COUNT(DISTINCT cr.session_id)         AS sessions_count,
       COALESCE(SUM(cr.units_consumed), 0)   AS total_units,
       COALESCE(SUM(cr.cost), 0)             AS total_cost
     FROM consumption_records cr
     JOIN users u ON u.u_id = cr.u_id
     JOIN sessions s ON s.session_id = cr.session_id
     JOIN rooms r ON r.r_id = s.r_id
     JOIN room_members rm ON rm.u_id = u.u_id AND rm.r_id = r.r_id
     WHERE r.hostel_id = $1
       AND EXTRACT(MONTH FROM cr.recorded_at) = $2
       AND EXTRACT(YEAR  FROM cr.recorded_at) = $3
     GROUP BY u.u_id, u.name, u.email, r.room_no
     ORDER BY total_cost DESC`,
    [admin.hostel_id, targetMonth, targetYear]
  );

  return {
    period:  { month: targetMonth, year: targetYear },
    by_room: roomReport.rows,
    by_student: studentReport.rows,
  };
};

// =============================================================================
// getTransactions
// =============================================================================
// Gets all wallet transactions for the admin's hostel.
//
const getTransactions = async ({ admin, page = 1, limit = 7 }) => {
  assertAdmin(admin);

  const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 7));
  const offset   = (pageNum - 1) * limitNum;

  const result = await db.query(
    `SELECT
       wt.txn_id, wt.amount, wt.type, wt.description, wt.created_at,
       u.name as student_name, u.email as student_email,
       w.balance,
       COUNT(*) OVER() AS total_count
     FROM wallet_transactions wt
     JOIN wallets w ON w.wallet_id = wt.wallet_id
     JOIN users u ON u.u_id = w.u_id
     JOIN room_members rm ON rm.u_id = u.u_id AND rm.left_at IS NULL
     JOIN rooms r ON r.r_id = rm.r_id
     WHERE r.hostel_id = $1
     ORDER BY wt.created_at DESC
     LIMIT $2 OFFSET $3`,
    [admin.hostel_id, limitNum, offset]
  );

  const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
  const totalPages = Math.ceil(total / limitNum);

  return {
    transactions: result.rows.map((row) => {
      const { total_count, ...txn } = row;
      return txn;
    }),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      total_pages: totalPages,
      has_next: pageNum < totalPages,
      has_prev: pageNum > 1,
    },
  };
};

// =============================================================================
// Admin Room Management Settings (Modal)
// =============================================================================

const getRoomDetails = async ({ admin, room_id }) => {
  assertAdmin(admin);

  const roomResult = await db.query(
    `SELECT * FROM rooms WHERE r_id = $1 AND hostel_id = $2 LIMIT 1`,
    [room_id, admin.hostel_id]
  );
  if (roomResult.rows.length === 0) throw createError(404, 'Room not found in your hostel.');
  const room = roomResult.rows[0];

  const membersResult = await db.query(
    `SELECT u.u_id, u.name, u.email, u.mobile, rm.role, rm.joined_at
     FROM room_members rm
     JOIN users u ON u.u_id = rm.u_id
     WHERE rm.r_id = $1 AND rm.left_at IS NULL
     ORDER BY rm.joined_at ASC`,
    [room_id]
  );

  return { room, members: membersResult.rows };
};

const removeMemberFromRoom = async ({ admin, room_id, u_id }) => {
  assertAdmin(admin);

  const roomCheck = await db.query(`SELECT r_id FROM rooms WHERE r_id = $1 AND hostel_id = $2`, [room_id, admin.hostel_id]);
  if (roomCheck.rows.length === 0) throw createError(404, 'Room not found in your hostel.');

  const memberResult = await db.query(`SELECT rm_id, role FROM room_members WHERE r_id = $1 AND u_id = $2 AND left_at IS NULL`, [room_id, u_id]);
  if (memberResult.rows.length === 0) throw createError(404, 'User is not an active member of this room.');
  const { role } = memberResult.rows[0];

  const activeSessionCheck = await db.query(
    `SELECT sp.sp_id FROM session_participants sp
     JOIN sessions s ON s.session_id = sp.session_id
     WHERE sp.u_id = $1 AND s.r_id = $2 AND s.status = 'active' AND sp.status = 'accepted' AND sp.left_at IS NULL LIMIT 1`,
    [u_id, room_id]
  );
  if (activeSessionCheck.rows.length > 0) throw createError(409, 'Cannot remove user while they are participating in an active session. End the session first.');

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    await client.query(`UPDATE room_members SET left_at = NOW() WHERE r_id = $1 AND u_id = $2 AND left_at IS NULL`, [room_id, u_id]);

    if (role === 'owner') {
      const remainingResult = await client.query(`SELECT u_id FROM room_members WHERE r_id = $1 AND left_at IS NULL ORDER BY joined_at ASC LIMIT 1`, [room_id]);
      if (remainingResult.rows.length > 0) {
        await client.query(`UPDATE room_members SET role = 'owner' WHERE r_id = $1 AND u_id = $2 AND left_at IS NULL`, [room_id, remainingResult.rows[0].u_id]);
      } else {
        await client.query(`UPDATE rooms SET is_active = FALSE WHERE r_id = $1`, [room_id]);
      }
    }
    await client.query('COMMIT');
    return { message: 'Successfully removed member from the room.' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const inviteStudentToRoom = async ({ admin, room_id, identifier }) => {
  assertAdmin(admin);

  const roomCheck = await db.query(`SELECT r_id, capacity FROM rooms WHERE r_id = $1 AND hostel_id = $2`, [room_id, admin.hostel_id]);
  if (roomCheck.rows.length === 0) throw createError(404, 'Room not found in your hostel.');
  const room = roomCheck.rows[0];

  const inviteeResult = await db.query(`SELECT u_id, name, email, hostel_id FROM users WHERE email = $1 OR mobile = $1 LIMIT 1`, [identifier.toLowerCase()]);
  if (inviteeResult.rows.length === 0) throw createError(404, 'No registered user found with that email or mobile number.');
  const invitee = inviteeResult.rows[0];

  const existingMembership = await db.query(`SELECT r.room_no FROM room_members rm JOIN rooms r ON r.r_id = rm.r_id WHERE rm.u_id = $1 AND rm.left_at IS NULL AND r.is_active = TRUE LIMIT 1`, [invitee.u_id]);
  if (existingMembership.rows.length > 0) throw createError(409, `${invitee.name} is already an active member of Room ${existingMembership.rows[0].room_no}.`);

  const countResult = await db.query(`SELECT COUNT(*) as cnt FROM room_members WHERE r_id = $1 AND left_at IS NULL`, [room_id]);
  if (parseInt(countResult.rows[0].cnt) >= parseInt(room.capacity)) throw createError(409, 'Room is full.');

  const existingInvite = await db.query(`SELECT status FROM room_invitations WHERE room_id = $1 AND sent_to = $2`, [room_id, invitee.u_id]);
  if (existingInvite.rows.length > 0) {
    if (existingInvite.rows[0].status === 'pending') throw createError(409, `${invitee.name} already has a pending invitation for this room.`);
    await db.query(`DELETE FROM room_invitations WHERE room_id = $1 AND sent_to = $2`, [room_id, invitee.u_id]);
  }

  await db.query(
    `INSERT INTO room_invitations (room_id, sent_by, sent_to, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '48 hours')`,
    [room_id, admin.u_id, invitee.u_id]
  );

  return { message: `Invitation sent to ${invitee.name}.` };
};

module.exports = {
  rechargeWallet,
  deductWallet,
  getStudents,
  getRooms,
  getActiveSessions,
  getDashboardOverview,
  getReports,
  getTransactions,
  getRoomDetails,
  removeMemberFromRoom,
  inviteStudentToRoom,
};
