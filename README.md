# Entrepreneur Connect

A networking app for entrepreneurs to connect, collaborate, and grow their businesses.

## Environment Setup

This app requires Supabase for backend functionality. You need to set up the following environment variables:

```
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

You can create a `.env` file in the root directory with these variables. See `.env.example` for reference.

## Development

```bash
# Install dependencies
npm install

# Start the development server
npm start

# Start with web support
npm run start-web

# Run Supabase tests
npm run test:supabase
```

## Building for Preview/Production

```bash
# Build a preview version
npm run build:preview

# Build a production version
npm run build:production
```

## Troubleshooting

### Environment Variables Not Detected

If your `.env` file is not being detected:

1. Make sure the file is named exactly `.env` (not `.env.local` or similar)
2. Make sure all environment variables start with `EXPO_PUBLIC_`
3. Restart your development server with the `-c` flag to clear cache:
   ```
   expo start -c
   ```
4. On Android/iOS, you may need to rebuild the app after changing environment variables

### Supabase Connection Issues

Use the Supabase Test screen to diagnose connection issues:

1. Navigate to `/supabase-test` in the app
2. Run the connection test
3. Check the error messages for specific issues

### TypeScript Errors

If you encounter TypeScript errors related to types:

1. Make sure your types in `types/user.ts` match the actual data structure
2. Run `npx tsc --noEmit` to check for type errors without building

## Database Schema

See `supabase/schema.sql` for the database schema and `supabase/README.md` for setup instructions.// Force deployment Sun Jun  8 19:23:11 EDT 2025
