require('dotenv').config();
const db = require('./src/config/db');
db.query(`
       SELECT COALESCE(SUM(cr.units_consumed), 0) AS last_month_units_consumed FROM consumption_records cr
        JOIN sessions s ON s.session_id = cr.session_id
        JOIN rooms r ON r.r_id = s.r_id
        WHERE date_trunc('month', cr.recorded_at) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
`).then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(console.error);
