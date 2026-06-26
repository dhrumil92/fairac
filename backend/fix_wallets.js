require('dotenv').config();
const db = require('./src/config/db');

async function run() {
  try {
    await db.query('ALTER TABLE wallets DROP CONSTRAINT chk_wallet_balance');
    console.log('Successfully dropped chk_wallet_balance constraint');
  } catch (err) {
    console.error('Error dropping constraint:', err.message);
  } finally {
    process.exit(0);
  }
}

run();
