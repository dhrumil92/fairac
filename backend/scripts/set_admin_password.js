require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function run() {
  const hash = await bcrypt.hash('Admin@1234', 10);
  const result = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE u_id = 1 RETURNING u_id, name, email, role, hostel_id',
    [hash]
  );
  console.log('Admin updated:', result.rows[0]);
  await pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
