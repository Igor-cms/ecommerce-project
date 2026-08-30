-- Add CPF and WhatsApp fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cpf text,
ADD COLUMN IF NOT EXISTS whatsapp text;

-- Update the handle_new_user function to include more fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, cpf, whatsapp, address)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'cpf',
    NEW.raw_user_meta_data->>'whatsapp', 
    NEW.raw_user_meta_data->>'address'
  );
  RETURN NEW;
END;
$function$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();