DROP TABLE IF EXISTS public.training_templates CASCADE;

CREATE TABLE public.training_templates (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  "categoryId" text NOT NULL,
  title text NOT NULL,
  description text,
  purpose text,
  goal text,
  "mediaUrl" text,
  "mediaType" text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.training_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public training templates access" ON public.training_templates;
CREATE POLICY "Public training templates access" ON public.training_templates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow temp insert for test" ON public.training_templates;
CREATE POLICY "Allow temp insert for test" ON public.training_templates FOR ALL USING (true);
