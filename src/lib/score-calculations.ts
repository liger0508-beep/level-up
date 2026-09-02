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
    shotNumber: number; // 실제 타수 (DB의 shot_number)
    memo?: string; // 샷 노트 (선택)
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

    if (error || !scorecard) {
        console.warn('Scorecard not found or error:', error?.message);
        return [];
    }

    // 2. Extract and format the holes data
    const sortedHoles = (scorecard.holes as any[])
        .filter(h => h.score !== -1)
        .sort((a, b) => a.hole_number - b.hole_number);

    return await calculateAnalysisFromHoles(sortedHoles);
}

export async function calculateAnalysisFromHoles(sortedHoles: any[]): Promise<HoleAnalysis[]> {
    const supabase = createClient();
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

    return sortedHoles.map(hole => {
        const sortedShots = (hole.shots as any[]).sort((a: any, b: any) => a.shot_number - b.shot_number);
        const results: ShotResult[] = [];
        let hasReachedGreenOrShort = false;
        const penaltyMap = new Map<string, number>([
            ['FW', -0.08], ['RO', 0.15], ['FB', 0.25], ['FO', 0.5], ['PA', 1.0], ['OB', 2.0], ['PS', 1.0],
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
            // Determine inherited location for '-' shots
            let actualStartLabel = rawStartLabel;
            if (rawStartLabel === "-") {
                const prevShot = sortedShots[i - 1];
                if (prevShot && ['OB', 'PS'].includes(prevShot.shot_value.trim().toUpperCase())) {
                    for (let j = i - 2; j >= 0; j--) {
                        const traceShotF = sortedShots[j].shot_value.split('/')[0].trim().toUpperCase();
                        if (!['OB', 'PA', 'PS', '-'].includes(traceShotF)) {
                            actualStartLabel = sortedShots[j].shot_value.trim().toUpperCase();
                            break;
                        }
                    }
                }
            }

            let shotLabel = "";
            if (rawStartLabel === "PA" && i > 0) {
                shotLabel = getFormattedLabel(sortedShots[i-1].shot_value);
            } else if (actualStartLabel !== rawStartLabel) {
                // Inherited OB/PS
                shotLabel = getFormattedLabel(actualStartLabel);
            } else {
                shotLabel = getFormattedLabel(rawStartLabel);
            }

            const strokeStartF = actualStartLabel.split('/')[0].trim();
            const strokeStartD = (() => {
                if (!actualStartLabel.includes('/')) return startShot.distance || 0;
                const match = actualStartLabel.match(/\/(\s*\d+)/);
                return match ? parseInt(match[1].trim()) : 0;
            })();
            const strokeStartLabel = actualStartLabel; // Inherited for internal logic
            const originalStartLabel = rawStartLabel; // Keep original for tryPos logic

            // 가상 라벨 치환 (Virtual GA Labeling): 30m 이하 드롭존(-)은 GA(어프로치)로 간주
            let effectiveStartF = strokeStartF;
            if (strokeStartF === '-' && strokeStartD > 0 && strokeStartD <= 30) {
                effectiveStartF = 'GA';
            }

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
                const isShort = d > 0 && d <= 30 && !['PA', 'OB', 'PS'].includes(f); // '-' is treated as short if dist <= 30
                return ['GR', 'GA', 'GB', 'HI'].includes(f) || isShort;
            });

            const isStartGreenOrShort = ['GR', 'GA', 'GB', 'HI'].includes(effectiveStartF) || 
                                      (strokeStartD > 0 && strokeStartD <= 30 && !['PA', 'OB', 'PS', '-'].includes(effectiveStartF));
            const isAfterFirstGreen = firstGreenShotIdx !== -1 && i >= firstGreenShotIdx;

            let shotIndex = 0;
            if (!isStartGreenOrShort && !isAfterFirstGreen && strokeStartLabel !== '') {
                const slashesUpToNow = sortedShots.slice(0, i + 1).filter(s => s.shot_value.includes('/')).length;
                shotIndex = slashesUpToNow > 0 ? slashesUpToNow + 1 : 0;
            }

            // 2. Try Position & Try Distance
            let tryPos = 0;
            let tryDist = 0;

            let isPar3TeeReplacement = false;
            if (hole.par === 3) {
                if (i > 0) {
                    let allPrevPenalty = true;
                    for (let j = 0; j < i; j++) {
                        const prevLandingF = results[j]?.landingLabel || sortedShots[j]?.shot_value.split('/')[0].trim().toUpperCase();
                        if (!['OB', 'PA', 'PS', '-'].includes(prevLandingF)) {
                            allPrevPenalty = false;
                            break;
                        }
                    }
                    // OB로 인한 티샷 재시도(잠정구)인 경우만 0점 처리 (티박스에서 다시 칠 때)
                    isPar3TeeReplacement = allPrevPenalty && actualStartLabel.startsWith('TE');
                }
            }

            if (i === 0) {
                if (hole.par === 5) { tryPos = 0; tryDist = 0; } // Par 5 bonus distributed later
            } else {
                const isProvisionalAfterOB = i > 0 && results[i - 1]?.shotLabel.split('/')[0].trim().toUpperCase() === 'OB';
                const isOtherLocationProvisionalOB = isProvisionalAfterOB && !['TE', 'GR', 'GA', 'GB'].includes(effectiveStartF);

                // Formula for Try Position (e.g., G104/G111):
                const exclusionList = ['OB', 'PA', 'PS', '-', 'GR', 'HI', 'GA', 'GB'];
                
                if (isOtherLocationProvisionalOB) {
                    tryPos = 0;
                } else if (isPar3TeeReplacement) {
                    // 파3 티샷이 패널티에 빠진 후 치는 샷은 시도 위치 패널티 면제(0점)
                    tryPos = 0;
                } else if (exclusionList.includes(strokeStartF) || originalStartLabel === '-') {
                    tryPos = 0;
                } else {
                    tryPos = -(results[i - 1]?.positionResult || 0);
                }

                // --- Formula D105/H112/D112 Logic (Try Distance) ---
                const v_d35_txt = strokeStartLabel.trim().toUpperCase();
                
                const prevShotForPSCheck = i > 0 ? sortedShots[i - 1] : null;
                const isPrevShotPS = prevShotForPSCheck?.shot_value.split('/')[0].trim().toUpperCase() === 'PS';
                const isInheritedFromGeneralArea = !['GA', 'GB', 'GR'].includes(strokeStartF);
                const isDropAfterPS = originalStartLabel.startsWith('-') && isPrevShotPS && isInheritedFromGeneralArea;

                const isExcluded = v_d35_txt === '-' || 
                                 ['OB', 'PA', 'PS', 'GA', 'GB', 'HI'].some(code => v_d35_txt.startsWith(code)) ||
                                 isDropAfterPS;

                let isDropFromPANotAroundGreen = false;
                if (i > 0 && originalStartLabel.startsWith('-') && strokeStartD > 0 && strokeStartD <= 30) {
                    const prevStartF = sortedShots[i - 1].shot_value.split('/')[0].trim().toUpperCase();
                    if (prevStartF === 'PA') {
                        const prevPrevStartF = i >= 2 ? sortedShots[i - 2].shot_value.split('/')[0].trim().toUpperCase() : '';
                        if (!['GA', 'GB', 'GR'].includes(prevPrevStartF)) {
                            isDropFromPANotAroundGreen = true;
                        }
                    }
                }

                if (isOtherLocationProvisionalOB) {
                    tryDist = 0;
                } else if (isPar3TeeReplacement) {
                    // 파3 티샷 오비 후 다시 치는 샷은 시도 거리 점수 0점 처리
                    tryDist = 0;
                } else if (isDropFromPANotAroundGreen) {
                    // 그린 주변이 아닌 곳에서 PA에 빠진 후 30m 이하에서 드롭 시 시도 거리 0점 처리
                    tryDist = 0;
                } else if (hole.par === 3 && v_d35_txt === '-' && effectiveStartF !== 'GA') {
                    // 파3 패널티 구역(PA) 드롭 후 치는 샷의 시도 거리는 다른 홀과 마찬가지로 0점 처리
                    tryDist = 0;
                } else if (!isExcluded && strokeStartLabel !== '') {
                    let searchDist = strokeStartD;
                    // FW, RO, FO, FB의 경우 거리가 40 미만이면 40m 데이터 강제 참조
                    if (['FW', 'RO', 'FO', 'FB'].includes(strokeStartF) && searchDist > 0 && searchDist < 40) {
                        searchDist = 40;
                    }
                    const sortedBaselines = [...baselines].sort((a, b) => a.distance_m - b.distance_m);
                    let prevBRow = sortedBaselines[0];
                    for (const r of sortedBaselines) {
                        if (r.distance_m <= searchDist) prevBRow = r;
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
            if (strokeStartF === 'TE' && (strokeLandingF === 'GA' || strokeLandingF === 'GB') && hole.par === 4) {
                posRes = 0;
            } else if (strokeLandingF === 'GA' || (originalStartLabel === 'PA' && strokeLandingF === '-' && strokeLandingD > 0 && strokeLandingD <= 30)) {
                // PA에서 30m 이하 드롭존(-)으로 이동한 경우 GA와 동일하게 어프로치 구간별 위치 결과 점수 적용
                posRes = strokeLandingD <= 10 ? 0.1 : strokeLandingD <= 25 ? 0.35 : strokeLandingD <= 30 ? 0.45 : 0;
            } else if (strokeLandingF === 'GB') {
                posRes = strokeLandingD <= 25 ? 0.6 : strokeLandingD <= 30 ? 0.65 : 0;
            } else {
                posRes = penaltyMap.get(strokeLandingF) || 0;
            }

            // 4. Distance Result - Waterfall formula
            const v_d94_f = effectiveStartF;
            const v_d94_val = strokeStartD;
            const v_d94_txt = strokeStartLabel;

            const v_d101_f = strokeLandingF;
            const v_d101_val = strokeLandingD;
            const v_d101_txt = strokeLandingLabel;

            const lookupRow = (dist: number, lie: string = '') => {
                let searchDist = dist;
                // FW, RO, FO, FB의 경우 거리가 40 미만이면 40m 데이터 강제 참조
                if (['FW', 'RO', 'FO', 'FB'].includes(lie) && searchDist > 0 && searchDist < 40) {
                    searchDist = 40;
                }
                return [...baselines].sort((a, b) => b.distance_m - a.distance_m)
                    .find(b => b.distance_m <= searchDist) || baselines[0];
            };

            let distRes = 0;
            let mainScore = 0;

            if (strokeLandingF === 'PA' && (v_d94_f === 'GA' || v_d94_f === 'GB')) {
                if (v_d94_f === 'GA') {
                    mainScore = v_d94_val <= 10 ? 0.9 : v_d94_val <= 25 ? 0.65 : 0.4;
                } else if (v_d94_f === 'GB') {
                    mainScore = 0.4;
                }
            } else if (originalStartLabel === 'PA' && strokeLandingF === '-') {
                if (strokeLandingD > 0 && strokeLandingD <= 30) {
                    // PA에서 30m 이하 드롭존(-)으로 이동 시 어프로치로 간주하여 거리 결과 점수는 0점 처리
                    mainScore = 0;
                } else {
                    // 그린 주변에서 패널티에 빠진 경우에만 1점 추가 로직 적용
                    let wasFromAroundGreen = false;
                    if (i > 0) {
                        const prevLabelF = sortedShots[i - 1].shot_value.split('/')[0].trim().toUpperCase();
                        if (['GA', 'GB'].includes(prevLabelF)) {
                            wasFromAroundGreen = true;
                        }
                    }

                    if (wasFromAroundGreen) {
                        const dRow = lookupRow(strokeLandingD, strokeLandingF);
                        const onGreenScore = Number(dRow.on_green) || 0;
                        mainScore = 1 - onGreenScore;
                    } else {
                        // 일반 샷(TE, FW 등)에서 패널티에 빠져 거리가 남은 경우, 일반 거리 기준점수 적용
                        if (hole.par === 3 && strokeLandingD >= 31 && strokeLandingD <= 39) {
                            // Par 3에서 패널티 구역(PA) 이동 후 31~39m 사이 드롭 시 퍼팅 점수 0점 강제 적용
                            mainScore = 0;
                        } else {
                            let scoreCol: string;
                            if (hole.par === 5) {
                                if (shotIndex === 1) scoreCol = 'tee_p5';
                                else if (shotIndex === 2) scoreCol = 'second_p5';
                                else if (shotIndex >= 3) scoreCol = 'tee_p4';
                                else scoreCol = 'tee_p5';
                            } else {
                                if (hole.par === 3) scoreCol = 'putting';
                                else if (hole.par === 4) scoreCol = 'tee_p4';
                                else scoreCol = 'tee_p5';
                            }
                            const dRow = lookupRow(strokeLandingD, strokeLandingF);
                            mainScore = Number(dRow[scoreCol as keyof typeof dRow]) || 0;
                        }
                    }
                }
            } else if (['OB', 'PA', 'PS', '-'].includes(strokeLandingF) || strokeLandingLabel === '') {
                mainScore = 0;
            } else if (v_d94_f === 'TE' && strokeLandingF === 'GA' && hole.par === 4) {
                mainScore = strokeLandingD <= 10 ? -0.9 : strokeLandingD <= 25 ? -0.65 : -0.55;
            } else if (v_d94_f === 'TE' && strokeLandingF === 'GB' && hole.par === 4) {
                mainScore = strokeLandingD <= 25 ? -0.4 : strokeLandingD <= 30 ? -0.35 : 0;
            } else if (v_d94_f === 'GB' && (strokeLandingF === 'GB' || strokeLandingF === 'GA')) {
                mainScore = v_d94_val >= 26 ? 0.35 : 0.4;
            } else if (v_d94_f === 'GB' && v_d94_txt.includes('/')) {
                if (strokeLandingLabel === 'HI') {
                    mainScore = 0;
                } else {
                    const col = v_d94_val <= 25 ? 'bunker_25m' : 'bunker_30m';
                    const row = lookupRow(strokeLandingD, strokeLandingF);
                    mainScore = Number(row[col as keyof typeof row]) || 0;
                }
            } else if (v_d94_f === 'GA' && (strokeLandingF === 'GB' || strokeLandingF === 'GA')) {
                mainScore = v_d94_val <= 10 ? 0.9 : v_d94_val <= 25 ? 0.65 : 0.55;
            } else if (v_d94_f === 'GA' && v_d94_txt.includes('/')) {
                if (strokeLandingLabel === 'HI') {
                    mainScore = 0;
                } else {
                    const col = v_d94_val <= 10 ? 'app_10m' : v_d94_val <= 25 ? 'app_25m' : 'app_30m';
                    const row = lookupRow(strokeLandingD, strokeLandingF);
                    mainScore = Number(row[col as keyof typeof row]) || 0;
                }
            } else if (v_d94_f === 'GR' && strokeLandingLabel === 'HI') {
                mainScore = -1;
            } else if (v_d94_f === 'GR' && strokeLandingF !== 'GR' && strokeLandingF !== 'HI') {
                mainScore = 1;
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
                const dRow = lookupRow(strokeLandingD, strokeLandingF);
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

            if (v_d94_f === 'TE' && (strokeLandingF === 'GA' || strokeLandingF === 'GB')) {
                // If TE -> GA or GB, skip standard adjustments. 
                // Only Par 3 adjustment might apply later.
                adj = 0;
            } else {
                // Universal +1 adjustment: IF(AND(nextIdx > (par-2), isNextNumeric), 1, 0)
                if (v_d110 > (hole.par - 2) && nextShot && nextShot.shot_value.includes('/')) {
                    adj += 1;
                }

                // Ensure OB/Penalty takes precedence over GA/GB specific "landed out" logic
                const isPenalty = ['PA', 'OB', 'PS', '-'].includes(strokeLandingF);
                const landedOut = !['GR', 'GA', 'GB', 'HI'].includes(strokeLandingF) && 
                                  !isPenalty &&
                                  !(strokeLandingD > 0 && strokeLandingD <= 30);
                if (['GA', 'GB'].includes(v_d94_f) && landedOut) {
                    adj += 0.245;
                }

                // Adj 2 (Removed): Old Par 5 fixed -0.25 base bonus removed. Par 5 bonus is now distributed evenly among progression shots.
                
                let isPar5TwoOnToPAWithShortDrop = false;
                if (hole.par === 5 && shotIndex === 2 && strokeLandingF === 'PA') {
                    const nextLandingShot = sortedShots[i + 2];
                    if (nextLandingShot) {
                        const nextLandingLabel = nextLandingShot.shot_value.trim().toUpperCase();
                        if (nextLandingLabel.startsWith('-')) {
                            const match = nextLandingLabel.match(/\/\s*(\d+)/);
                            const dropDist = match ? parseInt(match[1]) : 0;
                            if (dropDist > 0 && dropDist <= 30) {
                                isPar5TwoOnToPAWithShortDrop = true;
                            }
                        }
                    }
                }

                // Adj 3: Par 5, shotIndex=2, result is GA/GB/GR (2-on attempt exception)
                if (hole.par === 5 && shotIndex === 2 && (['GA', 'GB', 'GR'].includes(strokeLandingF) || isPar5TwoOnToPAWithShortDrop)) {
                    adj += -0.8; // Changed from -0.75 to -0.8 to perfectly offset the -1.00 total old bonus
                }

                // Adj 4, 5, 6: HI result penalties & bonuses
                // 어프로치(GA)와 벙커(GB) 홀인은 공통 보너스와 중복되지 않고 독립적인 고정 점수 적용
                if (strokeLandingLabel === 'HI') {
                    if (v_d94_f === 'GA') {
                        // GA start + HI result bonus
                        if (v_d94_val <= 10) adj += -1.1;
                        else if (v_d94_val <= 25) adj += -1.35;
                        else if (v_d94_val <= 30) adj += -1.45;
                    } else if (v_d94_f === 'GB') {
                        // GB start + HI result bonus
                        if (v_d94_val <= 25) adj += -1.6;
                        else if (v_d94_val <= 30) adj += -1.65;
                    } else {
                        // 일반 공통 홀인 보너스 (GA, GB가 아닐 때만 적용)
                        if (hole.par === 5 && shotIndex === 2) adj += -3;
                        else if (hole.par === 5 && shotIndex === 3) adj += -2;
                        else if (hole.par === 5 && shotIndex >= 4) adj += -1;
                        else if (hole.par === 4 && shotIndex === 2) adj += -2;
                        else if (hole.par === 4 && shotIndex >= 3) adj += -1;
                        else if (hole.par === 3 && shotIndex >= 2) adj += -2;
                    }
                }
            }

            // Adj 2.5: Par 5, shotIndex=1 (Tee shot), result is GA/GB/GR (1-on attempt exception)
            if (hole.par === 5 && (shotIndex === 1 || v_d94_f === 'TE') && ['GA', 'GB', 'GR'].includes(strokeLandingF)) {
                adj += -1.8;
            }

            // Par 3 specific subtraction: - INDEX(on_green, MATCH(...)) 
            // This applies even if TE -> GA/GB based on user formula structure
            if (hole.par === 3 && v_d110 > (hole.par - 2)) {
                // 패널티 구역 드롭(정확히 '-')인 경우 on_green 차감 생략 (시도 거리가 0이 되므로 밸런스 유지)
                if (strokeLandingLabel !== '-') {
                    adj -= (Number(lookupRow(strokeLandingD, strokeLandingF).on_green) || 0);
                }
            }

            distRes = mainScore + adj;

            const shotSG = tryPos + tryDist + posRes + distRes;
            results.push({
                shotLabel: shotLabel, tryPosition: tryPos, tryDistance: tryDist,
                positionResult: posRes, distanceResult: distRes, shotSG: shotSG, 
                shotIndex: shotIndex, attemptDistance: strokeStartD,
                remainingDistance: strokeLandingLabel === 'HI' ? 0 : strokeLandingD,
                landingLabel: strokeLandingF, shotNumber: startShot.shot_number,
                memo: startShot.memo
            });
            if (v_d101_f === 'HI') {
                break;
            }
        }

        // Apply distributed Par 5 bonus (-0.2 total)
        if (hole.par === 5 && results.length > 0) {
            const progressionIndices: number[] = [];
            for (let k = 0; k < results.length; k++) {
                const r = results[k];
                const startF = r.shotLabel.split('/')[0].trim().toUpperCase();
                if (!['GR', 'GA', 'GB', 'HI'].includes(startF) && !['OB', 'PA', 'PS', '-'].includes(r.landingLabel) && r.landingLabel !== '-') {
                    progressionIndices.push(k);
                }
            }
            if (progressionIndices.length > 0) {
                const bonus = -0.2 / progressionIndices.length;
                progressionIndices.forEach(idx => {
                    results[idx].distanceResult += bonus;
                    results[idx].shotSG += bonus;
                });
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

        results.forEach((r, idx) => {
            let label = r.shotLabel.split('/')[0].trim().toUpperCase();
            let dist = r.attemptDistance;

            // PA(페널티) 샷 자체의 점수(거리 손실 페널티)를 직전의 페널티를 유발한 
            // 원인 샷의 부문으로 귀속시킨다. (실제로 스윙하는 드롭 샷 '-'은 제외)
            const isPAPenaltyShot = dist === 0 && idx > 0 && results[idx - 1].landingLabel === 'PA';

            if (isPAPenaltyShot && idx > 0) {
                // 뒤로 거슬러 올라가며, 거리가 0보다 큰 정상적인 원인 샷을 찾습니다.
                for (let j = idx - 1; j >= 0; j--) {
                    const traceR = results[j];
                    const traceLabel = traceR.shotLabel.split('/')[0].trim().toUpperCase();
                    if (traceR.attemptDistance > 0 && traceLabel !== '-') {
                        label = traceLabel;
                        dist = traceR.attemptDistance;
                        break;
                    }
                }
            }

            const sg = r.shotSG;

            // Driver Split (TE shots in Par 4/5)
            if (label === 'TE' && hole.par >= 4) {
                distSG_DriverDist += (r.tryDistance + r.distanceResult);
                distSG_DriverAcc += (r.tryPosition + r.positionResult);
            }

            // Distances (Non-bunker, non-putt, excluding Par 4/5 tee)
            if (label !== 'GR' && label !== 'GB' && !(label === 'TE' && hole.par >= 4) && dist > 0) {
                if (dist >= 180) distSG_180Plus += sg;
                else if (dist >= 150) distSG_150_179 += sg;
                else if (dist >= 120) distSG_120_149 += sg;
                else if (dist >= 90) distSG_90_119 += sg;
                else if (dist >= 31) distSG_Pitch31_89 += sg;
            }

            // Bunker (GB)
            if (label === 'GB') distSG_Bunker += sg;

            // Approach (Non-green, non-bunker, <= 30m, excluding Par 4/5 tee)
            if (label !== 'GR' && label !== 'GB' && !(label === 'TE' && hole.par >= 4) && dist > 0 && dist <= 30) {
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

export interface ReviewFocusShot {
    holeNumber: number;
    par: number;
    shotLabel: string;
    attemptDistance: number;
    shotSG: number;
    subCategory: string; 
    majorCategory: string;
}

export function generateReviewFocusCategories(analysis: HoleAnalysis[]): Record<string, ReviewFocusShot[]> {
    const allShots: ReviewFocusShot[] = [];

    // 1. 모든 샷 수집 및 분류
    for (const hole of analysis) {
        for (const s of hole.shots) {
            const label = (s.shotLabel || "").split('/')[0].trim().toUpperCase();
            const isTeeShot = label === "TE" && hole.par >= 4;
            const isMissedFairway = isTeeShot && s.landingLabel !== "FW";

            if (s.shotSG > 0 || isMissedFairway) {
                const dist = s.attemptDistance || 0;
                
                let majorCategory = "";
                let subCategory = "";

                if (isTeeShot) {
                    majorCategory = "티샷";
                    if (s.landingLabel === "FW") subCategory = "페어웨이 안착";
                    else if (s.landingLabel === "RO") subCategory = "러프 안착";
                    else subCategory = "그외";
                } else if (label.startsWith("GR")) {
                    majorCategory = "퍼팅";
                    if (dist >= 9) subCategory = "9M이상";
                    else if (dist >= 4) subCategory = "4-8M";
                    else if (dist >= 2) subCategory = "2-3M";
                    else subCategory = "1M";
                } else if (dist > 30) {
                    majorCategory = "아이언&피치샷";
                    if (dist >= 180) subCategory = "180m이상";
                    else if (dist >= 150) subCategory = "150-179m";
                    else if (dist >= 120) subCategory = "120-149m";
                    else if (dist >= 90) subCategory = "90-119m";
                    else if (dist >= 31) subCategory = "31-89m";
                } else {
                    majorCategory = "그린주변샷";
                    if (label === "GB") subCategory = "벙커";
                    else if (['GA', 'GB'].includes(s.landingLabel)) subCategory = s.landingLabel === "GB" ? "벙커" : "어프로치";
                    else if (['OB', 'PA', 'PS', '-'].includes(s.landingLabel)) subCategory = "기타";
                    else subCategory = "어프로치"; // Default fallback for around green
                }

                if (majorCategory && subCategory) {
                    allShots.push({
                        holeNumber: hole.holeNumber,
                        par: hole.par,
                        shotLabel: s.shotLabel,
                        attemptDistance: dist,
                        shotSG: s.shotSG,
                        subCategory,
                        majorCategory
                    });
                }
            }
        }
    }

    const result: Record<string, ReviewFocusShot[]> = {
        "티샷": [],
        "아이언&피치샷": [],
        "그린주변샷": [],
        "퍼팅": []
    };

    // 2. 대분류별 추출 로직
    for (const major of Object.keys(result)) {
        const majorShots = allShots.filter(s => s.majorCategory === major).sort((a, b) => b.shotSG - a.shotSG);
        
        // 소분류별 우선 할당 (쿼터)
        const subCatSet = new Set(majorShots.map(s => s.subCategory));
        const selectedShots: ReviewFocusShot[] = [];
        const usedHoleIndex = new Set<string>(); // 동일 홀에서 여러 샷이 중복으로 들어가는 것을 허용할지 여부: 유저는 "샷별 점수"라고 했으므로 샷마다 개별 추가가 원칙이나, 중복된 shotIndex 방지를 위해 유니크 키 사용.
        const getUniqueKey = (s: ReviewFocusShot) => `${s.holeNumber}-${s.shotLabel}-${s.attemptDistance}`;

        for (const sub of Array.from(subCatSet)) {
            const topShot = majorShots.find(s => s.subCategory === sub && !usedHoleIndex.has(getUniqueKey(s)));
            if (topShot) {
                selectedShots.push(topShot);
                usedHoleIndex.add(getUniqueKey(topShot));
            }
        }

        // 빈자리 채우기 (최대 5개까지)
        for (const shot of majorShots) {
            if (selectedShots.length >= 5) break;
            if (!usedHoleIndex.has(getUniqueKey(shot))) {
                selectedShots.push(shot);
                usedHoleIndex.add(getUniqueKey(shot));
            }
        }

        // 3. 정렬 로직 적용
        selectedShots.sort((a, b) => {
            if (major === "티샷" || major === "퍼팅") {
                return a.holeNumber - b.holeNumber; // 홀 번호 오름차순
            } else if (major === "아이언&피치샷") {
                return a.attemptDistance - b.attemptDistance; // 거리 오름차순
            } else if (major === "그린주변샷") {
                if (a.subCategory === "어프로치" && b.subCategory !== "어프로치") return -1;
                if (a.subCategory !== "어프로치" && b.subCategory === "어프로치") return 1;
                return 0;
            }
            return 0;
        });

        result[major] = selectedShots;
    }

    return result;
}
