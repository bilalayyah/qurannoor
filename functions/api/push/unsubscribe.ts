interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

interface Env {
  PUSH_KV?: KVNamespaceLike;
}

interface UnsubscribePayload {
  endpoint?: string;
  subscription?: {
    endpoint?: string;
  };
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

// M-10: best-effort per-IP rate limiting via KV (fail-open). See subscribe.ts
// for the rationale; unsubscribe is limited to 20/hour/IP.
async function hashString(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

async function checkPushRateLimit(
  kv: KVNamespaceLike,
  request: Request,
  action: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) return true;
    const windowId = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `rl:push:${action}:${await hashString(ip)}:${windowId}`;
    const raw = await kv.get(key);
    const count = raw ? parseInt(raw, 10) || 0 : 0;
    if (count >= limit) return false;
    await kv.put(key, String(count + 1), { expirationTtl: windowSeconds + 60 });
    return true;
  } catch (e) {
    console.error('Push rate-limit check failed (failing open)', e);
    return true;
  }
}

async function hashEndpoint(endpoint: string): Promise<string> {
  const bytes = new TextEncoder().encode(endpoint);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;

  if (!env.PUSH_KV) {
    return new Response(
      JSON.stringify({
        ok: false,
        preview: true,
        error: 'Push backend not connected in preview.',
      }),
      { status: 503, headers: JSON_HEADERS }
    );
  }

  // M-10: rate-limit unsubscribes (20/hour/IP) before parsing the body.
  if (!(await checkPushRateLimit(env.PUSH_KV, request, 'unsubscribe', 20, 3600))) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Too many requests. Please try again later.' }),
      { status: 429, headers: JSON_HEADERS }
    );
  }

  // M-10: size cap — an unsubscribe body is just an endpoint URL.
  let body: UnsubscribePayload;
  try {
    const text = await request.text();
    if (text.length > 2048) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Request body too large.' }),
        { status: 413, headers: JSON_HEADERS }
      );
    }
    body = JSON.parse(text) as UnsubscribePayload;
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid JSON request body.' }),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const endpoint =
    typeof body.endpoint === 'string'
      ? body.endpoint.trim()
      : typeof body.subscription?.endpoint === 'string'
      ? body.subscription.endpoint.trim()
      : '';

  if (!endpoint) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Push subscription endpoint is required.' }),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  try {
    const id = await hashEndpoint(endpoint);
    await env.PUSH_KV.delete(`sub:${id}`);

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (err) {
    // L-9 (re-audit): log the detail server-side only; the client gets a
    // generic message.
    console.error('Failed to remove push subscription', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Failed to remove push subscription.' }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
};
