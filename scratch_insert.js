const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
    // Assuming coach_id is null for testing
    const res = await supabase.from('records').insert({
        type: "training",
        category: "etc",
        title: `[복습] 테스트 라운드 집중 관리`,
        content: "스코어카드 분석을 기반으로 자동 배정된 복습 훈련입니다.",
        template_settings: [{ type: "review_scorecard", scorecardId: "1234" }],
        total_count: 15,
        created_at: new Date().toISOString()
    });
    console.log("INSERT RESULT:", JSON.stringify(res, null, 2));
})();
