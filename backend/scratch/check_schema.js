const { Pool } = require('pg');
require('dotenv').config({path: '../.env'});
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function run() {
  try {
    const cons = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND conname LIKE 'chk_%'
    `);
    console.log("=== CHECK CONSTRAINTS ===");
    console.log(cons.rows);

    const cols = await pool.query(`
      SELECT table_name, column_name, data_type, character_maximum_length, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `);
    console.log("\n=== COLUMNS ===");
    console.log(cols.rows.filter(r => ['role', 'status', 'type', 'session_type', 'balance'].includes(r.column_name)));

  } finally {
    pool.end();
  }
}
run();
