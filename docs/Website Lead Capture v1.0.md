# Website Lead Capture v1.0

**Owner:** Neptune
**Website repo:** `/mnt/anchor-enterprise/anchor-enterprise`
**Revenue system:** `/home/neptune/anchor-data/leads/anchor-leads.sqlite`

## Goal

Turn the Anchor website from a brochure plus booking link into a measurable revenue channel:

```text
LinkedIn / referral / search traffic
→ article or offer page
→ explicit CTA
→ consent-based lead capture
→ Neptune lead-import queue
→ qualified lead research
→ Clark only handles worthwhile conversations
```

## What this version implements

1. **Analytics readiness**
   - Adds Google Analytics 4 tag `G-DP552GE7VP` for `anchor-enterprise.com`.
   - Adds first-party event hooks through `main.js`.
   - Forwards revenue events to GA4 as custom events while preserving local `anchor:analytics` browser events.
   - Tracks CTA clicks without identifying anonymous visitors.

2. **Lower-friction lead capture**
   - Adds an `AI Proof Gap Checklist` request page.
   - Adds a checklist CTA to Article 03.
   - Keeps the booking CTA for high-intent visitors.

3. **Serverless intake path**
   - Adds a Cloudflare Pages Function at `/api/lead`.
   - Validates form submissions.
   - Blocks bot honeypot submissions.
   - Forwards the normalized lead payload to an ai-box/Hermes webhook when `ANCHOR_LEAD_WEBHOOK_URL` is configured.
   - Optionally signs the forwarded payload with `ANCHOR_LEAD_WEBHOOK_SECRET`.

4. **Lead-ops mapping**
   - Payload fields are shaped for `Ops/scripts/import_website_form.py`.
   - Campaign attribution defaults to `article-03-ai-proof-gap` for the checklist page.
   - Source type downstream should be `website_form`.

## Event naming

```text
book_call_click
email_click
phone_click
service_click
lead_magnet_click
lead_form_submit
lead_form_success
lead_form_error
```

Every event should include the page path and, where available, campaign/form/CTA metadata.

## Form payload shape

```json
{
  "source_type": "website_form",
  "form_id": "ai-proof-gap-checklist",
  "campaign_id": "article-03-ai-proof-gap",
  "full_name": "...",
  "email": "...",
  "company": "...",
  "title": "...",
  "message": "...",
  "landing_page": "https://anchor-enterprise.com/ai-proof-gap-checklist.html?...",
  "referrer": "...",
  "utm_source": "...",
  "utm_medium": "...",
  "utm_campaign": "...",
  "utm_content": "...",
  "consent": "yes",
  "received_at": "..."
}
```

## Deployment requirements

Before considering the form live, configure these Cloudflare Pages environment variables:

```text
ANCHOR_LEAD_WEBHOOK_URL      required for live intake
ANCHOR_LEAD_WEBHOOK_SECRET   optional; used for HMAC signature header
```

The webhook receiver on ai-box should pipe the JSON body into:

```bash
python3 /mnt/anchor-enterprise/Ops/scripts/import_website_form.py --format json
```

If `ANCHOR_LEAD_WEBHOOK_URL` is not configured, `/api/lead` returns `503` so we do not silently lose leads.

## Continue / kill rule

Continue expanding this path if, within 30 days of launch, it produces any of:

- 3+ checklist/form submissions,
- 1+ qualified lead,
- meaningful CTA clicks from LinkedIn-sourced traffic,
- evidence that Article 03 visitors are interested in board/proof-gap help.

Change the offer if traffic arrives but the checklist CTA gets clicks without submissions. Change distribution if the page gets no qualified traffic.
