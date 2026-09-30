const fs = require('fs');

let syncContent = fs.readFileSync('src/lib/statistics-sync.ts', 'utf8');

syncContent = syncContent.replace(
    '.gte("login_time", startDate + "T00:00:00+09:00")',
    '.gte("created_at", startDate + "T00:00:00+09:00")'
);
syncContent = syncContent.replace(
    '.lte("login_time", endDate + "T23:59:59+09:00")',
    '.lte("created_at", endDate + "T23:59:59+09:00")'
);
syncContent = syncContent.replace(
    '.select("user_id, login_time")',
    '.select("user_id, created_at")'
);
syncContent = syncContent.replace(
    '.gte("login_time", startDate + "T00:00:00+09:00")',
    '.gte("created_at", startDate + "T00:00:00+09:00")'
);
syncContent = syncContent.replace(
    '.lte("login_time", endDate + "T23:59:59+09:00")',
    '.lte("created_at", endDate + "T23:59:59+09:00")'
);
syncContent = syncContent.replace(
    'const date = l.login_time.split("T")[0];',
    'const date = l.created_at.split("T")[0];'
);

fs.writeFileSync('src/lib/statistics-sync.ts', syncContent);
console.log('Fixed login_logs schema');
