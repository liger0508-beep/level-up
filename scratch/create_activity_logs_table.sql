-- 활동 로그(접속, 조회 등) 기록을 위한 테이블 생성
CREATE TABLE public.user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- 예: 'login', 'report_view'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 데이터 조회를 빠르게 하기 위한 인덱스 추가
CREATE INDEX idx_user_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX idx_user_activity_logs_created_at ON public.user_activity_logs(created_at);
CREATE INDEX idx_user_activity_logs_type ON public.user_activity_logs(activity_type);
