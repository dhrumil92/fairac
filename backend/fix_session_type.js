require('dotenv').config();
const db = require('./src/config/db');

async function fixTypes() {
  await db.query("UPDATE sessions SET session_type = 'budget' WHERE session_type = 'unlimited' AND start_time > NOW() - INTERVAL '1 day'");
  console.log('Fixed session types');
  process.exit(0);
}
fixTypes();
