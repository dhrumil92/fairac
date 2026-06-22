const express = require('express');
const controller = require('./iot.controller');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

// Public endpoint for ESP32
router.post('/heartbeat', controller.heartbeat);

// Public endpoint for ESP32 Telemetry
router.post('/telemetry', controller.telemetry);

// Protected endpoint for Frontend
router.get('/status/:device_id', authenticate, controller.getStatus);
router.get('/room/:r_id/status', authenticate, controller.getStatusByRoom);

module.exports = router;
