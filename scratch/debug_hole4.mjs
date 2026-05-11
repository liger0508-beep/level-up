import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvajcjtoserjhkdeatlh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2YWpjanRvc2VyamhrZGVhdGxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2MjM4MCwiZXhwIjoyMDkyOTM4MzgwfQ.RRc8nqdDBxKcf4Mp8ORX_VeZB8tcp2YhCj3X9D6hQXU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugHole4() {
    const scorecardId = 'c87b46bc-7449-41bb-894a-197e92e071fd';
    
    // Fetch data
    const { data: scorecard } = await supabase
        .from('scorecards')
        .select(`id, holes:scorecard_holes(id, hole_number, par, shots:scorecard_shots(*))`)
        .eq('id', scorecardId)
        .single();

    const [baselineRes, penaltyRes] = await Promise.all([
        supabase.from('sg_baseline').select('*').order('distance_m'),
        supabase.from('sg_location_penalty').select('*')
    ]);

    const baselines = baselineRes.data;
    const penalties = penaltyRes.data;
    const penaltyMap = new Map(penalties.map(p => [p.location_code, Number(p.penalty_value)]));
    // Hardcode matching the latest code logic
    penaltyMap.set('GA', 0.25);
    penaltyMap.set('GB', 0.5);

    const hole = scorecard.holes.find(h => h.hole_number === 4);
    const sortedShots = hole.shots.sort((a, b) => a.shot_number - b.shot_number);

    console.log('=== Debugging Hole 4 ===');
    const results = [];
    let hasReachedGreenOrShort = false;

    for (let i = 0; i < sortedShots.length; i++) {
        const shot = sortedShots[i];
        const shotIndex = hasReachedGreenOrShort ? 0 : i + 1;
        const startF_actual = shot.location_code.toUpperCase();
        const startD_actual = shot.distance || 0;

        let tryPos = 0;
        let tryDist = 0;

        if (i === 0) {
            if (hole.par === 5) { tryPos = -0.125; tryDist = -0.125; }
        } else {
            const exclusionList = ['OB', 'PA', 'PS', '-', 'GR', 'HI', 'GA', 'GB'];
            if (exclusionList.includes(startF_actual)) {
                tryPos = 0;
            } else {
                tryPos = -(results[i - 1]?.positionResult || 0);
            }

            const prevF = startF_actual;
            const prevDistVal = startD_actual;
            if (!['OB', 'PA', 'PS', 'GA', 'GB', 'HI', '-', '', 'TE'].includes(prevF)) {
                const sortedBaselines = [...baselines].sort((a, b) => a.distance_m - b.distance_m);
                let prevBRow = sortedBaselines[0];
                for (const r of sortedBaselines) {
                    if (r.distance_m <= prevDistVal) prevBRow = r;
                    else break;
                }
                if (hole.par === 5) {
                    if (shotIndex === 2) tryDist = (Number(prevBRow.tee_p5) || 0) * -1;
                    else if (shotIndex >= 3) tryDist = Number(prevBRow.bunker) || 0;
                    else if (prevF === 'GR') tryDist = -(Number(prevBRow.putting) || 0);
                    else tryDist = Number(prevBRow.bunker) || 0;
                } else {
                    if (prevF === 'GR') tryDist = -(Number(prevBRow.putting) || 0);
                    else tryDist = Number(prevBRow.bunker) || 0;
                }
            }
        }

        const nextShot = sortedShots[i + 1];
        const nextLabel = nextShot ? nextShot.shot_value.trim().toUpperCase() : 'HI';
        const nextF = nextLabel.includes('/') ? nextLabel.split('/')[0].trim() : nextLabel;
        const match = nextLabel.match(/\/\s*([\d.]+)/);
        const nextDist = match ? parseFloat(match[1]) : 0;

        let posRes = 0;
        if (nextF === 'GA') posRes = nextDist <= 10 ? 0.1 : nextDist <= 25 ? 0.35 : nextDist <= 30 ? 0.6 : 0;
        else if (nextF === 'GB') posRes = nextDist <= 25 ? 0.5 : nextDist <= 30 ? 0.65 : 0;
        else posRes = penaltyMap.get(nextF) || 0;

        console.log(`Shot ${i+1} (${shot.shot_value}): tryPos=${tryPos.toFixed(3)}, tryDist=${tryDist.toFixed(3)}, posRes=${posRes.toFixed(3)}`);
        
        results.push({ positionResult: posRes });
        if (nextF === 'GR' || nextF === 'GA' || nextF === 'GB') hasReachedGreenOrShort = true;
    }
}

debugHole4();
