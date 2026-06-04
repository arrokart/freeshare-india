-- Allow NULL condition for skill listings (items still require condition via app-level validation)
ALTER TABLE public.listings ALTER COLUMN condition DROP NOT NULL;
