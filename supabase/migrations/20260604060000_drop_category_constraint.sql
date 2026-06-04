-- Drop the strict category check constraint on listings table 
-- to allow skill categories (Teaching, Repair, Cooking, Creative, etc.) 
-- alongside item categories.
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_category_check;
