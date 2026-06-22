const iotService = require('./iot.service');
const db = require('../../config/db');

const heartbeat = async (req, res, next) => {
  try {
    const { device_id, mac_address, status, uptime } = req.body;
    if (!device_id) {
      return res.status(400).json({ success: false, message: 'device_id is required' });
    }
    const result = await iotService.recordHeartbeat(device_id, mac_address, status || 'online', uptime || 0);
    res.status(200).json({ success: true, message: 'Heartbeat recorded', active_session_id: result.active_session_id });
  } catch (error) {
    next(error);
  }
};

const getStatus = async (req, res, next) => {
  try {
    const { device_id } = req.params;
    const status = await iotService.getDeviceStatus(device_id);
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
};

const telemetry = async (req, res, next) => {
  try {
    const { device_id, session_id, energy_kwh, power_w } = req.body;
    if (!device_id || !session_id) {
      return res.status(400).json({ success: false, message: 'device_id and session_id required' });
    }
    const result = await iotService.recordTelemetry(device_id, session_id, energy_kwh, power_w);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getStatusByRoom = async (req, res, next) => {
  try {
    const { r_id } = req.params;
    const deviceRes = await db.query(`SELECT device_id FROM devices WHERE r_id = $1 LIMIT 1`, [r_id]);
    
    if (deviceRes.rows.length === 0) {
      return res.status(200).json({ success: true, data: { status: 'offline', last_seen: null } });
    }
    
    const status = await iotService.getDeviceStatus(deviceRes.rows[0].device_id);
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  heartbeat,
  getStatus,
  telemetry,
  getStatusByRoom,
};
