require('dotenv').config();
const db = require('./src/config/db');

async function test() {
  try {
    const res = await db.query(`
      SELECT sp.u_id, s.session_id, s.status, sp.status as sp_status
      FROM session_participants sp 
      JOIN sessions s ON sp.session_id = s.session_id 
      WHERE sp.left_at IS NULL AND s.status IN ('pending', 'active')
    `);
    console.log(res.rows);
  } catch (e) {
    console.error(e.message);
  } finally {
    process.exit(0);
  }
}

test();
