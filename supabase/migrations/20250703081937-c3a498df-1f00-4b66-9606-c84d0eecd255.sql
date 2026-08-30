-- Add INSERT, UPDATE, DELETE policies for coffees table to allow management
CREATE POLICY "Anyone can insert coffees" 
ON coffees 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update coffees" 
ON coffees 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete coffees" 
ON coffees 
FOR DELETE 
USING (true);