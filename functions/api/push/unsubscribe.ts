interface KVNamespaceLike {
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

  let body: UnsubscribePayload;
  try {
    body = (await request.json()) as UnsubscribePayload;
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
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to remove push subscription.',
      }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
};
