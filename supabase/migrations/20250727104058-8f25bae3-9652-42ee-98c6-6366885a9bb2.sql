-- Function to correct package sizes based on unit price comparison
CREATE OR REPLACE FUNCTION correct_order_item_sizes()
RETURNS TABLE (
  order_item_id uuid,
  old_size text,
  new_size text,
  unit_price numeric,
  coffee_name text,
  coffee_pricing jsonb
) AS $$
BEGIN
  -- Update order_items with corrected sizes and return report
  RETURN QUERY
  WITH size_corrections AS (
    SELECT 
      oi.id as order_item_id,
      oi.size as old_size,
      oi.unit_price,
      c.name as coffee_name,
      c.pricing as coffee_pricing,
      CASE 
        -- Compare unit_price with pricing options (allowing for small rounding differences)
        WHEN ABS(oi.unit_price - (c.pricing->>'125g')::numeric) < 0.01 THEN '125g'
        WHEN ABS(oi.unit_price - (c.pricing->>'250g')::numeric) < 0.01 THEN '250g'
        WHEN ABS(oi.unit_price - (c.pricing->>'1kg')::numeric) < 0.01 THEN '1kg'
        ELSE oi.size -- Keep original if no match found
      END as new_size
    FROM order_items oi
    JOIN coffees c ON oi.coffee_id = c.id
    WHERE c.pricing IS NOT NULL 
      AND c.pricing != '{}'::jsonb
  ),
  updated_items AS (
    UPDATE order_items 
    SET size = sc.new_size
    FROM size_corrections sc
    WHERE order_items.id = sc.order_item_id
      AND sc.old_size != sc.new_size
    RETURNING order_items.id
  )
  SELECT 
    sc.order_item_id,
    sc.old_size,
    sc.new_size,
    sc.unit_price,
    sc.coffee_name,
    sc.coffee_pricing
  FROM size_corrections sc
  WHERE sc.old_size != sc.new_size;
END;
$$ LANGUAGE plpgsql;

-- Execute the correction and show results
SELECT * FROM correct_order_item_sizes();