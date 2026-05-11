
const fs = require('fs');
const buffer = fs.readFileSync('d:/gla_coach/src/components/schedule/ScheduleCalendar.tsx');
const index = 21153;
const start = Math.max(0, index - 50);
const end = Math.min(buffer.length, index + 50);
console.log(`Bytes around ${index}:`);
const chunk = buffer.slice(start, end);
console.log(chunk.toString('hex').match(/../g).join(' '));
for (let i = 0; i < chunk.length; i++) {
    const b = chunk[i];
    const pos = start + i;
    const char = (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
    console.log(`${pos}: ${b.toString(16).padStart(2, '0')} ${char}`);
}
