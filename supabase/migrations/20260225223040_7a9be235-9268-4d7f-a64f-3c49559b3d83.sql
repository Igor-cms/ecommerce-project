
ALTER TABLE public.inventory_deductions DROP CONSTRAINT inventory_deductions_shopify_order_id_key;
CREATE UNIQUE INDEX inventory_deductions_order_variant_idx ON public.inventory_deductions (shopify_order_id, shopify_variant_id) WHERE shopify_variant_id IS NOT NULL;
CREATE UNIQUE INDEX inventory_deductions_order_null_variant_idx ON public.inventory_deductions (shopify_order_id) WHERE shopify_variant_id IS NULL;
