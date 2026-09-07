const fs = require('fs');

const logFile = "C:\\Users\\owner\\.gemini\\antigravity-ide\\brain\\e1d1e3fc-e49d-4768-a736-453566324f3e\\.system_generated\\logs\\transcript.jsonl";
const targetFile = "d:\\gla_coach\\src\\app\\(main)\\training\\challenges\\create\\page.tsx";

const linesExtracted = {};
let maxLine = 0;

try {
    const fileContent = fs.readFileSync(logFile, 'utf-8');
    const lines = fileContent.split('\n');
    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const data = JSON.parse(line);
            if (data.type === 'TOOL_RESPONSE' && data.content && data.content.includes('Showing lines')) {
                const contentLines = data.content.split('\n');
                for (const textLine of contentLines) {
                    const match = textLine.match(/^(\d+): (.*)$/);
                    if (match) {
                        const lineNum = parseInt(match[1], 10);
                        linesExtracted[lineNum] = match[2];
                        if (lineNum > maxLine) maxLine = lineNum;
                    }
                }
            }
        } catch (e) {
            // Ignore parse errors on individual lines
        }
    }
    
    if (maxLine === 0) {
        console.log("No lines found!");
    } else {
        console.log(`Extracted up to line ${maxLine}`);
        const outputLines = [];
        for (let i = 1; i <= maxLine; i++) {
            outputLines.push(linesExtracted[i] !== undefined ? linesExtracted[i] : '');
        }
        fs.writeFileSync(targetFile, outputLines.join('\n'), 'utf-8');
        console.log("Restored successfully.");
    }
} catch (e) {
    console.error("Error:", e);
}
