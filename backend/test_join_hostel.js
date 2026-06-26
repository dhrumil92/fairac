require('dotenv').config();
const db = require('./src/config/db');
const authService = require('./src/modules/auth/auth.service');

async function test() {
  try {
    // get a valid secret code
    const hostel = await db.query('SELECT secret_code FROM hostels LIMIT 1');
    if(hostel.rows.length === 0) {
      console.log('No hostels found');
      return;
    }
    const code = hostel.rows[0].secret_code;
    console.log('Trying to join with code:', code);
    
    // find a user with no hostel
    const user = await db.query('SELECT u_id FROM users WHERE hostel_id IS NULL LIMIT 1');
    if(user.rows.length === 0) {
      console.log('No users without hostel found');
      return;
    }
    const u_id = user.rows[0].u_id;
    console.log('Joining for user:', u_id);

    const result = await authService.joinHostel(u_id, code);
    console.log('Success:', result);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

test();
