const http = require('http');

const data = JSON.stringify({
  name: 'palak test2',
  email: `palaktest2${Date.now()}@gmail.com`,
  mobile: `99${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
  password: 'Password123',
  secret_code: 'SMJV-ADB-G' 
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let responseBody = '';
  res.on('data', (chunk) => { responseBody += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', responseBody);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
