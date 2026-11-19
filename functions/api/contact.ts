// Contact form handler — POST /api/contact
//
// SETUP REQUIRED (owner): set the CONTACT_ENDPOINT environment variable in
// the Cloudflare Pages project settings (Settings → Environment variables).
// It must be the full URL of the form-delivery endpoint that should receive
// submissions (for example the FormSubmit AJAX endpoint for the site's inbox).
// The destination address lives ONLY in that server-side variable: it is
// never committed to the repo and never shipped in the client bundle.
//
// Until CONTACT_ENDPOINT is set, this Function returns HTTP 503 with a clear
// error ("Contact delivery is not configured") — it never silently drops a
// message and never pretends a submission succeeded.
//
// In Cloudflare Pages routing, this literal route file (functions/api/contact.ts)
// takes precedence over the functions/api/[[path]].ts catch-all, so no
// exclusion for "contact" is needed in the proxy. (The proxy only handles
// GET requests anyway.)

interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
  CONTACT_ENDPOINT?: string;
  // M-3 (re-audit): PUSH_KV is bound project-wide in wrangler.toml, so it
  // is available to this Function too. Used ONLY for the best-effort
  // per-IP rate-limit counters below (keys prefixed rl:contact:).
  PUSH_KV?: KVNamespaceLike;
}

interface ContactPayload {
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
  website?: unknown;
  source?: unknown;
}

// M-3 (re-audit): max field lengths (previously only minima were checked).
const MAX_NAME_LENGTH = 100;
const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;
// M-3 (re-audit): body-size cap (~16 KB). Read as text first so an
// oversized body is rejected before JSON parsing.
const MAX_BODY_CHARS = 16384;

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// M-3 (re-audit): best-effort per-IP rate limiting via KV, reusing the push
// pattern (functions/api/push/subscribe.ts): 5 submissions/hour/IP.
// Fail-open: a KV error, a missing binding, or a missing CF-Connecting-IP
// skips limiting rather than breaking the contact form. The IP is SHA-256
// hashed before storage; no raw IP is written to KV.
async function hashString(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

async function checkContactRateLimit(
  kv: KVNamespaceLike | undefined,
  request: Request
): Promise<boolean> {
  try {
    if (!kv) return true;
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) return true;
    const windowId = Math.floor(Date.now() / 3600_000);
    const key = `rl:contact:submit:${await hashString(ip)}:${windowId}`;
    const raw = await kv.get(key);
    const count = raw ? parseInt(raw, 10) || 0 : 0;
    if (count >= 5) return false;
    await kv.put(key, String(count + 1), { expirationTtl: 3660 });
    return true;
  } catch (e) {
    console.error('Contact rate-limit check failed (failing open)', e);
    return true;
  }
}

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;

  // M-3 (re-audit): rate-limit before parsing the body.
  if (!(await checkContactRateLimit(env.PUSH_KV, request))) {
    return jsonResponse(
      { error: 'Too many messages. Please try again later.' },
      429
    );
  }

  let payload: ContactPayload;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) {
      return jsonResponse({ error: 'Request body too large.' }, 413);
    }
    payload = JSON.parse(text) as ContactPayload;
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
  }

  // Anti-spam honeypot: silently accept (without forwarding) submissions
  // that filled the hidden "website" field, exactly like the client does.
  if (typeof payload.website === 'string' && payload.website.trim() !== '') {
    return jsonResponse({ ok: true }, 200);
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const subject = typeof payload.subject === 'string' ? payload.subject.trim() : 'General Feedback';
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';

  if (name.length < 2) {
    return jsonResponse({ error: 'Please enter your name (at least 2 characters).' }, 400);
  }
  if (name.length > MAX_NAME_LENGTH) {
    return jsonResponse(
      { error: 'Please keep your name to 100 characters or fewer.' },
      400
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Please enter a valid email address.' }, 400);
  }
  if (subject.length > MAX_SUBJECT_LENGTH) {
    return jsonResponse(
      { error: 'Please keep the subject to 200 characters or fewer.' },
      400
    );
  }
  if (message.length < 15) {
    return jsonResponse({ error: 'Please enter a clear message (at least 15 characters).' }, 400);
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return jsonResponse(
      { error: 'Please keep your message to 5000 characters or fewer.' },
      400
    );
  }

  const endpoint = env.CONTACT_ENDPOINT?.trim();
  if (!endpoint) {
    return jsonResponse(
      {
        error:
          'Contact delivery is not configured yet. The site owner needs to set the CONTACT_ENDPOINT environment variable in Cloudflare Pages before messages can be delivered.',
      },
      503
    );
  }

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name, email, subject, message, source: 'QuranNoor.com' }),
    });

    if (!upstream.ok) {
      return jsonResponse(
        { error: `Message delivery failed (upstream status ${upstream.status}). Please try again later.` },
        502
      );
    }
  } catch {
    return jsonResponse(
      { error: 'Unable to reach the message delivery service. Please try again later.' },
      502
    );
  }

  return jsonResponse({ ok: true }, 200);
};
