require('dotenv').config();
const db = require('./src/config/db');
db.query("SELECT CURRENT_DATE, CURRENT_TIMESTAMP, date_trunc('month', CURRENT_DATE - INTERVAL '1 month') as last_month").then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(console.error);
