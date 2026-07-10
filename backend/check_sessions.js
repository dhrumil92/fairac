require('dotenv').config();
const db = require('./src/config/db');

async function checkSessions() {
  const res = await db.query("SELECT * FROM sessions WHERE status IN ('active', 'booked')");
  console.log('Stuck Sessions:', res.rows);
  process.exit(0);
}
checkSessions();
