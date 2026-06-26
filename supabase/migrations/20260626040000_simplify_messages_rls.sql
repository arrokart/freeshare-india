-- Drop over-complicated messages policies that cause issues and slow down select queries
DROP POLICY IF EXISTS "Allow members of claim to select messages" ON public.messages;
DROP POLICY IF EXISTS "Allow members of claim to insert messages" ON public.messages;

-- Create highly optimized, simple SELECT policy using claims.donor_id directly
CREATE POLICY "Allow members of claim to select messages" 
ON public.messages 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.claims 
    WHERE claims.id = messages.claim_id 
    AND (claims.receiver_id = (select auth.uid()) OR claims.donor_id = (select auth.uid()))
  )
);

-- Create highly optimized, simple INSERT policy using claims.donor_id directly
CREATE POLICY "Allow members of claim to insert messages" 
ON public.messages 
FOR INSERT 
TO authenticated
WITH CHECK (
  (select auth.uid()) = sender_id 
  AND EXISTS (
    SELECT 1 FROM public.claims 
    WHERE claims.id = messages.claim_id 
    AND (claims.receiver_id = (select auth.uid()) OR claims.donor_id = (select auth.uid()))
  )
);
