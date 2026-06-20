-- Run this in the Supabase SQL Editor (your existing Chronos Unified project)
-- Creates the tables for the Job Appointment Calendar app, scoped per-user.

create table if not exists contract_jobs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null,
  job_title text not null,
  color text not null,
  rate_type text not null check (rate_type in ('hourly', 'flat')),
  rate_amount numeric not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists appointments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text not null references contract_jobs(id) on delete cascade,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  location text,
  notes text,
  status text not null check (status in ('scheduled', 'completed', 'cancelled')),
  synced_google boolean default false,
  synced_outlook boolean default false,
  recurrence text,
  recurrence_count integer,
  recurrence_group_id text,
  reminder boolean default false,
  created_at timestamptz not null default now()
);

alter table contract_jobs enable row level security;
alter table appointments enable row level security;

-- Each user can only see and modify their own rows.
create policy "Users manage their own jobs"
  on contract_jobs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own appointments"
  on appointments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
