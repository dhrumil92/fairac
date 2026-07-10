require('dotenv').config();
const db = require('./src/config/db');

async function check() {
  // Check session_participants columns
  const cols = await db.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'session_participants'
    ORDER BY ordinal_position
  `);
  console.log('session_participants columns:', JSON.stringify(cols.rows, null, 2));

  // Check wallet_transactions columns
  const wtCols = await db.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'wallet_transactions'
    ORDER BY ordinal_position
  `);
  console.log('wallet_transactions columns:', JSON.stringify(wtCols.rows, null, 2));

  // Check a recent completed session's participants to see what data we have
  const recent = await db.query(`
    SELECT s.session_id, s.status, s.total_units, s.rate_per_unit, s.start_time, s.end_time,
           sp.u_id, sp.status as sp_status, sp.joined_at, sp.left_at
    FROM sessions s
    JOIN session_participants sp ON sp.session_id = s.session_id
    WHERE s.status = 'completed'
    ORDER BY s.session_id DESC
    LIMIT 10
  `);
  console.log('Recent completed session participants:', JSON.stringify(recent.rows, null, 2));
  
  process.exit(0);
}
check();
