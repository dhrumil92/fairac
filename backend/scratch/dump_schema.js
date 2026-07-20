require('dotenv').config({path: '.env'});
const db = require('../src/config/db');

async function run() {
  const query = `
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    ORDER BY table_name, ordinal_position;
  `;
  const result = await db.query(query);
  let currentTable = '';
  result.rows.forEach(row => {
    if (row.table_name !== currentTable) {
      console.log(`\nTable: ${row.table_name}`);
      currentTable = row.table_name;
    }
    console.log(`  - ${row.column_name}: ${row.data_type}`);
  });
  process.exit(0);
}
run();
