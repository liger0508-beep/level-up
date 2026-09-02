require('dotenv').config({ path: '.env.local' });
import { calculateAnalysisFromHoles } from '../src/lib/score-calculations';

async function runTests() {
    // Par 3 OB (Attachment 1)
    const hole1 = {
        hole_number: 1,
        par: 3,
        score: 5,
        shots: [
            { shot_number: 1, shot_value: "TE / 150" },
            { shot_number: 2, shot_value: "OB" },
            { shot_number: 3, shot_value: "TE" }, // provisional ball
            { shot_number: 4, shot_value: "GA / 25" },
            { shot_number: 5, shot_value: "GR / 8" },
            { shot_number: 6, shot_value: "HI" }
        ]
    };

    // Par 4 PA (Attachment 2)
    const hole2 = {
        hole_number: 2,
        par: 4,
        score: 6,
        shots: [
            { shot_number: 1, shot_value: "TE" },
            { shot_number: 2, shot_value: "PA" },
            { shot_number: 3, shot_value: "- / 200" },
            { shot_number: 4, shot_value: "FW / 160" },
            { shot_number: 5, shot_value: "GA / 25" },
            { shot_number: 6, shot_value: "GR / 8" },
            { shot_number: 7, shot_value: "HI" }
        ]
    };
    
    const results = await calculateAnalysisFromHoles([hole1, hole2]);
    
    console.log("=== Par 3 OB ===");
    console.log("Total SG:", results[0].totalSG);
    results[0].shots.forEach(s => {
        console.log(`Shot ${s.shotNumber}: ${s.shotLabel} => SG: ${s.shotSG}`);
    });

    console.log("\n=== Par 4 PA ===");
    console.log("Total SG:", results[1].totalSG);
    results[1].shots.forEach(s => {
        console.log(`Shot ${s.shotNumber}: ${s.shotLabel} => SG: ${s.shotSG}`);
    });
}

runTests();
