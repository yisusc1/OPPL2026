-- Add cedula column to soportes table to allow loose coupling with clients
alter table public.soportes
add column if not exists cedula text;
