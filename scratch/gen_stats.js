const fs = require('fs');

let content = fs.readFileSync('src/app/(main)/scores/[id]/page.tsx', 'utf8');

// Replace Page Component Definition
content = content.replace(
    'export default function ScoreDetailPage() {',
    `export default function ScoreStatsPage() {`
);

// We will use a script to completely rewrite stats/page.tsx
