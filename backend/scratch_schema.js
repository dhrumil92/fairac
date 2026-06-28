require('dotenv').config();
const db = require('./src/config/db');

async function run() {
  const hostels = await db.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'hostels'");
  const users = await db.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'users'");
  
  console.log('Hostels:', hostels.rows);
  console.log('Users:', users.rows);
  process.exit(0);
}

run();
