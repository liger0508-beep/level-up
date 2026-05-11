-- 1. Records Table: Admin/Coach can see everything
DROP POLICY IF EXISTS "Users can view own records" ON public.records;
CREATE POLICY "Users can view own records" ON public.records 
FOR SELECT USING ( 
  auth.uid() = user_id OR 
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'coach'))
);

-- 2. Schedules Table: Admin/Coach can see everything
DROP POLICY IF EXISTS "Users can view own schedules" ON public.schedules;
CREATE POLICY "Users can view own schedules" ON public.schedules 
FOR SELECT USING ( 
  auth.uid() = user_id OR 
  auth.uid() = creator_id OR
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'coach'))
);

-- 3. Users Table: Admin can manage all users
DROP POLICY IF EXISTS "Admin can manage all users" ON public.users;
CREATE POLICY "Admin can manage all users" ON public.users 
FOR ALL USING (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);
