import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const holeType = searchParams.get('holeType');
    
    if (!startDate || !endDate || !holeType) {
        return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const authHeader = request.headers.get('Authorization');

    const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader || '' } }
    });

    // Fetch from scorecard_summary
    const { data: summaries, error } = await supabase
        .from('scorecard_summary')
        .select(`
            *,
            athlete:users!scorecard_summary_athlete_id_fkey(id, name, branch)
        `)
        .eq('hole_count', parseInt(holeType))
        .gte('round_date', startDate)
        .lte('round_date', endDate);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by athlete and sum/average the stats
    const athleteMap = new Map<string, any>();

    for (const row of (summaries || [])) {
        const athlete = row.athlete as any;
        if (!athlete) continue;
        const branch = athlete.branch || "미지정";

        if (!athleteMap.has(row.athlete_id)) {
            athleteMap.set(row.athlete_id, {
                athleteId: row.athlete_id,
                athleteName: athlete.name,
                branch: branch,
                rounds: 0,
                total_score: 0,
                tee_dist_sg: 0, tee_acc_sg: 0,
                dist_180_plus_sg: 0, dist_150_179_sg: 0, dist_120_149_sg: 0, dist_90_119_sg: 0,
                pitch_sg: 0, bunker_sg: 0, approach_sg: 0,
                putt_9_plus_sg: 0, putt_4_8_sg: 0, putt_2_3_sg: 0, putt_1_sg: 0,
                fw_hits: 0, fw_total: 0,
                gir_hits: 0, gir_total: 0,
                par_saves: 0, missed_gir_total: 0,
                total_putts: 0, three_putts: 0, penalty_ob: 0,
                bounce_backs: 0, bogey_or_worse: 0, birdie_or_better: 0
            });
        }

        const stat = athleteMap.get(row.athlete_id);
        stat.rounds += 1;
        stat.total_score += row.total_score;
        stat.tee_dist_sg += row.tee_dist_sg;
        stat.tee_acc_sg += row.tee_acc_sg;
        stat.dist_180_plus_sg += row.dist_180_plus_sg;
        stat.dist_150_179_sg += row.dist_150_179_sg;
        stat.dist_120_149_sg += row.dist_120_149_sg;
        stat.dist_90_119_sg += row.dist_90_119_sg;
        stat.pitch_sg += row.pitch_sg;
        stat.bunker_sg += row.bunker_sg;
        stat.approach_sg += row.approach_sg;
        stat.putt_9_plus_sg += row.putt_9_plus_sg;
        stat.putt_4_8_sg += row.putt_4_8_sg;
        stat.putt_2_3_sg += row.putt_2_3_sg;
        stat.putt_1_sg += row.putt_1_sg;
        stat.fw_hits += row.fw_hits;
        stat.fw_total += row.fw_total;
        stat.gir_hits += row.gir_hits;
        stat.gir_total += row.gir_total;
        stat.par_saves += row.par_saves;
        stat.missed_gir_total += row.missed_gir_total;
        stat.total_putts += row.total_putts;
        stat.three_putts += row.three_putts;
        stat.penalty_ob += row.penalty_ob;
        stat.bounce_backs += row.bounce_backs;
        stat.bogey_or_worse += row.bogey_or_worse;
        stat.birdie_or_better += row.birdie_or_better;
    }

    // Final calculation for averages
    const results = Array.from(athleteMap.values()).map(stat => {
        const rounds = stat.rounds;
        
        const teeTotal = (stat.tee_dist_sg + stat.tee_acc_sg) / rounds / 2;
        const secondTotal = (stat.dist_180_plus_sg + stat.dist_150_179_sg + stat.dist_120_149_sg + stat.dist_90_119_sg) / rounds / 4;
        const greenTotal = (stat.pitch_sg + stat.bunker_sg + stat.approach_sg) / rounds / 3;
        const puttingTotal = (stat.putt_9_plus_sg + stat.putt_4_8_sg + stat.putt_2_3_sg + stat.putt_1_sg) / rounds / 4;
        
        const longSG = (teeTotal * 2) + (secondTotal * 4);
        const shortSG = (greenTotal * 3) + (puttingTotal * 4);
        const longVsShort = shortSG - longSG;

        const avgTotalScore = stat.total_score / rounds;
        const playContent = avgTotalScore + ((longVsShort * -1) / 2);
        const scoreVsContent = avgTotalScore - playContent;

        return {
            athleteId: stat.athleteId,
            athleteName: stat.athleteName,
            branch: stat.branch,
            rounds: stat.rounds,
            score: avgTotalScore,
            playContent,
            scoreVsContent,
            longVsShort,
            teeTotal,
            teeDistance: stat.tee_dist_sg / rounds,
            teeAccuracy: stat.tee_acc_sg / rounds,
            secondTotal,
            dist180Plus: stat.dist_180_plus_sg / rounds,
            dist150_179: stat.dist_150_179_sg / rounds,
            dist120_149: stat.dist_120_149_sg / rounds,
            dist90_119: stat.dist_90_119_sg / rounds,
            greenTotal,
            pitchShot: stat.pitch_sg / rounds,
            bunker: stat.bunker_sg / rounds,
            approach: stat.approach_sg / rounds,
            puttingTotal,
            putt9Plus: stat.putt_9_plus_sg / rounds,
            putt4_8: stat.putt_4_8_sg / rounds,
            putt2_3: stat.putt_2_3_sg / rounds,
            putt1: stat.putt_1_sg / rounds,
            fairwayHitRate: stat.fw_total > 0 ? (stat.fw_hits / stat.fw_total) * 100 : 0,
            girRate: stat.gir_total > 0 ? (stat.gir_hits / stat.gir_total) * 100 : 0,
            parSaveRate: stat.missed_gir_total > 0 ? (stat.par_saves / stat.missed_gir_total) * 100 : 0,
            putts: stat.total_putts / rounds,
            threePutt: stat.three_putts / rounds,
            penaltyOB: stat.penalty_ob / rounds,
            bounceBack: stat.bogey_or_worse > 0 ? (stat.bounce_backs / stat.bogey_or_worse) * 100 : 0,
            birdieOrBetter: stat.birdie_or_better / rounds
        };
    });

    // Calculate Cache TTL until midnight KST
    const now = new Date();
    // KST is UTC+9
    const kstOffset = 9 * 60 * 60 * 1000;
    const nowKst = new Date(now.getTime() + kstOffset);
    const midnightKst = new Date(nowKst);
    midnightKst.setUTCHours(24, 0, 0, 0); // Next day midnight
    const diffSeconds = Math.max(1, Math.floor((midnightKst.getTime() - nowKst.getTime()) / 1000));

    return NextResponse.json(results, {
        headers: {
            'Cache-Control': `public, s-maxage=${diffSeconds}, stale-while-revalidate=59`
        }
    });
}
