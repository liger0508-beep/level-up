require('dotenv').config({ path: '.env.local' });
import { calculateScorecardAnalysis } from '../src/lib/score-calculations';

async function run() {
    const id = "11d9520b-cd20-4367-8bca-ca55deca978b";
    const res = await calculateScorecardAnalysis(id);
    const hole12 = res.find((h: any) => h.holeNumber === 12);
    if (hole12) {
        console.log("Hole 12 Shots:");
        hole12.shots.forEach((s: any, idx: number) => {
            console.log(`[${idx}] Label: ${s.shotLabel}, Dist: ${s.attemptDistance}, SG: ${s.shotSG}, Landing: ${s.landingLabel}`);
        });
        console.log("\ndistSG_120_149:", hole12.summary.distSG_120_149);
    }
}
run();
