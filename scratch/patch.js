const fs = require('fs');
let content = fs.readFileSync('src/lib/statistics-sync.ts', 'utf8');

content = content.replace(
    'if (a.activity_type === "daily_visit") {',
    'if (a.activity_type === "login" || a.activity_type === "daily_visit") {'
);

const targetStr = `                 if (a.activity_type === "report_view") activityMap[a.user_id].reportView++;
             });
        }`;

const insertStr = `
        const { data: loginLogs } = await supabase
            .from("login_logs")
            .select("user_id")
            .gte("login_time", startDate + "T00:00:00+09:00")
            .lte("login_time", endDate + "T23:59:59+09:00")
            .in("user_id", athleteIds)
            .then(res => res, err => ({ data: [] }));

        if (loginLogs && !('error' in loginLogs && loginLogs.error)) {
             (loginLogs).forEach((l) => {
                 if (!l.user_id || !activityMap[l.user_id]) return;
                 activityMap[l.user_id].login++;
             });
        }
`;

content = content.replace(targetStr, targetStr + insertStr);

fs.writeFileSync('src/lib/statistics-sync.ts', content);
