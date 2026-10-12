import type { Context } from '@netlify/functions';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export type LocalFunction = (request: Request, context: Context) => Response | Promise<Response>;

export interface LocalFunctionHandlers {
  api: LocalFunction;
}

const LOCAL_IP = '127.0.0.1';
const FUNCTION_PREFIX = '/.netlify/functions';

function resolveHandler(
  pathname: string,
  handlers: LocalFunctionHandlers,
): LocalFunction | undefined {
  const route = pathname.startsWith(FUNCTION_PREFIX)
    ? pathname.slice(FUNCTION_PREFIX.length)
    : pathname;
  const normalizedRoute = route.replace(/\/$/, '') || '/';

  if (normalizedRoute === '/api') return handlers.api;
  return undefined;
}

function buildWebRequest(incoming: IncomingMessage, abortSignal: AbortSignal): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else {
      headers.set(name, value);
    }
  }

  const method = incoming.method ?? 'GET';
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
    signal: abortSignal,
  };
  if (hasBody) {
    init.body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>;
    init.duplex = 'half';
  }

  return new Request(new URL(incoming.url ?? '/', 'http://127.0.0.1'), init);
}

function applyWebResponse(response: Response, outgoing: ServerResponse): void {
  outgoing.statusCode = response.status;
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() !== 'set-cookie') outgoing.setHeader(name, value);
  });

  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) outgoing.setHeader('Set-Cookie', cookies);
}

function jsonResponse(status: number, body: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  });
}

async function handleRequest(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
  handlers: LocalFunctionHandlers,
): Promise<void> {
  const abortController = new AbortController();
  incoming.once('aborted', () => abortController.abort());
  outgoing.once('close', () => {
    if (!outgoing.writableEnded) abortController.abort();
  });

  try {
    const url = new URL(incoming.url ?? '/', 'http://127.0.0.1');
    const handler = resolveHandler(url.pathname, handlers);
    const response = handler
      ? await handler(buildWebRequest(incoming, abortController.signal), {
          ip: LOCAL_IP,
        } as Context)
      : jsonResponse(404, { error: 'Function not found' });

    applyWebResponse(response, outgoing);
    if (!response.body) {
      outgoing.end();
      return;
    }

    await pipeline(
      Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
      outgoing,
    );
  } catch {
    if (outgoing.headersSent) {
      outgoing.destroy();
      return;
    }
    const response = jsonResponse(500, { error: 'Local function failed' });
    applyWebResponse(response, outgoing);
    outgoing.end(await response.text());
  }
}

/** Local-only adapter for the actual Netlify Request/Response function handlers. */
export function createLocalFunctionServer(handlers: LocalFunctionHandlers): Server {
  return createServer((incoming, outgoing) => {
    void handleRequest(incoming, outgoing, handlers);
  });
}
