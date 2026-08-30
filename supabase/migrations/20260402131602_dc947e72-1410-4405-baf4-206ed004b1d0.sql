
CREATE TABLE public.xero_emails_sent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id TEXT NOT NULL UNIQUE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.xero_emails_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage xero_emails_sent"
ON public.xero_emails_sent
FOR ALL
USING (auth.role() = 'service_role'::text);

CREATE POLICY "Admins and owners can view xero_emails_sent"
ON public.xero_emails_sent
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));
