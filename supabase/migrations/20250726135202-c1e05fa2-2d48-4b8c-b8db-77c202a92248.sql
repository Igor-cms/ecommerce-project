-- Add column to orders table to track WhatsApp referral
ALTER TABLE public.orders 
ADD COLUMN whatsapp_referral boolean DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.orders.whatsapp_referral IS 'Indicates if the customer came from CC ROAST WhatsApp group';