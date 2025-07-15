import type { AnyRouter } from '@trpc/server';
import type { FetchCreateContextFnOptions, FetchHandlerRequestOptions } from '@trpc/server/adapters/fetch';
import type { Context, MiddlewareHandler } from 'hono';
type tRPCOptions = Omit<FetchHandlerRequestOptions<AnyRouter>, 'req' | 'endpoint' | 'createContext'> & Partial<Pick<FetchHandlerRequestOptions<AnyRouter>, 'endpoint'>> & {
    createContext?(opts: FetchCreateContextFnOptions, c: Context): Record<string, unknown> | Promise<Record<string, unknown>>;
};
export declare const trpcServer: ({ endpoint, createContext, ...rest }: tRPCOptions) => MiddlewareHandler;
export {};
