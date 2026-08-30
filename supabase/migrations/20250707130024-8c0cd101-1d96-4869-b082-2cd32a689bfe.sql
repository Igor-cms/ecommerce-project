-- Create client registrations table
CREATE TABLE public.client_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  company TEXT,
  address TEXT,
  phone_number TEXT,
  email TEXT,
  coffee_type TEXT,
  quantity_bags INTEGER,
  expected_delivery_date DATE,
  storage_duration_months INTEGER,
  payment_terms TEXT,
  additional_notes TEXT,
  information_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.client_registrations ENABLE ROW LEVEL SECURITY;

-- Create policies for client registrations (allow public access for new client registration)
CREATE POLICY "Anyone can insert client registrations" 
ON public.client_registrations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can view client registrations" 
ON public.client_registrations 
FOR SELECT 
USING (true);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_client_registrations_updated_at
BEFORE UPDATE ON public.client_registrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();