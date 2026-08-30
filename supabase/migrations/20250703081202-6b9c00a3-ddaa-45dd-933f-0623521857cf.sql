-- Create storage bucket for coffee images
INSERT INTO storage.buckets (id, name, public) VALUES ('coffee-images', 'coffee-images', true);

-- Create policies for coffee image uploads
CREATE POLICY "Coffee images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'coffee-images');

CREATE POLICY "Authenticated users can upload coffee images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'coffee-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update coffee images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'coffee-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete coffee images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'coffee-images' AND auth.role() = 'authenticated');