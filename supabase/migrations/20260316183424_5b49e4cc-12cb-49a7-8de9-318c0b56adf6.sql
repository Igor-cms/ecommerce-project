
CREATE TABLE public.xero_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  tenant_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.xero_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and owners can select xero_tokens"
  ON public.xero_tokens FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins and owners can insert xero_tokens"
  ON public.xero_tokens FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins and owners can update xero_tokens"
  ON public.xero_tokens FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins and owners can delete xero_tokens"
  ON public.xero_tokens FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Service role can manage xero_tokens"
  ON public.xero_tokens FOR ALL
  USING (auth.role() = 'service_role'::text);
