const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/modules/admin/admin.service.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace standard cases where admin.hostel_id is used.
content = content.replace(/r\.hostel_id = \$1/g, "($1::int IS NULL OR r.hostel_id = $1)");
content = content.replace(/hostel_id = \$1/g, "($1::int IS NULL OR hostel_id = $1)");

// For getRoomDetails where it's $2
content = content.replace(/hostel_id = \$2/g, "($2::int IS NULL OR hostel_id = $2)");

fs.writeFileSync(filePath, content);
console.log('Successfully refactored admin.service.js');
