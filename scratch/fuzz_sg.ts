require('dotenv').config({ path: '.env.local' });
import { calculateAnalysisFromHoles } from '../src/lib/score-calculations';
import * as fs from 'fs';

async function runFuzzer() {
    console.log("Starting SG Fuzzer...");
    
    const scenarios: any[] = [];
    const s = (num: number, val: string, dist: number = 0) => ({ shot_number: num, shot_value: val, distance: dist });
    
    let id = 1;
    
    const lies_long = ['FW', 'RO', 'FO', 'FB'];
    const lies_short = ['GA', 'GB'];
    
    // Create combinations
    for(let par of [3, 4, 5]) {
        for(let teeDist of par === 3 ? [150, 180] : par === 4 ? [350, 400] : [480, 520]) {
            for(let longLie of lies_long) {
                for(let longDist of [200, 150, 100, 60, 40]) {
                    if (longDist > teeDist) continue;
                    
                    for(let shortLie of lies_short) {
                        for(let shortDist of [25, 15, 5]) { // <= 30m
                            for(let puttDist of [8, 2, 1]) {
                                // 1. 정상 흐름
                                let sn = 1;
                                let shots = [];
                                if (par > 3) {
                                    shots.push(s(sn++, "TE", 0));
                                    shots.push(s(sn++, `${longLie} / ${longDist}`));
                                } else {
                                    shots.push(s(sn++, "TE / " + teeDist));
                                }
                                shots.push(s(sn++, `${shortLie} / ${shortDist}`));
                                shots.push(s(sn++, `GR / ${puttDist}`));
                                shots.push(s(sn++, "HI"));
                                scenarios.push({ hole_number: id++, par, score: sn-1, shots });

                                // 2. 패널티(OB) 흐름
                                sn = 1;
                                let shotsOB = [];
                                if (par > 3) {
                                    shotsOB.push(s(sn++, "TE", 0));
                                    shotsOB.push(s(sn++, "OB"));
                                    shotsOB.push(s(sn++, "TE", 0)); // 잠정구
                                    shotsOB.push(s(sn++, `${longLie} / ${longDist}`));
                                } else {
                                    shotsOB.push(s(sn++, "TE / " + teeDist));
                                    shotsOB.push(s(sn++, "OB"));
                                    shotsOB.push(s(sn++, "TE", 0)); // 파3 잠정구는 거리 없음
                                }
                                shotsOB.push(s(sn++, `${shortLie} / ${shortDist}`));
                                shotsOB.push(s(sn++, `GR / ${puttDist}`));
                                shotsOB.push(s(sn++, "HI"));
                                scenarios.push({ hole_number: id++, par, score: sn-1, shots: shotsOB });

                                // 3. 패널티(PA) 후 30m 밖 드롭 흐름
                                sn = 1;
                                let shotsPA = [];
                                if (par > 3) {
                                    shotsPA.push(s(sn++, "TE", 0));
                                    shotsPA.push(s(sn++, "PA"));
                                    shotsPA.push(s(sn++, `- / ${longDist}`)); // 드롭존은 슬래시 포함
                                    shotsPA.push(s(sn++, `${longLie} / ${longDist - 40 > 30 ? longDist - 40 : 40}`));
                                } else {
                                    shotsPA.push(s(sn++, "TE / " + teeDist));
                                    shotsPA.push(s(sn++, "PA"));
                                    shotsPA.push(s(sn++, `- / 50`));
                                }
                                shotsPA.push(s(sn++, `${shortLie} / ${shortDist}`));
                                shotsPA.push(s(sn++, `GR / ${puttDist}`));
                                shotsPA.push(s(sn++, "HI"));
                                scenarios.push({ hole_number: id++, par, score: sn-1, shots: shotsPA });
                            }
                        }
                    }
                }
            }
        }
    }
    
    console.log(`Generated ${scenarios.length} scenarios. Running calculations...`);
    
    let anomalies: any[] = [];
    
    try {
        const results = await calculateAnalysisFromHoles(scenarios);
        
        for (const res of results) {
            const diff = Math.abs(res.totalSG - Math.round(res.totalSG));
            // Check for non-integer SG (allow 0.01 tolerance for float math)
            if (diff > 0.01) {
                const sc = scenarios.find(s => s.hole_number === res.holeNumber);
                if (sc) {
                    const shotStr = sc.shots.map((s: any) => `${s.shot_value}(${s.distance || ''})`).join(' -> ');
                    anomalies.push({
                        HoleNumber: sc.hole_number,
                        Par: sc.par,
                        Shots: shotStr,
                        TotalSG: res.totalSG
                    });
                }
            }
        }

        console.log(`Found ${anomalies.length} anomaly cases.`);
        if (anomalies.length > 0) {
            const csv = ['HoleNumber,Par,TotalSG,Shots'];
            anomalies.forEach(a => {
                csv.push(`${a.HoleNumber},${a.Par},${a.TotalSG.toFixed(4)},"${a.Shots}"`);
            });
            fs.writeFileSync('test_sg_results.csv', csv.join('\n'));
            console.log('Saved to test_sg_results.csv');
        }

    } catch(e) {
        console.error("Error:", e);
    }
}

runFuzzer();
