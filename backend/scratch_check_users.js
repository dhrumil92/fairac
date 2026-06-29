require('dotenv').config();
const db = require('./src/config/db');

async function run() {
  const rm = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'room_members' ORDER BY ordinal_position`);
  console.log('room_members columns:', rm.rows.map(x => x.column_name).join(', '));

  // Sample data to see the join
  const sample = await db.query(`SELECT rm.u_id, r.room_no FROM room_members rm JOIN rooms r ON rm.r_id = r.r_id LIMIT 5`);
  console.log('sample room_members:', sample.rows);

  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
