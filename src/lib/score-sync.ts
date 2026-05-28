
import { createClient } from "./supabase/client";
import { calculateScorecardAnalysis } from "./score-calculations";

export interface ScoreData {
    id: string;
    score: number;
    title: string;
    playerName: string;
    coachName: string;
    courseName: string;
    comment: string;
    date: string;
    teeShotSG: number;
    secondShotSG: number;
    aroundGreenSG: number;
    puttingSG: number;
    strongPoint: string;
    weakPoints: string[];
}

export async function fetchScoreById(scorecardId: string): Promise<ScoreData | null> {
    try {
        const supabase = createClient();
        
        const { data: scorecard } = await supabase
            .from("scorecards")
            .select(`
                id, 
                total_score, 
                course_name, 
                round_date, 
                memo,
                athlete:users!scorecards_athlete_id_fkey(name),
                coach:users!scorecards_coach_id_fkey(name),
                holes:scorecard_holes(score)
            `)
            .eq("id", scorecardId)
            .maybeSingle();

        if (!scorecard) return null;

        const analysis = await calculateScorecardAnalysis(scorecard.id);
        
        let teeSG = 0;
        let secondSG = 0;
        let greenSG = 0;
        let puttingSG = 0;

        const cats: { name: string; sg: number }[] = [
            { name: "티샷 비거리", sg: 0 }, { name: "티샷 정확도", sg: 0 },
            { name: "180M이상", sg: 0 }, { name: "150-179M", sg: 0 }, { name: "120-149M", sg: 0 }, { name: "90-119M", sg: 0 }, { name: "피치샷", sg: 0 },
            { name: "벙커", sg: 0 }, { name: "어프로치", sg: 0 },
            { name: "9M이상", sg: 0 }, { name: "4-8M", sg: 0 }, { name: "2-3M", sg: 0 }, { name: "1M", sg: 0 }
        ];

        analysis.forEach(h => {
            const s = h.summary;
            teeSG += (s.distSG_DriverDist + s.distSG_DriverAcc);
            secondSG += (s.distSG_180Plus + s.distSG_150_179 + s.distSG_120_149 + s.distSG_90_119 + s.distSG_Pitch31_89);
            greenSG += (s.distSG_Bunker + s.distSG_Approach);
            puttingSG += (s.distSG_Putt9Plus + s.distSG_Putt4_8 + s.distSG_Putt2_3 + s.distSG_Putt1);

            cats[0].sg += s.distSG_DriverDist; cats[1].sg += s.distSG_DriverAcc;
            cats[2].sg += s.distSG_180Plus; cats[3].sg += s.distSG_150_179; cats[4].sg += s.distSG_120_149; cats[5].sg += s.distSG_90_119; cats[6].sg += s.distSG_Pitch31_89;
            cats[7].sg += s.distSG_Bunker; cats[8].sg += s.distSG_Approach;
            cats[9].sg += s.distSG_Putt9Plus; cats[10].sg += s.distSG_Putt4_8; cats[11].sg += s.distSG_Putt2_3; cats[12].sg += s.distSG_Putt1;
        });

        const sortedCats = [...cats].sort((a, b) => a.sg - b.sg);
        const strongPoint = sortedCats[0]?.name || "-";
        const weakPoints = sortedCats.slice(-2).reverse().map(c => c.name);

        return {
            id: scorecard.id,
            score: scorecard.total_score || 0,
            title: `${scorecard.course_name} 라운드`,
            playerName: (scorecard.athlete as any)?.name || "",
            coachName: (scorecard.coach as any)?.name || "",
            courseName: scorecard.course_name,
            comment: scorecard.memo || "",
            date: scorecard.round_date,
            teeShotSG: teeSG,
            secondShotSG: secondSG,
            aroundGreenSG: greenSG,
            puttingSG: puttingSG,
            strongPoint,
            weakPoints
        };
    } catch (err) {
        console.error("Error in fetchScoreById:", err);
        return null;
    }
}

export async function fetchLatestScoreByPlayer(playerName: string, targetDate?: string): Promise<ScoreData | null> {
    try {
        const supabase = createClient();
        
        // 1. Get athlete user_id
        const { data: userData } = await supabase
            .from("users")
            .select("id")
            .eq("name", playerName)
            .limit(1)
            .single();
            
        if (!userData) return null;

        // 2. Fetch latest scorecards (up to 10) to find a completed one
        let query = supabase
            .from("scorecards")
            .select(`
                id, 
                total_score, 
                course_name, 
                round_date, 
                memo,
                athlete:users!scorecards_athlete_id_fkey(name),
                coach:users!scorecards_coach_id_fkey(name),
                holes:scorecard_holes(score)
            `)
            .eq("athlete_id", userData.id)
            .order("round_date", { ascending: false })
            .order("created_at", { ascending: false });

        if (targetDate) {
            query = query.lte("round_date", targetDate);
        }

        const { data: scorecards } = await query.limit(10);

        if (!scorecards || scorecards.length === 0) return null;

        // Find the most recent scorecard with 18 completed holes (score !== -1)
        const scorecard = scorecards.find(s => {
            const holes = (s.holes as any[]) || [];
            const completedCount = holes.filter(h => h.score !== -1 && h.score !== null).length;
            return completedCount === 18;
        });

        if (!scorecard) return null;

        // 3. Perform Analysis
        const analysis = await calculateScorecardAnalysis(scorecard.id);
        
        // Group SG by category
        let teeSG = 0;
        let secondSG = 0;
        let greenSG = 0;
        let puttingSG = 0;

        const cats: { name: string; sg: number }[] = [
            { name: "티샷 비거리", sg: 0 },
            { name: "티샷 정확도", sg: 0 },
            { name: "180M이상", sg: 0 },
            { name: "150-179M", sg: 0 },
            { name: "120-149M", sg: 0 },
            { name: "90-119M", sg: 0 },
            { name: "피치샷", sg: 0 },
            { name: "벙커", sg: 0 },
            { name: "어프로치", sg: 0 },
            { name: "9M이상", sg: 0 },
            { name: "4-8M", sg: 0 },
            { name: "2-3M", sg: 0 },
            { name: "1M", sg: 0 }
        ];

        analysis.forEach(h => {
            const s = h.summary;
            teeSG += (s.distSG_DriverDist + s.distSG_DriverAcc);
            secondSG += (s.distSG_180Plus + s.distSG_150_179 + s.distSG_120_149 + s.distSG_90_119 + s.distSG_Pitch31_89);
            greenSG += (s.distSG_Bunker + s.distSG_Approach);
            puttingSG += (s.distSG_Putt9Plus + s.distSG_Putt4_8 + s.distSG_Putt2_3 + s.distSG_Putt1);

            cats[0].sg += s.distSG_DriverDist;
            cats[1].sg += s.distSG_DriverAcc;
            cats[2].sg += s.distSG_180Plus;
            cats[3].sg += s.distSG_150_179;
            cats[4].sg += s.distSG_120_149;
            cats[5].sg += s.distSG_90_119;
            cats[6].sg += s.distSG_Pitch31_89;
            cats[7].sg += s.distSG_Bunker;
            cats[8].sg += s.distSG_Approach;
            cats[9].sg += s.distSG_Putt9Plus;
            cats[10].sg += s.distSG_Putt4_8;
            cats[11].sg += s.distSG_Putt2_3;
            cats[12].sg += s.distSG_Putt1;
        });

        // Derive strong/weak points (Lower SG is better)
        const sortedCats = [...cats].sort((a, b) => a.sg - b.sg);
        const strongPoint = sortedCats[0]?.name || "-";
        const weakPoints = sortedCats.slice(-2).reverse().map(c => c.name);

        return {
            id: scorecard.id,
            score: scorecard.total_score || 0,
            title: `${scorecard.course_name} 라운드`,
            playerName: (scorecard.athlete as any)?.name || "",
            coachName: (scorecard.coach as any)?.name || "",
            courseName: scorecard.course_name,
            comment: scorecard.memo || "",
            date: scorecard.round_date,
            teeShotSG: teeSG,
            secondShotSG: secondSG,
            aroundGreenSG: greenSG,
            puttingSG: puttingSG,
            strongPoint,
            weakPoints
        };
    } catch (err) {
        console.error("Error in fetchLatestScoreByPlayer:", err);
        return null;
    }
}

