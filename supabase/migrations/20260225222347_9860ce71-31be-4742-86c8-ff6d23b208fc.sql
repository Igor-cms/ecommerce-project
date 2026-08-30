
CREATE TABLE public.inventory_deductions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_order_id TEXT NOT NULL UNIQUE,
  shopify_order_name TEXT,
  raw_material_id UUID REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  shopify_variant_id TEXT,
  quantity_deducted NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and owners can select inventory_deductions"
  ON public.inventory_deductions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins and owners can insert inventory_deductions"
  ON public.inventory_deductions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Service role can manage inventory_deductions"
  ON public.inventory_deductions FOR ALL
  USING (auth.role() = 'service_role');
