require('dotenv').config();
const db = require('./src/config/db');

async function check() {
  const r = await db.query(`
    SELECT constraint_name, constraint_type 
    FROM information_schema.table_constraints 
    WHERE table_name = 'consumption_records'
  `);
  console.log('Constraints:', JSON.stringify(r.rows, null, 2));

  const cols = await db.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'consumption_records'
    ORDER BY ordinal_position
  `);
  console.log('Columns:', JSON.stringify(cols.rows, null, 2));
  process.exit(0);
}
check();
