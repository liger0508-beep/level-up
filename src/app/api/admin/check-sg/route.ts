import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateScorecardAnalysis } from '@/lib/score-calculations';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: scorecards, error } = await supabase.from('scorecards').select('id, round_date, course_name');
        if (error) throw error;

        let found = [];

        for (const scorecard of scorecards) {
            try {
                const analysis = await calculateScorecardAnalysis(scorecard.id);
                for (const h of analysis) {
                    if (Math.abs(h.totalSG - Math.round(h.totalSG)) > 0.01) {
                        found.push({
                            score_id: scorecard.id,
                            date: scorecard.round_date,
                            golf_course: scorecard.course_name,
                            hole: h.holeNumber,
                            totalSG: h.totalSG
                        });
                    }
                }
            } catch (e) {
                // Ignore calculation errors for individual scorecards
            }
        }
        return NextResponse.json({ success: true, count: found.length, data: found });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}