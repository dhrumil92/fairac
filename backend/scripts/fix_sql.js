const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../src/modules/admin/admin.service.js');

let content = fs.readFileSync(file, 'utf8');

// Fix the doubly wrapped ones first
content = content.replace(/\(\$1::int IS NULL OR r\.\(\$1::int IS NULL OR hostel_id = \$1\)\)/g, '($1::int IS NULL OR r.hostel_id = $1)');

// Fix the single ones
content = content.replace(/r\.\(\$1::int IS NULL OR hostel_id = \$1\)/g, '($1::int IS NULL OR r.hostel_id = $1)');
content = content.replace(/u\.\(\$1::int IS NULL OR hostel_id = \$1\)/g, '($1::int IS NULL OR u.hostel_id = $1)');

fs.writeFileSync(file, content);
console.log('Fixed SQL syntax errors');
