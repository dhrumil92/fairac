require('dotenv').config();
const db = require('./src/config/db');

async function run() {
  try {
    console.log('Creating support_tickets table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        ticket_id SERIAL PRIMARY KEY,
        u_id INTEGER REFERENCES users(u_id) ON DELETE CASCADE,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Successfully created support_tickets table!');
  } catch(e) {
    console.error('Error creating support_tickets table:', e.message);
  } finally {
    process.exit(0);
  }
}

run();
