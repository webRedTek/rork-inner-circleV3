# Supabase Setup Guide

This directory contains SQL files for setting up your Supabase database for the EntrepreneurConnect app.

## Files

- `schema.sql` - Contains the database schema (tables, functions, policies)
- `seed.sql` - Contains sample data to populate your database for testing

## Setup Instructions

1. Create a new Supabase project at [https://app.supabase.com](https://app.supabase.com)

2. Get your Supabase URL and anon key from the project settings

3. Create a `.env` file in the root of your project with the following variables:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the schema SQL:
   - Go to the SQL Editor in your Supabase dashboard
   - Copy the contents of `schema.sql`
   - Paste into the SQL Editor and run

5. Run the seed SQL:
   - Go to the SQL Editor in your Supabase dashboard
   - Copy the contents of `seed.sql`
   - Paste into the SQL Editor and run

## Troubleshooting

### Missing Column Error

If you encounter an error like "Could not find the 'zip_code' column of 'users' in the schema cache", it means your database schema is out of sync with what the application expects.

To fix this:
1. Make sure you've run the latest `schema.sql` file
2. If you've made changes to the schema, you may need to refresh the schema cache:
   ```sql
   -- Run this in the SQL Editor
   SELECT pg_catalog.pg_reload_conf();
   ```

3. If the issue persists, you can manually add the missing column:
   ```sql
   -- Run this in the SQL Editor
   ALTER TABLE public.users ADD COLUMN IF NOT EXISTS zip_code text;
   ```

### EAS Build Issues

If you're having issues with EAS builds:

1. Make sure your `app.json` has the correct EAS project ID:
   ```json
   "extra": {
     "eas": {
       "projectId": "your-eas-project-id"
     }
   }
   ```

2. Run `npx eas-cli init` to initialize your EAS project if you haven't already

3. Make sure your `eas.json` has the correct configuration for builds