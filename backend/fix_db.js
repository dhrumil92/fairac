require('dotenv').config();
const db = require('./src/config/db');

async function fixDB() {
  try {
    // 1. Force end all sessions to fix the "active by default" issue
    console.log("Checking active sessions...");
    const active = await db.query(`SELECT session_id, status FROM sessions WHERE status IN ('active', 'pending')`);
    console.log("Found sessions:", active.rows);
    if (active.rows.length > 0) {
      await db.query(`UPDATE sessions SET status = 'completed' WHERE status IN ('active', 'pending')`);
      console.log("Marked sessions as completed.");
    }

    // 2. Add or update wallet for raj@test.com to 500
    console.log("Updating wallet for raj@test.com...");
    const userRes = await db.query(`SELECT u_id FROM users WHERE email = 'raj@test.com'`);
    if (userRes.rows.length > 0) {
      const raj_u_id = userRes.rows[0].u_id;
      const walletRes = await db.query(`SELECT wallet_id FROM wallets WHERE u_id = $1`, [raj_u_id]);
      if (walletRes.rows.length > 0) {
        await db.query(`UPDATE wallets SET balance = 500.00 WHERE u_id = $1`, [raj_u_id]);
      } else {
        await db.query(`INSERT INTO wallets (u_id, balance, total_recharged) VALUES ($1, 500.00, 500.00)`, [raj_u_id]);
      }
      console.log("Wallet updated.");
    } else {
      console.log("User raj@test.com not found!");
    }

    // 3. Check room members for dhrum (or raj)
    console.log("Checking room members...");
    const allRm = await db.query(`SELECT rm.u_id, rm.r_id, rm.role, u.email FROM room_members rm JOIN users u ON rm.u_id = u.u_id`);
    console.log("Room members:", allRm.rows);

  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
fixDB();
