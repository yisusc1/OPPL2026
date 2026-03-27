-- Attempt to add values. 
-- Note: 'IF NOT EXISTS' is supported in PG 12+. 
-- If this fails, it means they might already exist (unlikely given the error) or syntax issue.
ALTER TYPE serial_status ADD VALUE IF NOT EXISTS 'DAMAGED';
ALTER TYPE serial_status ADD VALUE IF NOT EXISTS 'LOST';
ALTER TYPE serial_status ADD VALUE IF NOT EXISTS 'RETURNED';
