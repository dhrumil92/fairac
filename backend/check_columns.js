require('dotenv').config();
const db = require('./src/config/db');

async function checkCols() {
  const res = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sessions'");
  console.log('Columns:', res.rows.map(r => r.column_name));
  process.exit(0);
}
checkCols();
