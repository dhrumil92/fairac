require('dotenv').config();
const db = require('./src/config/db');
db.query("SELECT * FROM consumption_records").then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(console.error);
