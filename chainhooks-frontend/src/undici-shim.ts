// Browser shim for 'undici'.
// The Chainhooks client requires undici in Node. In the browser, use the global fetch APIs.
export const fetch: typeof globalThis.fetch = (...args) => globalThis.fetch(...args as Parameters<typeof globalThis.fetch>);
export const Headers = globalThis.Headers;
export const Request = globalThis.Request as typeof globalThis.Request;
export const Response = globalThis.Response as typeof globalThis.Response;

export async function request(url: string | URL, options: any = {}) {
    const method = options.method || 'GET';
    const headers = options.headers || {};
    const body = options.body;

    const response = await fetch(url, {
        method,
        headers,
        body,
    });

    return {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: {
            text: () => response.text(),
            json: () => response.json(),
            blob: () => response.blob(),
            arrayBuffer: () => response.arrayBuffer(),
            // Fallback for stream access if needed, though .text() is preferred
            getReader: () => response.body?.getReader(),
        },
        trailers: {},
    };
}

export class Agent { }
export class Dispatcher { }
export function setGlobalDispatcher() { }
export function getGlobalDispatcher() { }

export default { fetch, Headers, Request, Response, request, Agent, Dispatcher, setGlobalDispatcher, getGlobalDispatcher };
