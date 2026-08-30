
-- Fix user_roles SELECT policy: allow admin, owner, and self-read
DROP POLICY "Admins can read user_roles" ON public.user_roles;

CREATE POLICY "Admins and owners can read user_roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'owner'::app_role)
  );

CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Fix page_settings UPDATE policy: allow owner too
DROP POLICY "Admins can update page_settings" ON public.page_settings;

CREATE POLICY "Admins and owners can update page_settings"
  ON public.page_settings FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'owner'::app_role)
  );
