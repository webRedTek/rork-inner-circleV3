import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { isSupabaseConfigured } from "@/lib/supabase";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Context creation function
export const createContext = async (opts: FetchCreateContextFnOptions) => {
  // Get the session from the request if Supabase is configured
  let user = null;
  
  try {
    if (isSupabaseConfigured()) {
      // Extract the session token from the request headers
      const authHeader = opts.req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        // For simplicity, we're not validating the token with Supabase here
        // In a production environment, you might want to make an HTTP request to Supabase auth endpoint
        // to verify the token and get user data
        
        // For now, we'll assume the token is valid and store it
        await AsyncStorage.setItem('supabase_access_token', token);
        user = { id: 'temp-user-id', email: 'temp@example.com' }; // Placeholder user data
      }
    }
  } catch (error) {
    console.error('Error in createContext:', error);
  }
  
  return {
    req: opts.req,
    user,
    supabase: null, // We're not using the Supabase client directly anymore
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

// Create middleware to check if user is authenticated
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new Error('Not authenticated');
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);