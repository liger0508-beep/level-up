const fs = require('fs');
let content = fs.readFileSync('src/lib/statistics-sync.ts', 'utf8');

// Replace login tracking
const loginTarget = `        const activityMap: Record<string, { login: number, reportView: number }> = {};
        athleteIds.forEach(id => {
            activityMap[id] = { login: 0, reportView: 0 };
        });

        if (activities && !('error' in activities && activities.error)) {
             (activities as any).forEach((a: any) => {
                 if (!a.user_id || !activityMap[a.user_id]) return;
                 if (a.activity_type === "login") activityMap[a.user_id].login++;
                 if (a.activity_type === "report_view") activityMap[a.user_id].reportView++;
             });
        }`;
const loginReplacement = `        const { data: loginLogs } = await supabase
            .from("login_logs")
            .select("user_id")
            .gte("login_time", startDate + "T00:00:00+09:00")
            .lte("login_time", endDate + "T23:59:59+09:00")
            .in("user_id", athleteIds)
            .then(res => res, err => ({ data: [] }));

        const activityMap: Record<string, { login: number, reportView: number }> = {};
        athleteIds.forEach(id => {
            activityMap[id] = { login: 0, reportView: 0 };
        });

        if (activities && !('error' in activities && activities.error)) {
             (activities as any).forEach((a: any) => {
                 if (!a.user_id || !activityMap[a.user_id]) return;
                 if (a.activity_type === "daily_visit") activityMap[a.user_id].login++;
                 if (a.activity_type === "report_view") activityMap[a.user_id].reportView++;
             });
        }
        
        if (loginLogs && !('error' in loginLogs && loginLogs.error)) {
             (loginLogs as any).forEach((l: any) => {
                 if (!l.user_id || !activityMap[l.user_id]) return;
                 activityMap[l.user_id].login++;
             });
        }`;

content = content.replace(loginTarget, loginReplacement);
fs.writeFileSync('src/lib/statistics-sync.ts', content);
