require('dotenv').config();
const db = require('./src/config/db');

async function test() {
  try {
    const res = await db.query("SELECT u_id, name, email FROM users WHERE name ILIKE '%rahul%'");
    console.log("Users with rahul:", res.rows);
  } catch(e) {
    console.error(e.message);
  } finally {
    process.exit(0);
  }
}

test();
