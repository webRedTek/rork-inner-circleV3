-- Add missing policies for app_settings table
-- Currently only has SELECT policy, but needs INSERT and UPDATE for admin functionality

-- Enable RLS on app_settings table
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

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

-- Policy for admins to delete app settings (optional, for cleanup)
CREATE POLICY "Admins can delete app settings"
  ON public.app_settings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  ); 