-- Add skill_tags column for custom searchable skill tags on skill listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS skill_tags TEXT[] DEFAULT '{}';
