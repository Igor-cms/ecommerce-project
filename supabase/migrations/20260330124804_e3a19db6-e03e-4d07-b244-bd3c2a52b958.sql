
CREATE TABLE public.wholesale_vat_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  vat_number text,
  vat_exempt boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wholesale_vat_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own vat info" ON public.wholesale_vat_info
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vat info" ON public.wholesale_vat_info
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vat info" ON public.wholesale_vat_info
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all vat info" ON public.wholesale_vat_info
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));
