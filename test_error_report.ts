import fs from 'fs';
import { calculateAnalysisFromHoles } from './src/lib/score-calculations';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const csvContent = fs.readFileSync('오류리포트.csv', 'utf-8');
    const lines = csvContent.split('\n').filter(l => l.trim().length > 0);
    
    // Skip header
    const dataLines = lines.slice(1);
    let badCount = 0;
    let totalChecked = 0;
    
    for (const line of dataLines) {
        // Parse CSV line properly, considering quotes
        const match = line.match(/^(\d+),(\d+),[^,]+,[^,]+,"(.*)"$/);
        if (!match) continue;
        
        const holeNumber = parseInt(match[1], 10);
        const par = parseInt(match[2], 10);
        const detailStr = match[3];
        
        // Extract shot labels: e.g., "1타 [TE] (1.08점)" -> "TE"
        const shotRegex = /\[([^\]]+)\]/g;
        let execResult;
        const shots = [];
        let shotNum = 1;
        while ((execResult = shotRegex.exec(detailStr)) !== null) {
            shots.push({
                shot_number: shotNum++,
                shot_value: execResult[1].trim(),
                distance: 0 // fallback if no slash
            });
        }
        
        // We add a final 'HI' if the last shot isn't 'HI' or if the logic requires it.
        // Wait, in score-calculations, it iterates until strokeLandingLabel === 'HI'.
        // Let's ensure the last shot's result works properly. In the error report, is the last shot 'HI'?
        // The error report shows: "15타 [GB / 26] (-1.65점)". No HI?
        // Ah, the SG is calculated from Start -> End. 15 shots means 15 starts.
        // The end is the next shot. If there are 15 shots in the report, what is the 16th shot?
        // Usually, the last shot is a putt (GR) and its end is HI, or the 15th shot is a hole-out.
        // Let's add a dummy 'HI' at the end to represent the hole-out, because calculateAnalysisFromHoles looks at pairs (start -> end).
        shots.push({
            shot_number: shotNum++,
            shot_value: 'HI',
            distance: 0
        });

        const hole = {
            id: 'mock',
            hole_number: holeNumber,
            par: par,
            score: shots.length - 1, // original shots count
            shots: shots
        };
        
        try {
            const analysis = await calculateAnalysisFromHoles([hole]);
            const res = analysis[0];
            const diff = Math.abs(Math.round(res.totalSG) - res.totalSG);
            if (diff > 0.01) {
                badCount++;
                console.log(`Hole ${holeNumber} (Par ${par}): New Total SG = ${res.totalSG.toFixed(4)}, expected ${Math.round(res.totalSG)}`);
            }
            totalChecked++;
        } catch (e: any) {
            console.error(`Error on hole ${holeNumber}:`, e.message);
        }
    }
    
    console.log(`Checked ${totalChecked} holes. Found ${badCount} non-integers.`);
}

run().catch(console.error);
