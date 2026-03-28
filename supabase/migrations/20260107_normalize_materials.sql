-- Add individual columns for materials and clients snapshot
alter table public.technician_daily_reports
add column if not exists conectores_used integer default 0,
add column if not exists conectores_remaining integer default 0,
add column if not exists conectores_defective integer default 0,
add column if not exists tensores_used integer default 0,
add column if not exists tensores_remaining integer default 0,
add column if not exists patchcords_used integer default 0,
add column if not exists patchcords_remaining integer default 0,
add column if not exists rosetas_used integer default 0,
add column if not exists clients_snapshot jsonb default '[]'::jsonb;
