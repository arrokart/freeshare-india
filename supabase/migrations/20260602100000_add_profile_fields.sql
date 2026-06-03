-- Add phone and show_phone columns to public.users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS show_phone BOOLEAN DEFAULT FALSE;
