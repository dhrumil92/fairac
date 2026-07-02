const db = require('../../config/db');

const recordHeartbeat = async (device_id, mac_address, status, uptime) => {
  // Upsert the device row
  await db.query(
    `INSERT INTO devices (device_id, mac_address, status, uptime, last_heartbeat)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (device_id) DO UPDATE 
     SET mac_address = EXCLUDED.mac_address,
         status = EXCLUDED.status,
         uptime = EXCLUDED.uptime,
         last_heartbeat = NOW()`,
    [device_id, mac_address, status, uptime]
  );

  // Check for active session in the mapped room
  const roomRes = await db.query(`SELECT r_id FROM devices WHERE device_id = $1`, [device_id]);
  const r_id = roomRes.rows[0]?.r_id;

  if (r_id) {
    const sessionRes = await db.query(
      `SELECT session_id FROM sessions WHERE r_id = $1 AND status = 'active' LIMIT 1`,
      [r_id]
    );
    if (sessionRes.rows.length > 0) {
      return { success: true, active_session_id: sessionRes.rows[0].session_id };
    }
  }

  return { success: true, active_session_id: null };
};

const getDeviceStatus = async (device_id) => {
  const result = await db.query(
    `SELECT device_id, status, uptime, last_heartbeat, current_power_w,
     EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) AS seconds_since_last
     FROM devices
     WHERE device_id = $1`,
    [device_id]
  );
  
  if (result.rows.length === 0) {
    return { device_id, status: 'offline', last_seen: null };
  }

  const device = result.rows[0];
  // If we haven't heard from it in 60 seconds, consider it offline
  const isActuallyOnline = device.status === 'online' && device.seconds_since_last < 60;

  return {
    device_id: device.device_id,
    status: isActuallyOnline ? 'online' : 'offline',
    uptime: device.uptime,
    last_seen: device.last_heartbeat,
    seconds_since_last: Math.floor(device.seconds_since_last),
    current_power_w: device.current_power_w || 0,
  };
};

const recordTelemetry = async (device_id, session_id, energy_kwh, power_w) => {
  // Verify the session is still active
  const sessionRes = await db.query(
    `SELECT status FROM sessions WHERE session_id = $1`,
    [session_id]
  );

  if (sessionRes.rows.length > 0 && sessionRes.rows[0].status === 'active') {
    // Update the total units consumed by adding the new incremental amount
    await db.query(
      `UPDATE sessions SET total_units = COALESCE(total_units, 0) + $1 WHERE session_id = $2`,
      [energy_kwh, session_id]
    );
    await db.query(
      `UPDATE devices SET current_power_w = $1 WHERE device_id = $2`,
      [power_w, device_id]
    );
    return { success: true };
  }
  return { success: false, message: 'Session is not active' };
};

module.exports = {
  recordHeartbeat,
  getDeviceStatus,
  recordTelemetry,
};
