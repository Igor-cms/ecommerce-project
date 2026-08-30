-- Allow admins and owners to read all favorites (needed for admin-side count display)
CREATE POLICY "Admins can read all favorites"
  ON public.favorites FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'));

-- Aggregated view: favorite count per product_slug
CREATE OR REPLACE VIEW public.product_favorites_counts AS
  SELECT product_slug, COUNT(*)::int AS favorites_count
  FROM public.favorites
  GROUP BY product_slug;

GRANT SELECT ON public.product_favorites_counts TO authenticated;
