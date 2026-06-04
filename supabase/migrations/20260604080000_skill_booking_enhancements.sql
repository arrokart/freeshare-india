-- Migration: Add customizable booking limit to listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS max_bookings_per_user INTEGER DEFAULT 2 CHECK (max_bookings_per_user >= 1);

-- Migration: Add nudge rate-limiting field to claims
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS last_nudged_at TIMESTAMP WITH TIME ZONE;
