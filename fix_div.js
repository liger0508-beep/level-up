const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/components/schedule/CoachTripCalendar.tsx');
let lines = fs.readFileSync(targetPath, 'utf-8').split('\n');

// Find line: "                        );" (at index 233 approx)
const targetIndex = lines.findIndex(l => l.trim() === ');');
if (targetIndex !== -1) {
    lines.splice(targetIndex, 0, '                            </div>');
    fs.writeFileSync(targetPath, lines.join('\n'), 'utf-8');
    console.log("Fixed missing closing div");
} else {
    console.log("Could not find line");
}
