const db = require('./backend/src/config/db');

async function seed() {
  const res = await db.query('SELECT count(*) FROM hostels');
  if (parseInt(res.rows[0].count) === 0) {
    console.log('No hostels found. Inserting defaults...');
    await db.query(`INSERT INTO hostels (name, address) VALUES ('Hostel A (Boys)', 'North Campus')`);
    await db.query(`INSERT INTO hostels (name, address) VALUES ('Hostel B (Girls)', 'South Campus')`);
    console.log('Inserted default hostels.');
  } else {
    console.log('Hostels exist. Count:', res.rows[0].count);
  }
  process.exit();
}

seed().catch(console.error);
