"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trpcServer = void 0;
const fetch_1 = require("@trpc/server/adapters/fetch");
const trpcServer = ({ endpoint = '/trpc', createContext, ...rest }) => {
    const bodyProps = new Set(['arrayBuffer', 'blob', 'formData', 'json', 'text']);
    return async (c) => {
        const canWithBody = c.req.method === 'GET' || c.req.method === 'HEAD';
        const res = (0, fetch_1.fetchRequestHandler)({
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
exports.trpcServer = trpcServer;
