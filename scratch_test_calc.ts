import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { calculateScorecardAnalysis, generateReviewFocusCategories } from './src/lib/score-calculations';

async function main() {
    const scorecardId = 'd0839c68-d489-4297-8dbb-ca59309ee3b1';
    try {
        const analysis = await calculateScorecardAnalysis(scorecardId);
        console.log("Analysis Result:", analysis.length);
        if (analysis.length > 0) {
            const focus = generateReviewFocusCategories(analysis);
            console.log("Focus:", focus);
        }
    } catch (e) {
        console.error("ERROR:", e);
    }
}
main();
