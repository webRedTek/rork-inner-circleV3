-- Fix Admin Settings Saving Issue
-- Run this in your Supabase SQL editor

-- 1. Enable RLS on app_settings table (if not already enabled)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can view app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can insert app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can delete app settings" ON public.app_settings;

-- 3. Create new policies
-- Policy for anyone to view app settings (for public access)
CREATE POLICY "Anyone can view app settings"
  ON public.app_settings FOR SELECT
  USING (true);

-- Policy for admins to insert app settings
CREATE POLICY "Admins can insert app settings"
  ON public.app_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Policy for admins to update app settings
CREATE POLICY "Admins can update app settings"
  ON public.app_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Policy for admins to delete app settings (optional)
CREATE POLICY "Admins can delete app settings"
  ON public.app_settings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- 4. Fix daily_like_limit to be NOT NULL (if it's currently nullable)
ALTER TABLE public.app_settings 
ALTER COLUMN daily_like_limit SET NOT NULL;

-- 5. Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'app_settings'; 