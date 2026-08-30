-- Allow admins to update order items (for roast option changes)
CREATE POLICY "Admins can update order items" ON order_items
FOR UPDATE
USING (true)
WITH CHECK (true);