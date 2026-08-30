-- Allow admins and owners to read all favorites (needed for counts in admin)
CREATE POLICY "Admins and owners can read all favorites"
ON public.favorites
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

-- View aggregating favorite counts per product slug
CREATE OR REPLACE VIEW public.product_favorites_counts
WITH (security_invoker = true)
AS
SELECT
  product_slug,
  COUNT(*)::bigint AS favorite_count
FROM public.favorites
GROUP BY product_slug;

GRANT SELECT ON public.product_favorites_counts TO authenticated;