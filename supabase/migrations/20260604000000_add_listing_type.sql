-- Add listing_type column to support Skill Share listings alongside free item listings
-- All existing rows default to 'item' automatically
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS listing_type TEXT
  DEFAULT 'item'
  CHECK (listing_type IN ('item', 'skill'));

-- Add skill_duration column to replace 'condition' for skill listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS skill_duration TEXT
  CHECK (skill_duration IN ('15 min', '30 min', '1 hour', 'Flexible', NULL));
