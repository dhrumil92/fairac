require('dotenv').config();
const db = require('./src/config/db');

async function refundAll() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    // Find all stuck booked sessions
    const res = await client.query("SELECT * FROM sessions WHERE status = 'booked'");
    
    for (let s of res.rows) {
      const refund = parseFloat(s.target_value) * parseFloat(s.rate_per_unit);
      
      // Mark cancelled
      await client.query("UPDATE sessions SET status = 'cancelled' WHERE session_id = $1", [s.session_id]);
      
      // Refund wallet
      await client.query("UPDATE wallets SET balance = balance + $1 WHERE u_id = $2", [refund, s.created_by]);
      
      // Get wallet ID
      const w = await client.query("SELECT wallet_id FROM wallets WHERE u_id = $1", [s.created_by]);
      
      // Log transaction
      await client.query(
        "INSERT INTO wallet_transactions (wallet_id, session_id, amount, type, description) VALUES ($1, $2, $3, 'recharge', 'Refund stuck booked session')",
        [w.rows[0].wallet_id, s.session_id, refund]
      );
      
      console.log('Refunded session', s.session_id, refund);
    }
    
    await client.query('COMMIT');
    console.log('All stuck sessions refunded.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}
refundAll();
