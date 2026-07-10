require('dotenv').config();
const db = require('./src/config/db');

async function fixParticipants() {
  const res = await db.query("SELECT * FROM sessions WHERE status = 'booked'");
  for (let s of res.rows) {
    try {
      await db.query("INSERT INTO session_participants (session_id, u_id, status, joined_at) VALUES ($1, $2, 'accepted', NOW()) ON CONFLICT DO NOTHING", [s.session_id, s.created_by]);
    } catch (e) {
      // Ignore
    }
  }
  console.log('Fixed stuck participants');
  process.exit(0);
}
fixParticipants();
