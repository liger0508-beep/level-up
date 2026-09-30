const fs = require('fs');
let content = fs.readFileSync('src/lib/statistics-sync.ts', 'utf8');

const insertStr = `
        // Query scorecards table
        const { data: scorecards } = await supabase
            .from('scorecards')
            .select('athlete_id, round_date')
            .gte('round_date', startDate)
            .lte('round_date', endDate)
            .in('athlete_id', athleteIds);

        if (scorecards) {
            scorecards.forEach(sc => {
                if (recordsMap[sc.athlete_id]) {
                    recordsMap[sc.athlete_id].score++;
                }
            });
        }

        // Query test_sessions table
        const { data: tests } = await supabase
            .from('test_sessions')
            .select('user_id, created_at')
            .gte('created_at', startDate + 'T00:00:00+09:00')
            .lte('created_at', endDate + 'T23:59:59+09:00')
            .in('user_id', athleteIds);

        if (tests) {
            tests.forEach(t => {
                if (recordsMap[t.user_id]) {
                    recordsMap[t.user_id].challenge++;
                }
            });
        }
`;

content = content.replace(/(\s+\/\/ 6\. Fetch Consultations)/, '\n' + insertStr + '$1');

// Remove the incorrect counting from the old loop
content = content.replace('if (r.type === "scorecard") map.score++;', '');
content = content.replace('if (r.type === "challenge") map.challenge++;', '');

fs.writeFileSync('src/lib/statistics-sync.ts', content);
console.log('Patch success');
