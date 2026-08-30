-- Adicionar campo de observação admin à tabela orders
ALTER TABLE public.orders 
ADD COLUMN admin_notes TEXT;

-- Adicionar comentário para documentar o campo
COMMENT ON COLUMN public.orders.admin_notes IS 'Notas internas do administrador - não visível para o cliente';