-- 푸시 알림(앱푸쉬) 발송 규칙 테이블
CREATE TABLE IF NOT EXISTS public.push_notification_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  trigger_mode TEXT NOT NULL DEFAULT 'immediate',
  minutes_before INTEGER NOT NULL DEFAULT 30,
  only_non_respondents BOOLEAN NOT NULL DEFAULT false,
  include_parents BOOLEAN NOT NULL DEFAULT false,
  target_type TEXT NOT NULL,
  target_roles TEXT[] NOT NULL DEFAULT '{}',
  target_user_ids UUID[] NOT NULL DEFAULT '{}',
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.push_notification_rules
  ADD COLUMN IF NOT EXISTS trigger_mode TEXT NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS minutes_before INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS only_non_respondents BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_parents BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_push_notification_rules_event_active
  ON public.push_notification_rules(event_type, is_active);

-- 예약 리마인드(N분 전) 중복 발송 방지 로그 테이블
CREATE TABLE IF NOT EXISTS public.push_notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES public.push_notification_rules(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL,
  target_time TEXT NOT NULL DEFAULT '',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rule_id, entity_id, target_time)
);

ALTER TABLE public.push_notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage push notification rules" ON public.push_notification_rules;
CREATE POLICY "Admins can manage push notification rules"
  ON public.push_notification_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND (role IN ('admin', 'super_admin', 'superadmin') OR name = '슈퍼관리자')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND (role IN ('admin', 'super_admin', 'superadmin') OR name = '슈퍼관리자')
    )
  );
