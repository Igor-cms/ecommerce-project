-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  company_name TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create coffees table
CREATE TABLE public.coffees (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  full_story TEXT,
  origin TEXT,
  farm TEXT,
  region TEXT,
  variety TEXT,
  altitude TEXT,
  producer TEXT,
  tastes_like TEXT[],
  processing TEXT,
  roast_profile TEXT,
  category TEXT NOT NULL DEFAULT 'specialty',
  pricing JSONB NOT NULL DEFAULT '{}',
  size_availability JSONB NOT NULL DEFAULT '{}',
  available BOOLEAN NOT NULL DEFAULT true,
  roast_options TEXT[],
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  shipping_address JSONB,
  billing_address JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order_items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  coffee_id INTEGER NOT NULL REFERENCES public.coffees(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  size TEXT NOT NULL,
  roast_option TEXT,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coffees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS Policies for coffees (public read, admin write)
CREATE POLICY "Anyone can view available coffees" 
ON public.coffees FOR SELECT 
USING (available = true);

CREATE POLICY "Authenticated users can view all coffees" 
ON public.coffees FOR SELECT 
TO authenticated
USING (true);

-- RLS Policies for orders
CREATE POLICY "Users can view their own orders" 
ON public.orders FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders" 
ON public.orders FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders" 
ON public.orders FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS Policies for order_items
CREATE POLICY "Users can view their own order items" 
ON public.order_items FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create order items for their orders" 
ON public.order_items FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = auth.uid()
  )
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coffees_updated_at
  BEFORE UPDATE ON public.coffees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert initial coffee data
INSERT INTO public.coffees (
  id, code, name, description, full_story, origin, farm, region, variety, altitude, producer,
  tastes_like, processing, roast_profile, category, pricing, size_availability, roast_options, image
) VALUES 
(1, 'VI', 'VIANI', 
 'A bright and fruity coffee with complex flavor notes',
 'This exceptional coffee comes from a small family farm in the mountains of Cundinamarca, Colombia. The farmers have been perfecting their craft for generations, using traditional methods combined with modern techniques to produce this outstanding coffee.',
 'CUNDINAMARCA, COLOMBIA', 'Finca El Paraiso', 'Cundinamarca', 'Caturra, Castillo', '1,800 - 2,000m', 'Carlos Rodriguez',
 ARRAY['STONEFRUIT', 'COCOA', 'GRAPE'], 'washed', 'Espresso / Filter', 'specialty',
 '{"125g": 8.50, "250g": 15.00, "1kg": 54.00}',
 '{"125g": true, "250g": true, "1kg": true}',
 ARRAY['Espresso', 'Filter'], '/api/placeholder/400/400'
),
(2, 'IS', 'INACIO SOARES',
 'Rich and chocolatey with floral notes and praline sweetness',
 'Inacio Soares is a pioneering producer in the Cerrado region of Minas Gerais, Brazil. His innovative anaerobic honey processing method creates unique flavor profiles that have won numerous awards in international competitions.',
 'MINAS GERAIS, BRAZIL', 'Fazenda Soares', 'Cerrado Mineiro', 'Yellow Bourbon', '1,200 - 1,400m', 'Inacio Soares',
 ARRAY['WHITE FLOWERS', 'PRALINE', 'CHOCOLATE'], 'anaerobic honey', 'Espresso / Filter', 'specialty',
 '{"125g": 9.50, "250g": 18.00, "1kg": 65.00}',
 '{"125g": true, "250g": true, "1kg": true}',
 ARRAY['Espresso', 'Filter'], '/api/placeholder/400/400'
);