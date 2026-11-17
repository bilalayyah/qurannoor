interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
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
  streak?: number;
  goalTarget?: number;
  goalUnit?: string;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

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

  let body: SubscriptionPayload;
  try {
    body = (await request.json()) as SubscriptionPayload;
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

  try {
    const parsedUrl = new URL(endpoint);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      throw new Error('Unsupported endpoint protocol');
    }
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid push subscription endpoint URL.' }),
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
      streak:
        typeof body.streak === 'number' && Number.isFinite(body.streak) && body.streak > 0
          ? Math.floor(body.streak)
          : 0,
      goalTarget:
        typeof body.goalTarget === 'number' && Number.isFinite(body.goalTarget) && body.goalTarget > 0
          ? Math.floor(body.goalTarget)
          : 10,
      goalUnit: body.goalUnit === 'pages' ? 'pages' : 'ayahs',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await env.PUSH_KV.put(kvKey, JSON.stringify(record));

    return new Response(
      JSON.stringify({ ok: true, id }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to store push subscription.',
      }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
};
