
const fs = require('fs');
const buffer = fs.readFileSync('d:/gla_coach/src/components/schedule/ScheduleCalendar.tsx');
let found = false;
for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0) {
        console.log(`Null byte at index ${i}`);
        found = true;
    }
}
if (!found) console.log('No null bytes found.');
