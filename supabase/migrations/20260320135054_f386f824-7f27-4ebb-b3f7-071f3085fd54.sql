CREATE POLICY "Admins can delete applications"
ON public.wholesale_applications
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));