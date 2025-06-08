import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { isSupabaseConfigured, createSupabaseClient } from "@/lib/supabase";

// Context creation function
export const createContext = async (opts: FetchCreateContextFnOptions) => {
  // Get the session from the request if Supabase is configured
  let user = null;
  let supabase = null;
  
  try {
    if (isSupabaseConfigured()) {
      supabase = createSupabaseClient();
      
      if (supabase) {
        // Extract the session token from the request headers
        const authHeader = opts.req.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          
          try {
            // Verify the token with Supabase
            const { data, error } = await supabase.auth.getUser(token);
            if (!error && data.user) {
              user = data.user;
            }
          } catch (error) {
            console.error('Error verifying token:', error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in createContext:', error);
  }
  
  return {
    req: opts.req,
    user,
    supabase,
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