const db = require('../../config/db');
const sessionsService = require('./sessions.service');

// Removed simulation AC power constant

const checkAndEndSessions = async () => {
  try {
    // 1. Fetch active sessions with limits
      const result = await db.query(
        `SELECT s.*, r.rate_per_unit,
                EXTRACT(EPOCH FROM (NOW() - d.last_heartbeat)) AS seconds_since_last
         FROM sessions s
         JOIN rooms r ON r.r_id = s.r_id
         LEFT JOIN devices d ON d.r_id = s.r_id
         WHERE s.status = 'active'`
      );

    const activeSessions = result.rows;

    for (const session of activeSessions) {
      const startTime = new Date(session.start_time).getTime();
      const now = new Date().getTime();
      const elapsedHours = (now - startTime) / (1000 * 60 * 60);
      
      const currentKwh = session.total_units ? parseFloat(session.total_units) : 0.00;
      const currentCost = currentKwh * session.rate_per_unit;
      
      let shouldEnd = false;
      let endReason = '';

      // Check for device offline timeout (> 5 minutes = 300 seconds)
      if (session.seconds_since_last !== null && session.seconds_since_last > 300) {
        shouldEnd = true;
        endReason = 'Device offline > 5 mins';
      }


      if (session.session_type === 'duration' && elapsedHours >= session.target_value) {
        shouldEnd = true;
      } else if (session.session_type === 'unit' && currentKwh >= session.target_value) {
        shouldEnd = true;
      } else if (session.session_type === 'budget' && currentCost >= session.target_value) {
        shouldEnd = true;
      }

      if (shouldEnd) {
        console.log(`[Worker] Auto-ending session ${session.session_id}. Reason: ${endReason || 'Target reached'}`);
        try {
          await sessionsService.endSession({
            u_id: session.created_by, // act as creator to end it
            session_id: session.session_id,
            total_units: currentKwh.toFixed(4)
          });
          console.log(`[Worker] Session ${session.session_id} ended successfully.`);
        } catch (err) {
          console.error(`[Worker] Failed to end session ${session.session_id}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('[Worker] Error checking sessions:', err.message);
  }
};

// Run the check every 15 seconds
console.log('⏱️ AC Session Auto-Termination Worker Started');
setInterval(checkAndEndSessions, 15000);

module.exports = { checkAndEndSessions };
