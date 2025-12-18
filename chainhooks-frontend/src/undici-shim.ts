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

    console.log(`[undici-shim] Request: ${method} ${url}`);

    const response = await fetch(url, {
        method,
        headers,
        body,
    });

    console.log(`[undici-shim] Response status: ${response.status}`);

    const responseBody = {
        text: async () => {
            console.log('[undici-shim] body.text() called');
            return await response.text();
        },
        json: async () => {
            console.log('[undici-shim] body.json() called');
            return await response.json();
        },
        blob: async () => await response.blob(),
        arrayBuffer: async () => await response.arrayBuffer(),
        getReader: () => response.body?.getReader(),
    };

    return {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
        trailers: {},
    };
}

export class Agent { }
export class Dispatcher { }
export function setGlobalDispatcher() { }
export function getGlobalDispatcher() { }

export default { fetch, Headers, Request, Response, request, Agent, Dispatcher, setGlobalDispatcher, getGlobalDispatcher };
