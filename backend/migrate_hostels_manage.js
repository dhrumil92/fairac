require('dotenv').config();
const db = require('./src/config/db');

async function run() {
  try {
    console.log('Adding is_active to hostels table...');
    await db.query(`ALTER TABLE hostels ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`);
    
    console.log('Adding rate_per_unit to hostels table...');
    await db.query(`ALTER TABLE hostels ADD COLUMN IF NOT EXISTS rate_per_unit NUMERIC(10,2) DEFAULT 10.00;`);
    
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

run();
