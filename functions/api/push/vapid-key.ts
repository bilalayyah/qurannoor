interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
}

interface Env {
  PUSH_KV?: KVNamespaceLike;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

export const onRequestGet = async (context: { env: Env }): Promise<Response> => {
  const { env } = context;

  if (!env.PUSH_KV) {
    return new Response(
      JSON.stringify({ publicKey: null, preview: true }),
      { status: 200, headers: JSON_HEADERS }
    );
  }

  try {
    const publicKey = await env.PUSH_KV.get('vapid:public');
    if (!publicKey) {
      // L-10 (re-audit): the key is not initialised yet — 503, not 200
      // with { publicKey: null }.
      return new Response(
        JSON.stringify({
          publicKey: null,
          preview: false,
          error: 'VAPID public key has not been initialized yet.',
        }),
        { status: 503, headers: JSON_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({ publicKey }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (err) {
    // L-9 (re-audit): log the detail server-side only; the client gets a
    // generic message.
    console.error('Failed to read VAPID public key', err);
    return new Response(
      JSON.stringify({ publicKey: null, error: 'Unable to read VAPID public key.' }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
};
