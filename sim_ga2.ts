import { calculateAnalysisFromHoles } from './src/lib/score-calculations';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const hole = {
        hole_number: 1, par: 4, score: 2,
        shots: [
            { shot_number: 1, shot_value: 'GA / 25' },
            { shot_number: 2, shot_value: 'HI' }
        ]
    };
    try {
        const analysis = await calculateAnalysisFromHoles([hole]);
        for (const s of analysis[0].shots) {
            console.log(`Shot: ${s.shotLabel} -> ${s.landingLabel}, distRes: ${s.distanceResult.toFixed(2)}`);
        }
    } catch(e: any) {}
}
run();
