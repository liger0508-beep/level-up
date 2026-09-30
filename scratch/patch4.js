const fs = require('fs');
let content = fs.readFileSync('src/lib/statistics-sync.ts', 'utf8');

const insertStr = `
        const { data: loginLogs } = await supabase
            .from("login_logs")
            .select("user_id, created_at")
            .gte("created_at", startDate + "T00:00:00+09:00")
            .lte("created_at", endDate + "T23:59:59+09:00")
            .in("user_id", athleteIds)
            .then(res => res, err => ({ data: [] }));

        if (loginLogs && !('error' in loginLogs && loginLogs.error)) {
             (loginLogs).forEach((l) => {
                 if (!l.user_id || !activityMap[l.user_id]) return;
                 activityMap[l.user_id].login++;
             });
        }
`;

content = content.replace(/(\s+if \(a\.activity_type === "report_view"\) activityMap\[a\.user_id\]\.reportView\+\+;\s+\}\);\s+\})/, '$1' + insertStr);

fs.writeFileSync('src/lib/statistics-sync.ts', content);
console.log('Athletes login_logs inserted');
