require('dotenv').config();
const db = require('./src/config/db');
const { getDashboardOverview } = require('./src/modules/admin/admin.service');

async function check() {
  const admin = { hostel_id: 1, role: 'admin' };
  try {
    const data = await getDashboardOverview({ admin });
    console.log('Dashboard overview:', data);
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
check();
