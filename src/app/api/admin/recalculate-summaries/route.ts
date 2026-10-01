import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateAndSaveScorecardSummary } from '@/lib/score-calculations';

export async function GET(request: Request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 모든 스코어카드 ID 가져오기
    const { data: scorecards, error } = await supabase.from('scorecards').select('id');
    
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let successCount = 0;
    let failCount = 0;

    // 각 스코어카드마다 재계산 실행
    for (const sc of scorecards) {
        try {
            const success = await generateAndSaveScorecardSummary(sc.id);
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (e) {
            console.error(`Error recalculating ${sc.id}:`, e);
            failCount++;
        }
    }

    return NextResponse.json({ 
        message: "과거 스코어카드 재계산 완료", 
        total: scorecards.length,
        successCount,
        failCount
    });
}
