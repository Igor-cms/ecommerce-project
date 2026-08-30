-- Drop the existing policies that have incorrect authentication checks
DROP POLICY IF EXISTS "Authenticated users can upload coffee images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update coffee images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete coffee images" ON storage.objects;

-- Create corrected policies for coffee image uploads
CREATE POLICY "Anyone can upload coffee images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'coffee-images');

CREATE POLICY "Anyone can update coffee images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'coffee-images');

CREATE POLICY "Anyone can delete coffee images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'coffee-images');