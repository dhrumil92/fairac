require('dotenv').config();
const db = require('./src/config/db');

async function run() {
  try {
    console.log('Running migration...');
    // 1. Add column
    await db.query(`ALTER TABLE hostels ADD COLUMN hostel_code VARCHAR(50) UNIQUE;`);
    console.log('Added hostel_code column to hostels table');
  } catch(e) {
    console.error('Error adding hostel_code (might already exist):', e.message);
  }

  try {
    // 2. Assign default code to ABC Boys Hostel
    await db.query(`UPDATE hostels SET hostel_code = 'ABC-2026' WHERE name = 'ABC Boys Hostel'`);
    console.log('Assigned ABC-2026 code to ABC Boys Hostel');
  } catch(e) {
    console.error('Error updating hostel_code:', e.message);
  }

  process.exit(0);
}

run();
