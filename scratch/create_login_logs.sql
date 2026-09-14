-- 1. 새로운 login_logs 테이블 생성
CREATE TABLE public.login_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 테이블에 대한 코멘트 (설명) 추가
COMMENT ON TABLE public.login_logs IS '사용자 접속(로그인) 기록 통계용 테이블';

-- 3. Row Level Security(RLS) 활성화
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

-- 4. 본인 접속 기록 저장 권한 (insert)
CREATE POLICY "Users can insert their own logs" 
ON public.login_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 5. 최고관리자(admin) 전체 통계 조회 권한 (select)
CREATE POLICY "Admins can view all logs" 
ON public.login_logs 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() AND users.role = 'admin'
    )
);

-- 6. 본인의 기록만 조회할 수 있는 권한 (select) - 필요한 경우
CREATE POLICY "Users can view their own logs" 
ON public.login_logs 
FOR SELECT 
USING (auth.uid() = user_id);
