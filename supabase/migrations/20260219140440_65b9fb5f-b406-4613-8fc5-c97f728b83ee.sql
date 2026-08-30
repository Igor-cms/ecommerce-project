
-- Create raw_materials table
CREATE TABLE public.raw_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  quantity_available NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'g',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create raw_material_variants junction table
CREATE TABLE public.raw_material_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  shopify_variant_id TEXT NOT NULL,
  shopify_product_name TEXT NOT NULL DEFAULT '',
  shopify_variant_title TEXT NOT NULL DEFAULT '',
  quantity_per_unit NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_material_variants ENABLE ROW LEVEL SECURITY;

-- RLS policies for raw_materials (admin/owner only)
CREATE POLICY "Admins and owners can select raw_materials"
ON public.raw_materials FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Admins and owners can insert raw_materials"
ON public.raw_materials FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Admins and owners can update raw_materials"
ON public.raw_materials FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Admins and owners can delete raw_materials"
ON public.raw_materials FOR DELETE
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- RLS policies for raw_material_variants (admin/owner only)
CREATE POLICY "Admins and owners can select raw_material_variants"
ON public.raw_material_variants FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Admins and owners can insert raw_material_variants"
ON public.raw_material_variants FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Admins and owners can update raw_material_variants"
ON public.raw_material_variants FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Admins and owners can delete raw_material_variants"
ON public.raw_material_variants FOR DELETE
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- Trigger for updated_at on raw_materials
CREATE OR REPLACE FUNCTION public.update_raw_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_raw_materials_updated_at
BEFORE UPDATE ON public.raw_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_raw_materials_updated_at();
