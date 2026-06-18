require('dotenv').config();
const db = require('./src/config/db');
const sessionsService = require('./src/modules/sessions/sessions.service');

(async () => {
  try {
    const active = await sessionsService.getActiveSession(8);
    console.log(JSON.stringify(active, null, 2));
  } catch (err) {
    console.error(err);
  }
  process.exit();
})();
