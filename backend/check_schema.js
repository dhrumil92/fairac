require('dotenv').config();
const db = require('./src/config/db');
db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'consumption_records'").then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(console.error);
