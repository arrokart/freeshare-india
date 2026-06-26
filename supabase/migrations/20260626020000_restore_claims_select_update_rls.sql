-- Restore all missing RLS policies for the claims table
-- The SELECT and UPDATE policies were missing from the live database,
-- which caused INSERT operations (with RETURNING) to fail with RLS violations.

-- Restore SELECT policy (allows receivers and listing donors to view claims)
DROP POLICY IF EXISTS "Allow view relevant claims" ON public.claims;
CREATE POLICY "Allow view relevant claims" 
ON public.claims 
FOR SELECT 
TO authenticated
USING (
  (select auth.uid()) = receiver_id 
  OR EXISTS (
    SELECT 1 FROM public.listings 
    WHERE listings.id = claims.listing_id 
    AND listings.donor_id = (select auth.uid())
  )
);

-- Restore UPDATE policy (allows receivers and listing donors to update claims)
DROP POLICY IF EXISTS "Allow update relevant claims" ON public.claims;
CREATE POLICY "Allow update relevant claims" 
ON public.claims 
FOR UPDATE 
TO authenticated
USING (
  (select auth.uid()) = receiver_id 
  OR EXISTS (
    SELECT 1 FROM public.listings 
    WHERE listings.id = claims.listing_id 
    AND listings.donor_id = (select auth.uid())
  )
);
