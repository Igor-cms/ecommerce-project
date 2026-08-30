
-- Table to track generated shipping labels
CREATE TABLE public.shipping_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_order_id TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  master_tracking_number TEXT,
  carrier TEXT NOT NULL DEFAULT 'FEDEX',
  service_type TEXT,
  label_path TEXT NOT NULL,
  weight_kg NUMERIC,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_shipping_labels_order ON public.shipping_labels(shopify_order_id);

ALTER TABLE public.shipping_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and owners can select shipping_labels"
ON public.shipping_labels FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins and owners can insert shipping_labels"
ON public.shipping_labels FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Service role can manage shipping_labels"
ON public.shipping_labels FOR ALL
USING (auth.role() = 'service_role');

-- Private storage bucket for label PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('shipping-labels', 'shipping-labels', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins and owners can read shipping-labels"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'shipping-labels'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

CREATE POLICY "Admins and owners can upload shipping-labels"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'shipping-labels'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);
