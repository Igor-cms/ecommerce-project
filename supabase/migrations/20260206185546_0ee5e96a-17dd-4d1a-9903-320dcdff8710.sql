
-- Create page_settings table
CREATE TABLE public.page_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  label text NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.page_settings ENABLE ROW LEVEL SECURITY;

-- Create role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: Anyone can read page settings (needed for site rendering)
CREATE POLICY "Anyone can read page_settings"
  ON public.page_settings FOR SELECT
  USING (true);

-- RLS: Only admins can update page settings
CREATE POLICY "Admins can update page_settings"
  ON public.page_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS: Only admins can read user_roles
CREATE POLICY "Admins can read user_roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed default page settings (all visible)
INSERT INTO public.page_settings (slug, label, is_visible) VALUES
  ('shop', 'Shop / Catalogue', true),
  ('subscriptions', 'Subscriptions', true),
  ('about', 'About', true),
  ('brew-guides', 'Brew Guides', true),
  ('support', 'Support', true),
  ('carrinho', 'Cart', true),
  ('login', 'Login', true),
  ('register', 'Register', true),
  ('meus-pedidos', 'My Orders', true);
