import { calculateAnalysisFromHoles } from './src/lib/score-calculations';

async function run() {
    const sortedHoles = [
        {
            hole_number: 1, par: 3, score: 4, shots: [
                { shot_number: 1, shot_value: 'TE', distance: 0 },
                { shot_number: 2, shot_value: 'PA', distance: 0 },
                { shot_number: 3, shot_value: '- / 30', distance: 30 },
                { shot_number: 4, shot_value: 'HI', distance: 0 }
            ]
        },
        {
            hole_number: 2, par: 4, score: 5, shots: [
                { shot_number: 1, shot_value: 'TE', distance: 0 },
                { shot_number: 2, shot_value: 'PA', distance: 0 },
                { shot_number: 3, shot_value: '- / 30', distance: 30 },
                { shot_number: 4, shot_value: 'HI', distance: 0 }
            ]
        },
        {
            hole_number: 3, par: 4, score: 5, shots: [
                { shot_number: 1, shot_value: 'TE', distance: 0 },
                { shot_number: 2, shot_value: 'PA', distance: 0 },
                { shot_number: 3, shot_value: '- / 35', distance: 35 },
                { shot_number: 4, shot_value: 'HI', distance: 0 }
            ]
        },
        {
            hole_number: 4, par: 5, score: 6, shots: [
                { shot_number: 1, shot_value: 'TE', distance: 0 },
                { shot_number: 2, shot_value: 'PA', distance: 0 },
                { shot_number: 3, shot_value: '- / 35', distance: 35 },
                { shot_number: 4, shot_value: 'HI', distance: 0 }
            ]
        }
    ];
    try {
        const res = await calculateAnalysisFromHoles(sortedHoles);
        res.forEach(h => {
            console.log(`\nHole ${h.holeNumber} (Par ${h.par}):`);
            h.shots.forEach((s, idx) => {
                if(s.landingLabel === 'PA' || s.landingLabel === '-') {
                    console.log(`Shot ${idx+1}: ${s.shotLabel} -> ${s.landingLabel} (dist ${s.remainingDistance}m) | distRes: ${s.distanceResult.toFixed(3)} | totalSG: ${s.shotSG.toFixed(3)}`);
                }
            });
        });
    } catch(e) { console.error(e) }
}
run();

