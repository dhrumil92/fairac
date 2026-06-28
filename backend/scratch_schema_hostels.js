require('dotenv').config();
const db = require('./src/config/db');

async function run() {
  const hostels = await db.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'hostels'");
  console.log('Hostels Table:', hostels.rows);
  process.exit(0);
}

run();
