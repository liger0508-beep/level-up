const fs = require('fs');

// Patch statistics-sync.ts
let syncContent = fs.readFileSync('src/lib/statistics-sync.ts', 'utf8');

syncContent = syncContent.replace('trainingLog: number;', 'trainingLog: number;\n    trainingPlan: number;');

syncContent = syncContent.replace(
    'journal: number, challenge: number }> = {};',
    'journal: number, challenge: number, trainingPlan: number }> = {};'
);

syncContent = syncContent.replace(
    'journal: 0, challenge: 0 };',
    'journal: 0, challenge: 0, trainingPlan: 0 };'
);

syncContent = syncContent.replace(
    'if (r.type === "journal") map.journal++;',
    'if (r.type === "journal") map.journal++;\n                if (r.type === "plan") map.trainingPlan++;'
);

syncContent = syncContent.replace(
    'trainingLog: rMap.journal,',
    'trainingLog: rMap.journal,\n                trainingPlan: rMap.trainingPlan,'
);

fs.writeFileSync('src/lib/statistics-sync.ts', syncContent);

// Patch page.tsx
let pageContent = fs.readFileSync('src/app/(main)/admin/statistics/page.tsx', 'utf8');

pageContent = pageContent.replace(
    '<th className="px-6 py-4 font-bold text-center whitespace-nowrap">훈련일지</th>',
    '<th className="px-6 py-4 font-bold text-center whitespace-nowrap">훈련일지</th>\n                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">훈련 계획</th>'
);

pageContent = pageContent.replace(
    '<td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.trainingLog.toLocaleString()}</td>',
    '<td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.trainingLog.toLocaleString()}</td>\n                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.trainingPlan?.toLocaleString() || 0}</td>'
);

fs.writeFileSync('src/app/(main)/admin/statistics/page.tsx', pageContent);
console.log('Patched correctly');
