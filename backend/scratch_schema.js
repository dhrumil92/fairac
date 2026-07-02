require('dotenv').config();
const db = require('./src/config/db');

async function run() {
  const sessions = await db.query("SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'sessions'");
  console.log('Sessions:', sessions.rows);
  process.exit(0);
}

run();
