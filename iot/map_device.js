// Run this script to map your ESP32 to Room 343
// Usage: node map_device.js <ESP32_MAC_ID>
// Example: node map_device.js ESP32_A1B2C3D4E5

require('dotenv').config({ path: '../backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fairac_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'admin123',
});

(async () => {
  const deviceId = process.argv[2];
  if (!deviceId) {
    console.error('❌ Please provide the Device ID printed in the Serial Monitor.');
    console.log('Example: node map_device.js ESP32_A1B2C3D4E5');
    process.exit(1);
  }

  const roomNo = '343'; // Target room

  try {
    // 1. Get room ID
    const roomRes = await pool.query('SELECT r_id FROM rooms WHERE room_no = $1', [roomNo]);
    if (roomRes.rows.length === 0) {
      console.error(`❌ Room ${roomNo} not found in database!`);
      process.exit(1);
    }
    const rId = roomRes.rows[0].r_id;

    // 2. Map the device
    await pool.query(
      `INSERT INTO devices (device_id, r_id, status) VALUES ($1, $2, 'offline')
       ON CONFLICT (device_id) DO UPDATE SET r_id = EXCLUDED.r_id`,
      [deviceId, rId]
    );

    console.log(`✅ Successfully mapped Device ID [${deviceId}] to Room [${roomNo}] (r_id: ${rId})`);
  } catch (err) {
    console.error('❌ Database error:', err.message);
  } finally {
    pool.end();
  }
})();
