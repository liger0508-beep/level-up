import { createClient } from './supabase/client';

export interface ShotResult {
    shotLabel: string;
    tryPosition: number;
    tryDistance: number;
    positionResult: number;
    distanceResult: number;
    shotSG: number;
    shotIndex: number; // 구분-1 (시도 순서)
    attemptDistance: number; // 실제 시도 거리 (m)
    remainingDistance: number; // 샷 이후 남은 거리 (m)
    landingLabel: string; // 샷 안착 지점 (예: FW, GR, OB 등)
}

export interface HoleAnalysis {
    holeNumber: number;
    par: number;
    score: number;
    totalSG: number;
    shots: ShotResult[];
    rawShotLabels: string[];
    summary: {
        scoreConversion: number;
        fairwayHit: 'O' | 'X' | '-';
        onGreenAttemptDist: string;
        gir: 'O' | 'X';
        bunkerAttemptDist: string;
        approachAttemptDist: string;
        firstPuttAttemptDist: string;
        putts: number;
        obCount: number;
        paCount: number;
        // Frequency and Others (C229:U249)
        teeShotCount: number;
        dist180Plus: number;
        dist150_179: number;
        dist120_149: number;
        dist90_119: number;
        pitchShot31_89: number;
        bunker26_30: number;
        bunker25Minus: number;
        approach26_30: number;
        approach11_25: number;
        approach10Minus: number;
        putt9Plus: number;
        putt4_8: number;
        putt2_3: number;
        putt1: number;
        par3Score: number | null;
        par4Score: number | null;
        par5Score: number | null;
        isBirdiePlus: boolean;
        isBogeyPlus: boolean;
        // Scores by Distance (C69:U86)
        distSG_DriverDist: number;
        distSG_DriverAcc: number;
        distSG_180Plus: number;
        distSG_150_179: number;
        distSG_120_149: number;
        distSG_90_119: number;
        distSG_Pitch31_89: number;
        distSG_Bunker: number;
        distSG_Approach: number;
        distSG_Putt9Plus: number;
        distSG_Putt4_8: number;
        distSG_Putt2_3: number;
        distSG_Putt1: number;
        refRow85: string;
        refRow86: string;
    };
}

export async function calculateScorecardAnalysis(scorecardId: string): Promise<HoleAnalysis[]> {
    const supabase = createClient();

    // 1. Fetch scorecard, holes, and shots
    const { data: scorecard, error } = await supabase
        .from('scorecards')
        .select(`
            id,
            holes:scorecard_holes(
                id, hole_number, par, score,
                shots:scorecard_shots(*)
            )
        `)
        .eq('id', scorecardId)
        .single();

    if (error || !scorecard) throw new Error('Scorecard not found');

    // 2. Fetch baseline and penalty data
    const [baselineRes, penaltyRes] = await Promise.all([
        supabase.from('sg_baseline').select('*').order('distance_m'),
        supabase.from('sg_location_penalty').select('*')
    ]);

    if (baselineRes.error) throw new Error(`sg_baseline query error: ${baselineRes.error.message}`);
    if (penaltyRes.error) throw new Error(`sg_location_penalty query error: ${penaltyRes.error.message}`);

    const baselines = baselineRes.data;
    const penalties = penaltyRes.data;

    if (!baselines || baselines.length === 0) throw new Error('Reference data not found: sg_baseline is empty');
    if (!penalties || penalties.length === 0) throw new Error('Reference data not found: sg_location_penalty is empty');


    const penaltyMap = new Map(penalties.map(p => [p.location_code, Number(p.penalty_value)]));

    // Helper: Lookup baseline score
    const getBaselineScore = (dist: number, lie: string, par: number) => {
        const sorted = [...baselines].sort((a, b) => a.distance_m - b.distance_m);
        let row = sorted[0];
        for (const r of sorted) {
            if (r.distance_m <= dist) row = r;
            else break;
        }

        // Column selection logic based on lie and par
        if (lie === 'TE') {
            if (par === 3) return Number(row.putting) || Number(row.tee_p4);
            if (par === 4) return Number(row.tee_p4);
            return Number(row.tee_p5);
        }
        if (lie === 'GR' || lie === 'GA') return Number(row.putting) || Number(row.tee_p4);
        if (lie === 'RO') return Number(row.second_p5);
        if (lie === 'FB' || lie === 'GB') return Number(row.on_green);
        return Number(row.tee_p4); // Default to Fairway
    };

    const sortedHoles = (scorecard.holes as any[]).sort((a, b) => a.hole_number - b.hole_number);

    return sortedHoles.map(hole => {
        const sortedShots = (hole.shots as any[]).sort((a: any, b: any) => a.shot_number - b.shot_number);
        const results: ShotResult[] = [];
        let hasReachedGreenOrShort = false;
        const penaltyMap = new Map<string, number>([
            ['FW', -0.08], ['RO', 0.2], ['FB', 0.25], ['FO', 0.5], ['PA', 1.0], ['OB', 2.0], ['PS', 1.0],
            ['GR', 0.0], ['GA', 0.25], ['GB', 0.5], ['HI', 0.0], ['-', 0.0]
        ]);

        const getFormattedLabel = (label: string) => {
            if (!label) return "-";
            const upper = label.trim().toUpperCase();
            if (!upper.includes('/')) return upper;
            const parts = upper.split('/');
            const f = parts[0].trim();
            const b = parseFloat(parts[1].trim());
            if (isNaN(b)) return f;
            return `${f} / ${b}`;
        };

         for (let i = 0; i < sortedShots.length - 1; i++) {
            const startShot = sortedShots[i];
            const endShot = sortedShots[i + 1];
            if (!startShot || !endShot) break;

            // 1. Stroke Definitions (Start → Landing)
            const rawStartLabel = startShot.shot_value.trim().toUpperCase();
            let shotLabel = "";
            
            if (rawStartLabel === "PA" && i > 0) {
                shotLabel = getFormattedLabel(sortedShots[i-1].shot_value);
            } else if (rawStartLabel === "-" && i > 1) {
                shotLabel = getFormattedLabel(sortedShots[i-2].shot_value);
            } else {
                shotLabel = getFormattedLabel(startShot.shot_value);
            }

            const strokeStartF = rawStartLabel.split('/')[0].trim();
            const strokeStartD = (() => {
                if (!rawStartLabel.includes('/')) return startShot.distance || 0;
                const match = rawStartLabel.match(/\/(\s*\d+)/);
                return match ? parseInt(match[1].trim()) : 0;
            })();
            const strokeStartLabel = rawStartLabel; // Original for internal logic

            const strokeLandingLabel = endShot.shot_value.trim().toUpperCase();
            const strokeLandingF = strokeLandingLabel.split('/')[0].trim();
            const strokeLandingD = (() => {
                if (!strokeLandingLabel.includes('/')) return endShot.distance || 0;
                const match = strokeLandingLabel.match(/\/(\s*\d+)/);
                return match ? parseInt(match[1].trim()) : 0;
            })();

            // 1.5 Calculate shotIndex (구분-1) based on precise spreadsheet waterfall
            // Find first green/short shot for the whole hole
            const firstGreenShotIdx = sortedShots.findIndex(s => {
                const label = s.shot_value.toUpperCase().trim();
                const f = label.split('/')[0].trim();
                const d = (() => {
                    const match = label.match(/\/(\s*\d+)/);
                    return match ? parseInt(match[1].trim()) : 0;
                })();
                const isShort = d > 0 && d <= 30 && !['PA', 'OB', 'PS', '-'].includes(f);
                return ['GR', 'GA', 'GB', 'HI'].includes(f) || isShort;
            });

            const isStartGreenOrShort = ['GR', 'GA', 'GB', 'HI'].includes(strokeStartF) || 
                                      (strokeStartD > 0 && strokeStartD <= 30 && !['PA', 'OB', 'PS', '-'].includes(strokeStartF));
            const isAfterFirstGreen = firstGreenShotIdx !== -1 && i >= firstGreenShotIdx;

            let shotIndex = 0;
            if (!isStartGreenOrShort && !isAfterFirstGreen && strokeStartLabel !== '') {
                const slashesUpToNow = sortedShots.slice(0, i + 1).filter(s => s.shot_value.includes('/')).length;
                shotIndex = slashesUpToNow > 0 ? slashesUpToNow + 1 : 0;
            }

            // 2. Try Position & Try Distance
            let tryPos = 0;
            let tryDist = 0;

            if (i === 0) {
                if (hole.par === 5) { tryPos = -0.125; tryDist = -0.125; }
            } else {
                // Formula for Try Position (e.g., G104/G111):
                const exclusionList = ['OB', 'PA', 'PS', '-', 'GR', 'HI', 'GA', 'GB'];
                if (exclusionList.includes(strokeStartF)) {
                    tryPos = 0;
                } else {
                    tryPos = -(results[i - 1]?.positionResult || 0);
                }

                // --- Formula D105/H112/D112 Logic (Try Distance) ---
                const v_d35_txt = strokeStartLabel.trim().toUpperCase();
                const isExcluded = v_d35_txt === '-' || 
                                 ['OB', 'PA', 'PS', 'GA', 'GB', 'HI'].some(code => v_d35_txt.startsWith(code));

                if (!isExcluded && strokeStartLabel !== '') {
                    const sortedBaselines = [...baselines].sort((a, b) => a.distance_m - b.distance_m);
                    let prevBRow = sortedBaselines[0];
                    for (const r of sortedBaselines) {
                        if (r.distance_m <= strokeStartD) prevBRow = r;
                        else break;
                    }

                    if (hole.par === 5) {
                        if (shotIndex === 2) tryDist = (Number(prevBRow.tee_p5) || 0) * -1;
                        else if (shotIndex >= 3) tryDist = Number(prevBRow.on_green) || 0;
                        else if (strokeStartF === 'GR') tryDist = -(Number(prevBRow.putting) || 0);
                        else tryDist = Number(prevBRow.on_green) || 0;
                    } else {
                        if (strokeStartF === 'GR') tryDist = -(Number(prevBRow.putting) || 0);
                        else tryDist = Number(prevBRow.on_green) || 0;
                    }
                }
            }

            // 3. Position Result (D99)
            let posRes = 0;
            if (strokeLandingF === 'GA') posRes = strokeLandingD <= 10 ? 0.1 : strokeLandingD <= 25 ? 0.35 : strokeLandingD <= 30 ? 0.6 : 0;
            else if (strokeLandingF === 'GB') posRes = strokeLandingD <= 25 ? 0.6 : strokeLandingD <= 30 ? 0.65 : 0;
            else posRes = penaltyMap.get(strokeLandingF) || 0;

            // 4. Distance Result - Waterfall formula
            const v_d94_f = strokeStartF;
            const v_d94_val = strokeStartD;
            const v_d94_txt = strokeStartLabel;

            const v_d101_f = strokeLandingF;
            const v_d101_val = strokeLandingD;
            const v_d101_txt = strokeLandingLabel;

            const lookupRow = (dist: number) => {
                return [...baselines].sort((a, b) => b.distance_m - a.distance_m)
                    .find(b => b.distance_m <= dist) || baselines[0];
            };

            let distRes = 0;
            let mainScore = 0;

            if (v_d94_f === 'GB' && (strokeLandingF === 'GB' || strokeLandingF === 'GA')) {
                mainScore = v_d94_val >= 26 ? 0.35 : 0.4;
            } else if (v_d94_f === 'GB' && v_d94_txt.includes('/')) {
                const col = v_d94_val <= 25 ? 'bunker_25m' : 'bunker_30m';
                const row = lookupRow(strokeLandingD);
                mainScore = Number(row[col as keyof typeof row]) || 0;
            } else if (v_d94_f === 'GA' && (strokeLandingF === 'GA' || strokeLandingF === 'GB')) {
                mainScore = v_d94_val <= 10 ? 0.9 : v_d94_val <= 25 ? 0.65 : 0.4;
            } else if (v_d94_f === 'GA' && strokeLandingF === 'GR') {
                const col = v_d94_val <= 10 ? 'app_10m' : v_d94_val <= 25 ? 'app_25m' : 'app_30m';
                const row = lookupRow(strokeLandingD);
                mainScore = Number(row[col as keyof typeof row]) || 0;
            } else if (v_d94_f === 'GR' && strokeLandingLabel === 'HI') {
                mainScore = -1;
            } else if (!strokeLandingLabel.includes('/') || ['OB', 'PA', 'PS', 'GA', 'GB', 'HI', ''].includes(strokeLandingF)) {
                mainScore = 0;
            } else {
                let scoreCol: string;
                if (strokeLandingF.startsWith('GR')) {
                    scoreCol = 'putting';
                } else if (hole.par === 5) {
                    if (shotIndex === 1) scoreCol = 'tee_p5';
                    else if (shotIndex === 2) scoreCol = 'second_p5';
                    else if (shotIndex >= 3) scoreCol = 'tee_p4';
                    else scoreCol = 'tee_p5';
                } else {
                    if (hole.par === 3) scoreCol = 'putting';
                    else if (hole.par === 4) scoreCol = 'tee_p4';
                    else scoreCol = 'tee_p5';
                }
                const dRow = lookupRow(strokeLandingD);
                let base = Number(dRow[scoreCol as keyof typeof dRow]) || 0;
                if (v_d94_f === 'GR') base = base + 1;
                mainScore = base;
            }

            // Adjustments
            const nextShot = sortedShots[i + 1];
            let nextShotIdxVal = 0;
            if (nextShot) {
                const nextLabel = nextShot.shot_value.toUpperCase().trim();
                const nextF = nextLabel.split('/')[0].trim();
                const nextD = (() => {
                    const match = nextLabel.match(/\/(\s*\d+)/);
                    return match ? parseInt(match[1].trim()) : 0;
                })();
                const isNextGreenOrShort = ['GR', 'GA', 'GB', 'HI'].includes(nextF) || 
                                          (nextD > 0 && nextD <= 30 && !['PA', 'OB', 'PS', '-'].includes(nextF));
                const isNextAfterFirstGreen = firstGreenShotIdx !== -1 && (i + 1) >= firstGreenShotIdx;
                
                if (!isNextGreenOrShort && !isNextAfterFirstGreen && nextLabel !== '') {
                    const slashesUpToNext = sortedShots.slice(0, i + 2).filter(s => s.shot_value.includes('/')).length;
                    nextShotIdxVal = slashesUpToNext > 0 ? slashesUpToNext + 1 : 0;
                }
            }

            let adj = 0;
            const v_d110 = nextShotIdxVal; // Next shot's index for adjustment

            // Universal +1 adjustment: IF(AND(nextIdx > (par-2), isNextNumeric), 1, 0)
            if (v_d110 > (hole.par - 2) && nextShot && nextShot.shot_value.includes('/')) {
                adj += 1;
            }

            // Par 3 specific subtraction: - INDEX(on_green, MATCH(...))
            if (hole.par === 3 && v_d110 > (hole.par - 2)) {
                adj -= (Number(lookupRow(strokeLandingD).on_green) || 0);
            }

            // Adj 2: Par 5, shotIndex=2, result is NOT exactly "-" or other penalties
            if (hole.par === 5 && shotIndex === 2 && 
                v_d101_txt !== '-' && !['OB', 'PA', 'PS'].includes(v_d101_f)) {
                adj += -0.25;
            }

            // Adj 3: Par 5, shotIndex=2, result is GA/GB/GR
            if (hole.par === 5 && shotIndex === 2 && ['GA', 'GB', 'GR'].includes(v_d101_f)) {
                adj += -0.5;
            }

            // Adj 4: HI result penalties based on par and shotIndex
            if (strokeLandingLabel === 'HI') {
                if (hole.par === 5 && shotIndex === 2) adj += -3;
                else if (hole.par === 5 && shotIndex === 3) adj += -2;
                else if (hole.par === 5 && shotIndex >= 4) adj += -1;
                else if (hole.par === 4 && shotIndex === 2) adj += -2;
                else if (hole.par === 4 && shotIndex >= 3) adj += -1;
                else if (hole.par === 3 && shotIndex >= 2) adj += -2;
            }

            // Adj 5: GA start + HI result bonus
            if (strokeLandingLabel === 'HI' && v_d94_f === 'GA') {
                if (v_d94_val <= 10) adj += -1.1;
                else if (v_d94_val <= 25) adj += -1.35;
                else if (v_d94_val <= 30) adj += -1.6;
            }

            // Adj 6: GB start + HI result bonus
            if (strokeLandingLabel === 'HI' && v_d94_f === 'GB') {
                if (v_d94_val <= 25) adj += -1;
                else if (v_d94_val <= 30) adj += -1.5;
            }
            distRes = mainScore + adj;

            const shotSG = tryPos + tryDist + posRes + distRes;
            results.push({
                shotLabel: shotLabel, tryPosition: tryPos, tryDistance: tryDist,
                positionResult: posRes, distanceResult: distRes, shotSG: shotSG, 
                shotIndex: shotIndex, attemptDistance: strokeStartD,
                remainingDistance: strokeLandingLabel === 'HI' ? 0 : strokeLandingD,
                landingLabel: strokeLandingF
            });
            if (v_d101_f === 'HI') {
                break;
            }
        }

        const totalSG = results.reduce((acc, r) => acc + r.shotSG, 0);

        // Final summary for the hole
        const score = results.length;
        const scoreConversion = score - hole.par;
        const obCount = sortedShots.filter(s => s.shot_value.includes('OB')).length;
        const paCount = sortedShots.filter(s => s.shot_value.includes('PA')).length;
        const putts = sortedShots.filter(s => s.shot_value.startsWith('GR')).length;
        
        // Fairway (Shot 1 landing)
        let fairwayHit: 'O' | 'X' | '-' = '-';
        if (hole.par >= 4) {
            const shot2Start = sortedShots[1]?.shot_value.split('/')[0].trim() || '';
            fairwayHit = shot2Start === 'FW' ? 'O' : 'X';
        }

        // GIR
        const girThreshold = hole.par - 2;
        let gir: 'O' | 'X' = 'X';
        const firstGreenIdx = sortedShots.findIndex(s => s.shot_value.startsWith('GR'));
        if (firstGreenIdx !== -1 && firstGreenIdx <= girThreshold) gir = 'O';
        const hiIdx = sortedShots.findIndex(s => s.shot_value.includes('HI'));
        if (hiIdx !== -1 && hiIdx <= girThreshold) gir = 'O';

        // OnGreen Dist: Par 3 = Shot 1. Others = Last shot with slash before reaching GR/GB/GA/HI.
        let onGreenAttemptDist = "";
        if (hole.par === 3) {
            onGreenAttemptDist = (results[0] && results[0].attemptDistance > 0) ? Math.round(results[0].attemptDistance).toString() : "";
        } else {
            const firstGreenReachIdx = results.findIndex(r => 
                ['GR', 'GA', 'GB', 'HI'].includes(r.shotLabel.split('/')[0].trim().toUpperCase())
            );
            if (firstGreenReachIdx !== -1) {
                // Find LAST shot BEFORE firstGreenReachIdx that has a distance
                const shotsBefore = results.slice(0, firstGreenReachIdx);
                const lastDistShot = [...shotsBefore].reverse().find(r => r.attemptDistance > 0);
                if (lastDistShot) onGreenAttemptDist = Math.round(lastDistShot.attemptDistance).toString();
            }
        }

        const bunkerShots = results.filter(r => r.shotLabel.startsWith('GB'));
        const bunkerAttemptDist = bunkerShots.map(r => Math.round(r.attemptDistance)).join(' / ');

        const approachShots = results.filter((r, idx) => 
            idx > 0 && 
            !r.shotLabel.startsWith('GR') && 
            !r.shotLabel.startsWith('FB') && 
            !r.shotLabel.startsWith('GB') && 
            r.attemptDistance > 0 && 
            r.attemptDistance <= 30
        );
        const approachAttemptDist = approachShots.map(r => Math.round(r.attemptDistance)).join(' / ');

        const puttShots = results.filter(r => r.shotLabel.startsWith('GR'));
        const firstPuttAttemptDist = puttShots.length > 0 ? Math.round(puttShots[0].attemptDistance).toString() : "";

        // --- New Frequency & Others logic (C229:U249) ---
        const teeShotCount = sortedShots.filter((s, idx) => idx === 0 && hole.par !== 3 && s.shot_value.includes('/')).length;
        
        // Iron / Distance shots (Non-green, non-bunker, non-putt)
        const longShots = results.filter(r => !r.shotLabel.startsWith('GR') && !r.shotLabel.startsWith('GB') && r.attemptDistance > 0);
        const dist180Plus = longShots.filter(r => r.attemptDistance >= 180).length;
        const dist150_179 = longShots.filter(r => r.attemptDistance >= 150 && r.attemptDistance < 180).length;
        const dist120_149 = longShots.filter(r => r.attemptDistance >= 120 && r.attemptDistance < 150).length;
        const dist90_119 = longShots.filter(r => r.attemptDistance >= 90 && r.attemptDistance < 120).length;
        const pitchShot31_89 = longShots.filter(r => r.attemptDistance >= 31 && r.attemptDistance < 90).length;

        // Bunker (GB only)
        const bunker26_30 = bunkerShots.filter(r => r.attemptDistance >= 26 && r.attemptDistance <= 30).length;
        const bunker25Minus = bunkerShots.filter(r => r.attemptDistance <= 25).length;

        // Approach (Non-green, non-bunker, <= 30m)
        const approach26_30 = approachShots.filter(r => r.attemptDistance >= 26 && r.attemptDistance <= 30).length;
        const approach11_25 = approachShots.filter(r => r.attemptDistance >= 11 && r.attemptDistance <= 25).length;
        const approach10Minus = approachShots.filter(r => r.attemptDistance <= 10).length;

        // Putts (GR)
        const putt9Plus = puttShots.filter(r => r.attemptDistance >= 9).length;
        const putt4_8 = puttShots.filter(r => r.attemptDistance >= 4 && r.attemptDistance <= 8).length;
        const putt2_3 = puttShots.filter(r => r.attemptDistance >= 2 && r.attemptDistance <= 3).length;
        const putt1 = puttShots.filter(r => r.attemptDistance === 1).length;

        // Score Stats
        const par3Score = hole.par === 3 ? scoreConversion : null;
        const par4Score = hole.par === 4 ? scoreConversion : null;
        const par5Score = hole.par === 5 ? scoreConversion : null;
        const isBirdiePlus = scoreConversion <= -1;
        const isBogeyPlus = scoreConversion >= 1;

        // --- New Scores by Distance logic (C69:U86) ---
        let distSG_DriverDist = 0;
        let distSG_DriverAcc = 0;
        let distSG_180Plus = 0;
        let distSG_150_179 = 0;
        let distSG_120_149 = 0;
        let distSG_90_119 = 0;
        let distSG_Pitch31_89 = 0;
        let distSG_Bunker = 0;
        let distSG_Approach = 0;
        let distSG_Putt9Plus = 0;
        let distSG_Putt4_8 = 0;
        let distSG_Putt2_3 = 0;
        let distSG_Putt1 = 0;

        results.forEach(r => {
            const label = r.shotLabel.split('/')[0].trim().toUpperCase();
            const dist = r.attemptDistance;
            const sg = r.shotSG;

            // Driver Split (TE shots in Par 4/5)
            if (label === 'TE' && hole.par >= 4) {
                distSG_DriverDist += (r.tryDistance + r.distanceResult);
                distSG_DriverAcc += (r.tryPosition + r.positionResult);
            }

            // Distances (Non-bunker, non-putt)
            if (label !== 'GR' && label !== 'GB' && dist > 0) {
                if (dist >= 180) distSG_180Plus += sg;
                else if (dist >= 150) distSG_150_179 += sg;
                else if (dist >= 120) distSG_120_149 += sg;
                else if (dist >= 90) distSG_90_119 += sg;
                else if (dist >= 31) distSG_Pitch31_89 += sg;
            }

            // Bunker (GB)
            if (label === 'GB') distSG_Bunker += sg;

            // Approach (Non-green, non-bunker, <= 30m)
            if (label !== 'GR' && label !== 'GB' && label !== 'TE' && dist > 0 && dist <= 30) {
                distSG_Approach += sg;
            }

            // Putts (GR)
            if (label === 'GR') {
                if (dist >= 9) distSG_Putt9Plus += sg;
                else if (dist >= 4) distSG_Putt4_8 += sg;
                else if (dist >= 2) distSG_Putt2_3 += sg;
                else if (dist === 1) distSG_Putt1 += sg;
            }
        });

        // Ref Rows 85/86
        let refRow85 = "";
        let refRow86 = "";
        const grShots = results.filter(r => r.shotLabel.startsWith('GR'));
        if (grShots.length >= 2) {
            const lastPutt = grShots[grShots.length - 1];
            if (Math.round(lastPutt.attemptDistance) === 1) {
                // Find MIN distance of all putts BEFORE the last one
                const prevPuttDists = grShots.slice(0, grShots.length - 1).map(r => Math.round(r.attemptDistance));
                const minPrevDist = Math.min(...prevPuttDists);
                refRow85 = `O / ${minPrevDist}`;
                if (minPrevDist >= 10) refRow86 = "O";
            }
        }

        // Update distSG_Putt9Plus based on provided D80 formula
        let finalPutt9SG = distSG_Putt9Plus;
        const ref85DistMatch = refRow85.match(/\/\s*(\d+)/);
        const ref85Dist = ref85DistMatch ? parseInt(ref85DistMatch[1]) : 0;

        // Part 1: Penalty from refRow85 (if min prev dist >= 9)
        if (refRow85.startsWith("O") && ref85Dist >= 9) finalPutt9SG -= 0.1;

        // Part 3: Bonus from refRow86
        if (refRow86 === "O") finalPutt9SG += 0.025;

        distSG_Putt9Plus = finalPutt9SG;

        // Update distSG_Putt1 based on provided D83 formula
        let finalPutt1SG = 0;
        // (ref85Dist is already calculated above)

        // Part 1: Bonus from refRow85
        if (ref85Dist === 1) finalPutt1SG += 0.9;

        // Part 2: If refRow85 is active, use 0. Otherwise sum the SG of 1m putts.
        if (refRow85.startsWith("O")) {
            finalPutt1SG += 0;
        } else {
            // Sum SG of all 1m putts (already calculated in distSG_Putt1)
            finalPutt1SG += distSG_Putt1;
        }

        // Part 3: Penalty from refRow86
        if (refRow86 === "O") finalPutt1SG -= 0.025;

        distSG_Putt1 = finalPutt1SG;

        return {
            holeNumber: hole.hole_number,
            par: hole.par,
            score: score,
            totalSG: totalSG,
            shots: results,
            rawShotLabels: sortedShots.map(s => s.shot_value),
            summary: {
                scoreConversion,
                fairwayHit,
                onGreenAttemptDist,
                gir,
                bunkerAttemptDist,
                approachAttemptDist,
                firstPuttAttemptDist,
                putts,
                obCount,
                paCount,
                teeShotCount,
                dist180Plus,
                dist150_179,
                dist120_149,
                dist90_119,
                pitchShot31_89,
                bunker26_30,
                bunker25Minus,
                approach26_30,
                approach11_25,
                approach10Minus,
                putt9Plus,
                putt4_8,
                putt2_3,
                putt1,
                par3Score,
                par4Score,
                par5Score,
                isBirdiePlus,
                isBogeyPlus,
                distSG_DriverDist,
                distSG_DriverAcc,
                distSG_180Plus,
                distSG_150_179,
                distSG_120_149,
                distSG_90_119,
                distSG_Pitch31_89,
                distSG_Bunker,
                distSG_Approach,
                distSG_Putt9Plus,
                distSG_Putt4_8,
                distSG_Putt2_3,
                distSG_Putt1,
                refRow85,
                refRow86
            }
        };
    });
}
