-- Add no_emojis flag to profiles table
-- When true, WhatsApp reports use plain text instead of emojis
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS no_emojis BOOLEAN DEFAULT false;
