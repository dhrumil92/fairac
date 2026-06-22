require('dotenv').config();
const iotService = require('./src/modules/iot/iot.service');

(async () => {
  try {
    const status = await iotService.getDeviceStatus('ESP32_A0B765DBC9F4');
    console.log('Status returned by service:', status);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
})();
