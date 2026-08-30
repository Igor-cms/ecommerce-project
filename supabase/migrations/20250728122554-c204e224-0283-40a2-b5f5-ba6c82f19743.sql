-- Create RLS policies for admin to view all orders and order items

-- Add admin policy for orders table - allows admin email to view all orders
CREATE POLICY "Admin can view all orders" 
ON public.orders 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email = 'lucasmerhifaria@gmail.com'
  )
);

-- Add admin policy for order_items table - allows admin email to view all order items
CREATE POLICY "Admin can view all order items" 
ON public.order_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email = 'lucasmerhifaria@gmail.com'
  )
);

-- Add admin policy for profiles table - allows admin to view all profiles 
CREATE POLICY "Admin can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email = 'lucasmerhifaria@gmail.com'
  )
);