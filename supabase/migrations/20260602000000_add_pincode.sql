-- Add pincode columns to listings and users tables
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);
