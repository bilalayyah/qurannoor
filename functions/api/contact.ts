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

interface Env {
  CONTACT_ENDPOINT?: string;
}

interface ContactPayload {
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
  website?: unknown;
  source?: unknown;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;

  let payload: ContactPayload;
  try {
    payload = (await request.json()) as ContactPayload;
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Please enter a valid email address.' }, 400);
  }
  if (message.length < 15) {
    return jsonResponse({ error: 'Please enter a clear message (at least 15 characters).' }, 400);
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
