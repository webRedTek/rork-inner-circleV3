import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
export const trpcServer = ({ endpoint = '/trpc', createContext, ...rest }) => {
    const bodyProps = new Set(['arrayBuffer', 'blob', 'formData', 'json', 'text']);
    return async (c) => {
        const canWithBody = c.req.method === 'GET' || c.req.method === 'HEAD';
        const res = fetchRequestHandler({
            ...rest,
            createContext: async (opts) => ({
                ...(createContext ? await createContext(opts, c) : {}),
                // propagate env by default
                env: c.env,
            }),
            endpoint,
            req: canWithBody
                ? c.req.raw
                : new Proxy(c.req.raw, {
                    get(t, p, _r) {
                        if (bodyProps.has(p)) {
                            return () => c.req[p]();
                        }
                        return Reflect.get(t, p, t);
                    },
                }),
        }).then((res) => c.body(res.body, res));
        return res;
    };
};
