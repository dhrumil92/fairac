require('dotenv').config();
const db = require('./src/config/db');

async function run() {
  try {
    const res = await db.query('SELECT hostel_code FROM hostels LIMIT 1');
    console.log(res.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

run();
