-- 1. Cleanup
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.comments cascade;
drop table if exists public.schedules cascade;
drop table if exists public.records cascade;

drop table if exists public.users cascade;

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Users table (Extends Supabase Auth)
create table public.users (
  id uuid references auth.users not null primary key,
  name text not null,
  gender text check (gender in ('male', 'female', 'other')),
  dob date,
  phone text,
  branch text,
  role text check (role in ('admin', 'coach', 'athlete', 'parent')) default 'athlete',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Records table (Analysis, Lesson, Training)
create table public.records (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) not null,
  coach_id uuid references public.users(id),
  type text check (type in ('analysis', 'lesson', 'training')) not null,
  category text check (category in ('shot', 'pitch', 'bunker', 'approach', 'putt', 'physical', 'etc', 'field', 'short_game')) not null,
  title text,
  content text,
  media_urls text[] default '{}',
  video_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Schedules table
create table public.schedules (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) not null,
  creator_id uuid references public.users(id) not null,
  event_type text check (event_type in ('lesson', 'training', 'tournament', 'field_lesson')) not null,
  title text not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);



-- 6. Enable RLS
alter table public.users enable row level security;
alter table public.records enable row level security;
alter table public.schedules enable row level security;

-- 6.1 Setup RLS Policies for Users
create policy "Anyone can view profiles" on public.users for select using ( true );
create policy "Users can update own profile" on public.users for update using ( auth.uid() = id );

-- 6.2 RLS for Records
create policy "Users can view own records" on public.records for select using ( auth.uid() = user_id );
create policy "Coaches and admins can manage records" on public.records for all using ( 
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'coach'))
);
-- Temporary policy to allow insertion during development
create policy "Allow insert for testing" on public.records for insert with check ( true );

-- 6.3 RLS for Schedules
create policy "Users can view own schedules" on public.schedules for select using ( auth.uid() = user_id or auth.uid() = creator_id );
create policy "Coaches can manage all schedules" on public.schedules for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'coach'))
);



-- 7. Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, role, phone, branch)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'name', 'User'), 
    coalesce(new.raw_user_meta_data->>'role', 'athlete'), 
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'branch'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

