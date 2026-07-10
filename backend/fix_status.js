const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function fix() {
  try {
    await pool.query('ALTER TABLE sessions DROP CONSTRAINT IF EXISTS chk_sess_status;');
    await pool.query("ALTER TABLE sessions ADD CONSTRAINT chk_sess_status CHECK (status IN ('active', 'completed', 'cancelled', 'booked'));");
    console.log('Fixed constraint chk_sess_status successfully!');
  } catch (err) {
    console.error('Error fixing constraint:', err);
  } finally {
    pool.end();
  }
}

fix();
