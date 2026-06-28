require('dotenv').config();
const db = require('./src/config/db');

async function run() {
  const rooms = await db.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'rooms'");
  console.log('Rooms Table:', rooms.rows);
  process.exit(0);
}

run();
