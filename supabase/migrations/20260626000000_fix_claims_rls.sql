-- Recreate claims INSERT policy to resolve RLS violation
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated user insert claims" ON public.claims;

CREATE POLICY "Allow authenticated user insert claims" 
ON public.claims 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = receiver_id);
