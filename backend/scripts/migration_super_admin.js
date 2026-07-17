require('dotenv').config(); 
const bcrypt = require('bcryptjs');
const db = require('../src/config/db'); // Adjust path as needed

async function run() {
  try {
    console.log('Running super admin migration...');
    
    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
  // Use SUPER_ADMIN_PASSWORD from environment variable — NEVER hardcode passwords in source code.
  // Run: SUPER_ADMIN_PASSWORD=YourStrongPass node scripts/migration_super_admin.js
  const rawPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!rawPassword) {
    console.error('❌ SUPER_ADMIN_PASSWORD env variable is required. Aborting.');
    process.exit(1);
  }
  const hashedPassword = await bcrypt.hash(rawPassword, saltRounds);

    // Check if user exists
    const check = await db.query(`SELECT * FROM users WHERE email = $1`, ['super.admin@fairac.com']);
    if (check.rows.length > 0) {
      console.log('Super admin already exists. Updating password and role...');
      await db.query(
        `UPDATE users SET password_hash = $1, role = 'super_admin' WHERE email = $2`,
        [hashedPassword, 'super.admin@fairac.com']
      );
    } else {
      console.log('Creating super admin...');
      await db.query(
        `INSERT INTO users (name, email, mobile, password_hash, role) VALUES ($1, $2, $3, $4, $5)`,
        ['Super Admin', 'super.admin@fairac.com', '9999999999', hashedPassword, 'super_admin']
      );
    }
    
    console.log('Super admin migration completed successfully.');
  } catch(e) {
    console.error('Error during migration:', e.message);
  } finally {
    process.exit(0);
  }
}

run();
