-- Add new values to the enum
ALTER TYPE serial_status ADD VALUE IF NOT EXISTS 'DAMAGED';
ALTER TYPE serial_status ADD VALUE IF NOT EXISTS 'LOST';
ALTER TYPE serial_status ADD VALUE IF NOT EXISTS 'RETURNED';

-- Safety check: Re-verify RPC just in case type change affected it (it shouldn't, but good to be safe)
-- (No need to recreate RPC if it just uses text comparison, but if it relies on type casting it might need a nudge depending on pg version, usually fine).
