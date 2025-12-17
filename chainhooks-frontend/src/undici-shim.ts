// Browser shim for 'undici'.
// The Chainhooks client requires undici in Node. In the browser, use the global fetch APIs.
export const fetch: typeof globalThis.fetch = (...args) => globalThis.fetch(...args as Parameters<typeof globalThis.fetch>);
export const Headers = globalThis.Headers;
export const Request = globalThis.Request as typeof globalThis.Request;
export const Response = globalThis.Response as typeof globalThis.Response;

export default { fetch, Headers, Request, Response };
