-- Create dedicated keep_alive table for keep-alive cron job pings
create table public.keep_alive (
  id uuid primary key default gen_random_uuid(),
  pinged_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS)
alter table public.keep_alive enable row level security;
