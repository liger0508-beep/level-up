CREATE TABLE IF NOT EXISTS public.lesson_templates (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  "categoryId" text NOT NULL,
  title text NOT NULL,
  description text,
  "imageUrl" text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.lesson_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public lesson templates access" ON public.lesson_templates;
CREATE POLICY "Public lesson templates access" ON public.lesson_templates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow temp insert for test" ON public.lesson_templates;
CREATE POLICY "Allow temp insert for test" ON public.lesson_templates FOR ALL USING (true);
