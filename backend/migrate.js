require('dotenv').config();
const db = require('./src/config/db');

async function run() {
  try {
    console.log('Running migration...');
    await db.query(`ALTER TABLE session_participants ADD COLUMN leave_status VARCHAR(20) DEFAULT 'none' CHECK (leave_status IN ('none', 'pending'))`);
    console.log('Added leave_status to session_participants');
  } catch(e) {
    console.error('Error adding leave_status (might already exist):', e.message);
  }

  try {
    await db.query(`UPDATE rooms SET rate_per_unit = 10.00`);
    console.log('Updated rate_per_unit to 10.00 for all rooms');
  } catch(e) {
    console.error('Error updating rooms:', e.message);
  }

  // Also clean up any active sessions to fix the bug where "session is on by default"
  try {
    await db.query(`UPDATE sessions SET status = 'completed' WHERE status = 'active' OR status = 'pending'`);
    console.log('Cleared all active/pending sessions to reset state.');
  } catch(e) {
    console.error('Error clearing sessions:', e.message);
  }

  process.exit(0);
}

run();
