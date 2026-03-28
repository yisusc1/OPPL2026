create table if not exists public.technician_daily_reports (
  id uuid not null default gen_random_uuid(),
  user_id uuid references auth.users(id),
  team_id uuid references public.teams(id),
  date text not null,
  vehicle_id uuid references public.vehiculos(id),
  onu_serials jsonb default '[]',
  router_serials jsonb default '[]',
  materials jsonb default '{}',
  spools jsonb default '[]',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint technician_daily_reports_pkey primary key (id),
  constraint technician_daily_reports_user_date_key unique (user_id, date)
);

-- Enable RLS
alter table public.technician_daily_reports enable row level security;

-- Policies
create policy "Users can view their own reports"
on public.technician_daily_reports for select
using (auth.uid() = user_id);

create policy "Users can insert/update their own reports"
on public.technician_daily_reports for all
using (auth.uid() = user_id);
