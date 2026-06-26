-- Optimize claims INSERT policy for query performance
DROP POLICY IF EXISTS "Allow authenticated user insert claims" ON public.claims;

CREATE POLICY "Allow authenticated user insert claims" 
ON public.claims 
FOR INSERT 
TO authenticated
WITH CHECK (receiver_id = (select auth.uid()));
