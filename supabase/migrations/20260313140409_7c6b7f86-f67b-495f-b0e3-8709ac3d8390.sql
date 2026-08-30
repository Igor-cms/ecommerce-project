
CREATE TABLE public.order_separations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_order_id text NOT NULL UNIQUE,
  separated_at timestamptz NOT NULL DEFAULT now(),
  separated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.order_separations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and owners can manage order_separations"
  ON public.order_separations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
