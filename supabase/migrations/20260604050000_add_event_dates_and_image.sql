-- Rename event_date to start_date
ALTER TABLE public.events RENAME COLUMN event_date TO start_date;

-- Add end_date column (nullable, but can be set by users)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;
