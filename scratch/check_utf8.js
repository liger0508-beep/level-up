
const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
    const buffer = fs.readFileSync(filePath);
    try {
        buffer.toString('utf8');
        // Node's toString('utf8') is permissive by default, it replaces bad bytes with replacement chars.
        // We need a stricter check.
        const decoder = new TextDecoder('utf-8', { fatal: true });
        decoder.decode(buffer);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.next') {
                walk(fullPath);
            }
        } else if (file.match(/\.(tsx?|jsx?|css)$/)) {
            const res = checkFile(fullPath);
            if (!res.ok) {
                console.log(`INVALID UTF-8 in ${fullPath}: ${res.error}`);
                
                // Find index
                const buffer = fs.readFileSync(fullPath);
                for (let i = 0; i < buffer.length; i++) {
                    try {
                        new TextDecoder('utf-8', { fatal: true }).decode(buffer.slice(i, i + 1));
                    } catch (e) {
                        // This might not be accurate for multi-byte errors, but good enough to find the start
                        console.log(`  Potential error start at byte index: ${i}`);
                        const start = Math.max(0, i - 20);
                        const end = Math.min(buffer.length, i + 20);
                        console.log(`  Context (hex): ${buffer.slice(start, end).toString('hex')}`);
                        break;
                    }
                }
            }
        }
    }
}

walk('d:/gla_coach/src');
console.log('Check complete.');
