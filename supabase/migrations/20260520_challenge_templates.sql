-- Create challenge_templates table for managing challenge content
CREATE TABLE IF NOT EXISTS public.challenge_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    purpose TEXT DEFAULT '',
    goal TEXT DEFAULT '',
    "mediaUrl" TEXT DEFAULT '',
    "mediaType" TEXT DEFAULT '',
    scoring_config JSONB DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.challenge_templates ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Allow authenticated users to select challenge_templates"
ON public.challenge_templates FOR SELECT
TO authenticated
USING (true);

-- Allow all authenticated users to insert
CREATE POLICY "Allow authenticated users to insert challenge_templates"
ON public.challenge_templates FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to update
CREATE POLICY "Allow authenticated users to update challenge_templates"
ON public.challenge_templates FOR UPDATE
TO authenticated
USING (true);

-- Allow all authenticated users to delete
CREATE POLICY "Allow authenticated users to delete challenge_templates"
ON public.challenge_templates FOR DELETE
TO authenticated
USING (true);

-- Pre-populate the 3 core challenge contents
INSERT INTO public.challenge_templates ("categoryId", title, description, purpose, goal, sort_order)
VALUES
    ('shot', '샷 종합 챌린지', '드라이버 비거리·정확도와 아이언 그린 적중률을 종합 평가하는 챌린지입니다.', '샷 능력의 종합적인 평가 및 경쟁', '드라이버 10구 + 아이언 거리별 4구씩 기록 후 종합점수 산출', 1),
    ('short_game', '숏게임 종합 챌린지', '어프로치 정확도와 벙커 탈출 성공률을 종합 평가하는 챌린지입니다.', '그린 주변 컨트롤 능력의 종합 평가 및 경쟁', '어프로치 거리별 4구 + 벙커 10구 기록 후 종합점수 산출', 2),
    ('putting', '퍼팅 종합 챌린지', '롱·미들·숏 퍼팅 성공률을 종합 평가하는 챌린지입니다.', '퍼팅 전 거리 능력의 종합 평가 및 경쟁', '롱퍼팅 5구 + 미들퍼팅 5구 + 숏퍼팅 5구 기록 후 종합점수 산출', 3);
