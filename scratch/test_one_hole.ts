require('dotenv').config({ path: '.env.local' });
import { calculateAnalysisFromHoles } from '../src/lib/score-calculations';

async function runSpecificHole() {
    const hole = {
        hole_number: 1,
        par: 4,
        score: 4,
        shots: [
            { shot_number: 1, shot_value: "TE", distance: 0 },
            { shot_number: 2, shot_value: "FW", distance: 200 },
            { shot_number: 3, shot_value: "GA / 25", distance: 0 },
            { shot_number: 4, shot_value: "GR / 8", distance: 0 },
            { shot_number: 5, shot_value: "HI", distance: 0 }
        ]
    };
    
    const results = await calculateAnalysisFromHoles([hole]);
    const res = results[0];
    
    console.log("Total SG:", res.totalSG);
    res.shots.forEach(s => {
        console.log(`Shot ${s.shotNumber}: ${s.shotLabel} => SG: ${s.shotSG}`);
    });
}

runSpecificHole();
