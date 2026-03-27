-- 1. Create the 'vehiculos' storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('vehiculos', 'vehiculos', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage policies for 'vehiculos' bucket
-- Allow public read access to images
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'vehiculos' );

-- Allow authenticated users to upload images
CREATE POLICY "Auth Upload Access" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'vehiculos' );

-- Allow authenticated users to update their own uploads (optional but good practice)
CREATE POLICY "Auth Update Access" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING ( bucket_id = 'vehiculos' );

-- Allow authenticated users to delete images
CREATE POLICY "Auth Delete Access" 
ON storage.objects FOR DELETE 
TO authenticated 
USING ( bucket_id = 'vehiculos' );

-- 3. RLS Policies for 'vehiculos' table itself
-- Ensure authenticated users can insert and update vehiculos records
-- Note: Replace 'authenticated' with a specific role check if your app uses custom roles for admins

CREATE POLICY "Enable insert for authenticated users" ON public.vehiculos
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.vehiculos
    FOR UPDATE 
    TO authenticated 
    USING (true)
    WITH CHECK (true);

-- 4. Reload schema cache 
NOTIFY pgrst, 'reload schema';
