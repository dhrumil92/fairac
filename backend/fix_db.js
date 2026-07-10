require('dotenv').config();
const db = require('./src/config/db');

async function run() {
  const client = await db.getClient();
  try {
    await client.query("ALTER TABLE sessions DROP CONSTRAINT IF EXISTS chk_sess_type;");
    await client.query("ALTER TABLE sessions ADD CONSTRAINT chk_sess_type CHECK (session_type IN ('unlimited', 'budget', 'unit', 'duration', 'units', 'amount'));");
    console.log("Database constraint updated successfully!");
  } catch (err) {
    console.error("Error updating constraint:", err);
  } finally {
    client.release();
    process.exit();
  }
}

run();
