-- Guard against re-running: drop the policy if it exists before recreating it.
-- (The identical policy may already exist from the initial schema migration.)
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
