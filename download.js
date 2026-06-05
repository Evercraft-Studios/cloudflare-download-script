/**
 * POST /api/download
 *
 * 1. Verifies the Cloudflare Turnstile token.
 * 2. Streams the file directly from R2 back to the browser.
 *
 * Bindings (set in Cloudflare Pages Dashboard → Settings):
 *   - TURNSTILE_SECRET_KEY  (Secret environment variable)
 *   - R2_BUCKET             (R2 bucket binding)
 *
 * Optional environment variable:
 *   - R2_DEFAULT_FILE       e.g. "myapp.zip" — the R2 object key to serve
 *                           Can also be passed as ?file=<key> in the URL.
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const responseHeaders = {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  /* ── Parse request body ── */
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Invalid request body.' }, 400, responseHeaders);
  }

  const { token } = body;
  if (!token) {
    return json({ success: false, message: 'Missing Turnstile token.' }, 400, responseHeaders);
  }

  /* ── Verify Turnstile token with Cloudflare ── */
  const formData = new FormData();
  formData.append('secret',   env.TURNSTILE_SECRET_KEY);
  formData.append('response', token);
  formData.append('remoteip', request.headers.get('CF-Connecting-IP') || '');

  let verification;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });
    verification = await res.json();
  } catch {
    return json({ success: false, message: 'Could not reach Turnstile verification service.' }, 502, responseHeaders);
  }

  if (!verification.success) {
    return json({
      success: false,
      message: 'Turnstile verification failed. Please try again.',
      errors: verification['error-codes'] ?? [],
    }, 403, responseHeaders);
  }

  /* ── Fetch file from R2 ── */
  const url     = new URL(request.url);
  const fileKey = url.searchParams.get('file') || env.R2_DEFAULT_FILE || 'download';

  const object = await env.R2_BUCKET.get(fileKey);
  if (!object) {
    return json({ success: false, message: 'File not found.' }, 404, responseHeaders);
  }

  /* ── Stream file to browser ── */
  const filename = fileKey.split('/').pop(); // use just the last part of the key as filename

  return new Response(object.body, {
    status: 200,
    headers: {
      ...responseHeaders,
      'Content-Type':        object.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      object.size?.toString() || '',
      'Cache-Control':       'no-store',
    },
  });
}

/* ── OPTIONS pre-flight ── */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/* ── Helper ── */
function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
