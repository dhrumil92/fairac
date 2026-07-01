const db = require('../../config/db');

exports.createTicket = async (req, res) => {
  try {
    const u_id = req.user.u_id;
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }

    const { rows } = await db.query(
      `INSERT INTO support_tickets (u_id, subject, message, status, seen_by_admin)
       VALUES ($1, $2, $3, 'open', false)
       RETURNING *`,
      [u_id, subject, message]
    );

    res.status(201).json({ success: true, data: rows[0], message: 'Message sent successfully.' });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Lightweight: returns count of tickets admin hasn't seen yet
exports.getUnseenCount = async (req, res) => {
  try {
    let queryStr = `SELECT COUNT(*) AS count FROM support_tickets t`;
    let queryParams = [];

    if (req.user.role === 'admin') {
      queryStr += ` JOIN users u ON t.u_id = u.u_id WHERE t.seen_by_admin = false AND u.hostel_id = $1`;
      queryParams.push(req.user.hostel_id);
    } else {
      queryStr += ` WHERE t.seen_by_admin = false`;
    }

    const { rows } = await db.query(queryStr, queryParams);
    res.json({ success: true, count: parseInt(rows[0].count, 10) });
  } catch (error) {
    console.error('Error fetching unseen count:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Called when admin opens the Support page — clears the dot
exports.markAllSeen = async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      await db.query(
        `UPDATE support_tickets SET seen_by_admin = true WHERE seen_by_admin = false AND u_id IN (SELECT u_id FROM users WHERE hostel_id = $1)`,
        [req.user.hostel_id]
      );
    } else {
      await db.query(`UPDATE support_tickets SET seen_by_admin = true WHERE seen_by_admin = false`);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking tickets as seen:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getMyTickets = async (req, res) => {
  try {
    const u_id = req.user.u_id;
    const { rows } = await db.query(
      `SELECT ticket_id, subject, message, status, created_at
       FROM support_tickets
       WHERE u_id = $1
       ORDER BY created_at DESC`,
      [u_id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching student tickets:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};


exports.getTickets = async (req, res) => {
  try {
    let queryStr = `SELECT t.ticket_id, t.subject, t.message, t.status, t.created_at,
              u.name, u.email, u.mobile,
              r.room_no
       FROM support_tickets t
       JOIN users u ON t.u_id = u.u_id
       LEFT JOIN room_members rm ON rm.u_id = u.u_id AND rm.left_at IS NULL
       LEFT JOIN rooms r ON r.r_id = rm.r_id`;
    let queryParams = [];

    if (req.user.role === 'admin') {
      queryStr += ` WHERE u.hostel_id = $1`;
      queryParams.push(req.user.hostel_id);
    }
    
    queryStr += ` ORDER BY CASE WHEN t.status = 'open' THEN 1 ELSE 2 END, t.created_at DESC`;

    const { rows } = await db.query(queryStr, queryParams);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.resolveTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `UPDATE support_tickets SET status = 'resolved' WHERE ticket_id = $1 RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    res.json({ success: true, data: rows[0], message: 'Ticket marked as resolved.' });
  } catch (error) {
    console.error('Error resolving support ticket:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
