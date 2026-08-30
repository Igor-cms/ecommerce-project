-- Fix RLS policies to avoid auth.users table access
-- Drop the existing admin policies that reference auth.users
DROP POLICY IF EXISTS "Admin can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can view all order items" ON public.order_items;  
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;

-- Create new admin policies using auth.jwt() to get user email
CREATE POLICY "Admin can view all orders" 
ON public.orders 
FOR SELECT 
USING (
  (auth.jwt() ->> 'email') = 'lucasmerhifaria@gmail.com'
);

CREATE POLICY "Admin can view all order items" 
ON public.order_items 
FOR SELECT 
USING (
  (auth.jwt() ->> 'email') = 'lucasmerhifaria@gmail.com'
);

CREATE POLICY "Admin can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.jwt() ->> 'email') = 'lucasmerhifaria@gmail.com'
);