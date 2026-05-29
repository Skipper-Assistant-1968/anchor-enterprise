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

function agentChecklistUrl(request) {
  return new URL('/ai-agent-management-checklist-download.html', request.url).toString();
}

function checklistPdfUrl(request) {
  return new URL('/assets/ai-proof-gap-checklist.pdf', request.url).toString();
}

function agentChecklistPdfUrl(request) {
  return new URL('/assets/ai-agent-management-checklist.pdf', request.url).toString();
}

function firstName(fullName) {
  const name = clean(fullName);
  return name ? name.split(/\s+/)[0] : 'there';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function checklistAttachment(request) {
  const response = await fetch(checklistPdfUrl(request));
  if (!response.ok) {
    return null;
  }
  const content = arrayBufferToBase64(await response.arrayBuffer());
  return {
    filename: 'AI Pilot-to-Business-Case Checklist - Anchor Enterprise.pdf',
    content,
  };
}

async function sendChecklistEmail(payload, request, env) {
  if (!env.RESEND_API_KEY) {
    return false;
  }

  const formId = payload.form_id;
  const isAgentChecklist = formId === 'ai-agent-management-checklist';
  const isProofGapChecklist = formId === 'ai-proof-gap-checklist';

  if (!isAgentChecklist && !isProofGapChecklist) {
    return false;
  }

  const url = isAgentChecklist ? agentChecklistUrl(request) : checklistUrl(request);
  const pdfUrl = isAgentChecklist ? agentChecklistPdfUrl(request) : checklistPdfUrl(request);
  const greetingName = firstName(payload.full_name);
  const greetingNameHtml = escapeHtml(greetingName);
  const from = env.ANCHOR_TRANSACTIONAL_FROM || 'Clark Schnase <clark@anchor-enterprise.com>';

  let subject, text, html;

  if (isAgentChecklist) {
    subject = 'Your AI Agent Management Checklist';
    text = `Hi ${greetingName},\n\nHere is the AI Agent Management Checklist:\n${url}\n\nI attached a clean PDF version as well. Use it on one agent this week, not your whole fleet.\n\nThe checklist matters most when it forces a conversation: who owns this agent, what happens when it misbehaves, and whether the agent is still serving the purpose it was built for.\n\nIf your answers expose a gap between how your agents are running and how they should be governed, that is the right time to fix the management framework before the gap becomes an incident.\n\nIf you want a second read, book 45 minutes here:\nhttps://calendar.app.google/hUtfPcRYZ8Zdm6JH6\n\nClark Schnase\nAnchor Enterprise · Executive AI Coaching\nclark@anchor-enterprise.com · anchor-enterprise.com`;
    html = `
    <div style="margin:0;padding:0;background:#f5efe1;color:#1a2540;font-family:Inter,Arial,sans-serif;line-height:1.55;">
      <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
        <p>Hi ${greetingNameHtml},</p>
        <p>Here is the AI Agent Management Checklist:</p>
        <p><a href="${url}" style="color:#9a8538;font-weight:600;">Open the checklist</a></p>
        <p>I attached a clean PDF version as well. Use it on one agent this week, not your whole fleet.</p>
        <p>The checklist matters most when it forces a conversation: who owns this agent, what happens when it misbehaves, and whether the agent is still serving the purpose it was built for.</p>
        <p>If your answers expose a gap between how your agents are running and how they should be governed, that is the right time to fix the management framework before the gap becomes an incident.</p>
        <p>If you want a second read, <a href="https://calendar.app.google/hUtfPcRYZ8Zdm6JH6" style="color:#9a8538;font-weight:600;">book 45 minutes here</a>.</p>
        <p style="margin-top:28px;">Clark Schnase<br>Anchor Enterprise · Executive AI Coaching<br><a href="mailto:clark@anchor-enterprise.com" style="color:#9a8538;">clark@anchor-enterprise.com</a> · <a href="https://anchor-enterprise.com" style="color:#9a8538;">anchor-enterprise.com</a></p>
        <p style="margin-top:24px;color:#3d4a66;font-size:13px;">PDF link, if the attachment does not come through: <a href="${pdfUrl}" style="color:#9a8538;">AI Agent Management Checklist PDF</a></p>
      </div>
    </div>
  `;
  } else {
    subject = 'Your AI Pilot-to-Business-Case Checklist';
    text = `Hi ${greetingName},\n\nHere is the AI Pilot-to-Business-Case Checklist:\n${url}\n\nI attached a clean PDF version as well. Use it on one AI initiative, not your whole portfolio.\n\nThe score matters less than the conversation the questions force: who owns the risk, what proof would satisfy the business, and where the plan is still running on assumptions.\n\nIf your answers expose a gap between the pilot and the business case, that is the right time to slow down and fix the operating model before the spend gets larger.\n\nIf you want a second read, book 45 minutes here:\nhttps://calendar.app.google/hUtfPcRYZ8Zdm6JH6\n\nClark Schnase\nAnchor Enterprise · Executive AI Coaching\nclark@anchor-enterprise.com · anchor-enterprise.com`;
    html = `
    <div style="margin:0;padding:0;background:#f5efe1;color:#1a2540;font-family:Inter,Arial,sans-serif;line-height:1.55;">
      <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
        <p>Hi ${greetingNameHtml},</p>
        <p>Here is the AI Pilot-to-Business-Case Checklist:</p>
        <p><a href="${url}" style="color:#9a8538;font-weight:600;">Open the checklist</a></p>
        <p>I attached a clean PDF version as well. Use it on one AI initiative, not your whole portfolio.</p>
        <p>The score matters less than the conversation the questions force: who owns the risk, what proof would satisfy the business, and where the plan is still running on assumptions.</p>
        <p>If your answers expose a gap between the pilot and the business case, that is the right time to slow down and fix the operating model before the spend gets larger.</p>
        <p>If you want a second read, <a href="https://calendar.app.google/hUtfPcRYZ8Zdm6JH6" style="color:#9a8538;font-weight:600;">book 45 minutes here</a>.</p>
        <p style="margin-top:28px;">Clark Schnase<br>Anchor Enterprise · Executive AI Coaching<br><a href="mailto:clark@anchor-enterprise.com" style="color:#9a8538;">clark@anchor-enterprise.com</a> · <a href="https://anchor-enterprise.com" style="color:#9a8538;">anchor-enterprise.com</a></p>
        <p style="margin-top:24px;color:#3d4a66;font-size:13px;">PDF link, if the attachment does not come through: <a href="${pdfUrl}" style="color:#9a8538;">AI Proof Gap Checklist PDF</a></p>
      </div>
    </div>
  `;
  }

  let attachment = null;
  if (isAgentChecklist) {
    const response = await fetch(agentChecklistPdfUrl(request));
    if (response.ok) {
      const content = arrayBufferToBase64(await response.arrayBuffer());
      attachment = {
        filename: 'AI Agent Management Checklist - Anchor Enterprise.pdf',
        content,
      };
    }
  } else {
    attachment = await checklistAttachment(request);
  }
  const email = {
    from,
    to: payload.email,
    subject,
    text,
    html,
    reply_to: 'clark@anchor-enterprise.com',
  };
  if (attachment) {
    email.attachments = [attachment];
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(email),
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
  } else if (payload.form_id === 'ai-agent-management-checklist') {
    response.download_url = '/ai-agent-management-checklist-download.html';
    response.email_sent = await sendChecklistEmail(payload, request, env);
  }
  return jsonResponse(response);
}

export async function onRequestGet() {
  return jsonResponse({ ok: false, error: 'Use POST.' }, 405);
}
