const REQUIRED_FIELDS = ['full_name', 'email', 'company'];

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getClientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
}

async function hmacHex(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function parseRequest(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await request.json();
  }
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

function normalizeSubmission(data, request) {
  const now = new Date().toISOString();
  const landingPage = clean(data.landing_page) || request.headers.get('referer') || '';
  const payload = {
    source_type: 'website_form',
    source_ref: clean(data.source_ref),
    form_id: clean(data.form_id) || 'unknown-website-form',
    campaign_id: clean(data.campaign_id) || 'briefing-ai-readiness-v1',
    full_name: clean(data.full_name || data.name),
    email: clean(data.email).toLowerCase(),
    company: clean(data.company),
    title: clean(data.title || data.role),
    message: clean(data.message || data.notes || data.summary),
    landing_page: landingPage,
    referrer: clean(data.referrer),
    utm_source: clean(data.utm_source),
    utm_medium: clean(data.utm_medium),
    utm_campaign: clean(data.utm_campaign),
    utm_content: clean(data.utm_content),
    consent: clean(data.consent) || 'yes',
    received_at: now,
    user_agent_family: request.headers.get('user-agent') ? 'present' : '',
    visitor_country: request.cf && request.cf.country ? request.cf.country : '',
  };

  if (!payload.message) {
    payload.message = `Requested ${payload.form_id} from ${payload.landing_page}`;
  }

  // Leave source_ref blank unless the caller provides a stable ID. The ai-box
  // importer derives a duplicate-safe source_ref from email/name/company/message/date.
  return payload;
}

function validate(payload, rawData) {
  if (clean(rawData.website)) {
    return 'bot-honeypot';
  }
  for (const field of REQUIRED_FIELDS) {
    if (!payload[field]) {
      return `Missing required field: ${field}`;
    }
  }
  if (!payload.email.includes('@')) {
    return 'Please provide a valid work email address.';
  }
  if (payload.consent !== 'yes' && payload.consent !== 'on' && payload.consent !== 'true') {
    return 'Consent is required to submit this form.';
  }
  return '';
}

function checklistUrl(request) {
  return new URL('/ai-proof-gap-checklist-download.html', request.url).toString();
}

async function sendChecklistEmail(payload, request, env) {
  if (!env.RESEND_API_KEY || payload.form_id !== 'ai-proof-gap-checklist') {
    return false;
  }

  const url = checklistUrl(request);
  const from = env.ANCHOR_TRANSACTIONAL_FROM || 'Anchor Enterprise <clark@anchor-enterprise.com>';
  const subject = 'Your AI Proof Gap Checklist';
  const text = `Hi ${payload.full_name || 'there'},\n\nHere is the AI Proof Gap Checklist:\n${url}\n\nUse it to pressure-test one AI use case against ownership, risk, workforce readiness, and business value proof.\n\nIf you want a senior-peer read on your answers, book a 20-minute call: https://calendar.app.google/hUtfPcRYZ8Zdm6JH6\n\n— Anchor Enterprise`;
  const html = `
    <p>Hi ${payload.full_name || 'there'},</p>
    <p>Here is the AI Proof Gap Checklist:</p>
    <p><a href="${url}">Open the AI Proof Gap Checklist</a></p>
    <p>Use it to pressure-test one AI use case against ownership, risk, workforce readiness, and business value proof.</p>
    <p>If you want a senior-peer read on your answers, <a href="https://calendar.app.google/hUtfPcRYZ8Zdm6JH6">book a 20-minute call</a>.</p>
    <p>— Anchor Enterprise</p>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: payload.email,
      subject,
      text,
      html,
      reply_to: 'clark@anchor-enterprise.com',
    }),
  });

  return response.ok;
}

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await parseRequest(request);
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Could not parse form submission.' }, 400);
  }

  const payload = normalizeSubmission(data, request);
  const validationError = validate(payload, data);
  if (validationError === 'bot-honeypot') {
    return jsonResponse({ ok: true, queued: true });
  }
  if (validationError) {
    return jsonResponse({ ok: false, error: validationError }, 400);
  }

  if (!env.ANCHOR_LEAD_WEBHOOK_URL) {
    return jsonResponse({ ok: false, error: 'Lead intake is not configured yet.' }, 503);
  }

  const body = JSON.stringify(payload);
  const headers = { 'content-type': 'application/json' };
  if (env.ANCHOR_LEAD_WEBHOOK_SECRET) {
    const signature = await hmacHex(env.ANCHOR_LEAD_WEBHOOK_SECRET, body);
    headers['x-anchor-signature-sha256'] = signature;
    headers['x-webhook-signature'] = signature;
    headers['x-hub-signature-256'] = `sha256=${signature}`;
  }

  const upstream = await fetch(env.ANCHOR_LEAD_WEBHOOK_URL, {
    method: 'POST',
    headers,
    body,
  });

  if (!upstream.ok) {
    return jsonResponse({ ok: false, error: 'Lead intake is temporarily unavailable.' }, 502);
  }

  const response = { ok: true, queued: true };
  if (payload.form_id === 'ai-proof-gap-checklist') {
    response.download_url = '/ai-proof-gap-checklist-download.html';
    response.email_sent = await sendChecklistEmail(payload, request, env);
  }
  return jsonResponse(response);
}

export async function onRequestGet() {
  return jsonResponse({ ok: false, error: 'Use POST.' }, 405);
}
