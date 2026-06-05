-- Add can_create_events column to users table with default true
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS can_create_events BOOLEAN DEFAULT TRUE;
