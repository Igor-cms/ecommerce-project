
ALTER TABLE public.inventory_deductions
  ADD COLUMN shopify_product_name text,
  ADD COLUMN shopify_variant_title text;

UPDATE inventory_deductions d
SET shopify_product_name = v.shopify_product_name,
    shopify_variant_title = v.shopify_variant_title
FROM raw_material_variants v
WHERE d.shopify_variant_id = v.shopify_variant_id
  AND d.shopify_product_name IS NULL;
