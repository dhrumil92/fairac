require('dotenv').config();
const db = require('./src/config/db');

async function run() {
  try {
    await db.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS seen_by_admin BOOLEAN DEFAULT FALSE`);
    console.log('Added seen_by_admin column');
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}
run();
