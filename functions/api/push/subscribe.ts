interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
  PUSH_KV?: KVNamespaceLike;
}

interface SubscriptionPayload {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  subscription?: {
    endpoint?: string;
    expirationTime?: number | null;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

// M-10: best-effort per-IP rate limiting via KV (fail-open: a KV error or a
// missing CF-Connecting-IP skips limiting rather than breaking subscribe).
// The IP is SHA-256 hashed before storage; no raw IP is written to KV.
// Legitimate clients subscribe once per device; 10/hour/IP is generous.
// The primary protection should still be a Cloudflare dashboard rate-limit
// rule on /api/push/* (see report).
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

  // M-10: rate-limit subscriptions (10/hour/IP) before parsing the body.
  if (!(await checkPushRateLimit(env.PUSH_KV, request, 'subscribe', 10, 3600))) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Too many subscription attempts. Please try again later.' }),
      { status: 429, headers: JSON_HEADERS }
    );
  }

  // M-10: size cap — a subscription (endpoint + keys) is a few hundred bytes.
  // Read as text first so an oversized body is rejected before JSON parsing.
  let body: SubscriptionPayload;
  try {
    const text = await request.text();
    if (text.length > 4096) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Request body too large.' }),
        { status: 413, headers: JSON_HEADERS }
      );
    }
    body = JSON.parse(text) as SubscriptionPayload;
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid JSON request body.' }),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const rawSub = body.subscription || body;
  const endpoint = typeof rawSub?.endpoint === 'string' ? rawSub.endpoint.trim() : '';
  const p256dh = typeof rawSub?.keys?.p256dh === 'string' ? rawSub.keys.p256dh.trim() : '';
  const auth = typeof rawSub?.keys?.auth === 'string' ? rawSub.keys.auth.trim() : '';

  if (!endpoint || !p256dh || !auth) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Push subscription must include endpoint and keys (p256dh, auth).',
      }),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  // L-9 (re-audit): https: ONLY — an http: endpoint would let the push
  // payload travel unencrypted to the push service.
  try {
    const parsedUrl = new URL(endpoint);
    if (parsedUrl.protocol !== 'https:') {
      throw new Error('Unsupported endpoint protocol');
    }
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'Push subscription endpoint must use https.' }),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  try {
    const id = await hashEndpoint(endpoint);
    const kvKey = `sub:${id}`;
    const existingRaw = await env.PUSH_KV.get(kvKey);
    const existing = existingRaw ? (JSON.parse(existingRaw) as { createdAt?: string }) : null;
    const now = new Date().toISOString();

    const record = {
      endpoint,
      expirationTime:
        typeof rawSub.expirationTime === 'number' ? rawSub.expirationTime : null,
      keys: { p256dh, auth },
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await env.PUSH_KV.put(kvKey, JSON.stringify(record));

    return new Response(
      JSON.stringify({ ok: true, id }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (err) {
    // L-9 (re-audit): log the detail server-side only; the client gets a
    // generic message.
    console.error('Failed to store push subscription', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Failed to store push subscription.' }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
};
