-- Adicionar coluna de etiquetas aos pedidos
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Criar tabela para gerenciar tags disponíveis
CREATE TABLE IF NOT EXISTS public.order_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_tags ENABLE ROW LEVEL SECURITY;

-- Create policies for order_tags
CREATE POLICY "Admin can view all order tags" 
ON public.order_tags 
FOR SELECT 
USING ((auth.jwt() ->> 'email'::text) = 'lucasmerhifaria@gmail.com'::text);

CREATE POLICY "Admin can create order tags" 
ON public.order_tags 
FOR INSERT 
WITH CHECK ((auth.jwt() ->> 'email'::text) = 'lucasmerhifaria@gmail.com'::text);

CREATE POLICY "Admin can update order tags" 
ON public.order_tags 
FOR UPDATE 
USING ((auth.jwt() ->> 'email'::text) = 'lucasmerhifaria@gmail.com'::text);

CREATE POLICY "Admin can delete order tags" 
ON public.order_tags 
FOR DELETE 
USING ((auth.jwt() ->> 'email'::text) = 'lucasmerhifaria@gmail.com'::text);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_order_tags_updated_at
BEFORE UPDATE ON public.order_tags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default tags
INSERT INTO public.order_tags (name, color) VALUES 
  ('Urgente', '#ef4444'),
  ('VIP', '#f59e0b'),
  ('Processado', '#10b981'),
  ('Problema', '#f97316')
ON CONFLICT (name) DO NOTHING;