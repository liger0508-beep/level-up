import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';
import { calculateAnalysisFromHoles } from '@/lib/score-calculations';

export async function GET() {
    const supabase = createClient();
    
    const { data: scorecards, error } = await supabase
        .from('scorecards')
        .select(`
            id, round_date, course_name, 
            athlete:users!scorecards_athlete_id_fkey(name),
            holes:scorecard_holes(
                id, hole_number, par, score,
                shots:scorecard_shots(*)
            )
        `)
        // Limit to recent ones or all if not too many
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const errors = [];
    
    for (const sc of scorecards) {
        if (!sc.holes || sc.holes.length === 0) continue;

        const sortedHoles = (sc.holes as any[])
            .filter(h => h.score !== -1)
            .sort((a, b) => a.hole_number - b.hole_number);

        try {
            const analysis = await calculateAnalysisFromHoles(sortedHoles);
            
            for (const hole of analysis) {
                const fractionalPart = Math.abs(hole.totalSG % 1);
                // Check if the fractional part is not close to 0 or 1
                if (fractionalPart > 0.01 && fractionalPart < 0.99) {
                    errors.push({
                        작성자: (sc.athlete as any)?.name || 'Unknown',
                        날짜: sc.round_date,
                        골프장: sc.course_name,
                        해당홀: hole.holeNumber,
                        총점: hole.totalSG,
                        scorecard_id: sc.id
                    });
                }
            }
        } catch (err) {
            // ignore
        }
    }

    return NextResponse.json({ count: errors.length, errors });
}
