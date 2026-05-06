# Anchor Enterprise

Executive AI coaching and consulting website for Clark Schnase. Static site designed for deployment on Cloudflare Pages at **anchor-enterprise.com**.

## What Is This

Anchor Enterprise helps seasoned executives and managers harness AI to become dramatically more productive. One-on-one coaching, not courses. A practitioner, not a theorist.

## Stack

Pure HTML, CSS, and JavaScript. No build step, no framework, no dependencies.

- **index.html** — Homepage with hero, value proposition, about, services, and contact
- **privacy.html** — Privacy Policy (TCPA/A2P compliant with SMS disclosures)
- **terms.html** — Terms of Service with SMS messaging terms
- **styles.css** — All styles (responsive, dark theme, gold accents)
- **main.js** — Scroll reveal animations, nav behavior, mobile menu

## Design

- Dark navy/charcoal palette with warm gold accent
- DM Serif Display for headings, Inter for body text
- Responsive design (desktop, tablet, mobile)
- Scroll-triggered fade-in animations
- No images, no stock photos — typography and spacing create the impact

## Deploy to Cloudflare Pages

### Option A: Git Integration (Recommended)

1. Push this repo to GitHub (public or private)
2. Go to [Cloudflare Dashboard → Pages](https://dash.cloudflare.com/?to=/:account/pages)
3. Click **Create a project** → **Connect to Git**
4. Select the repository
5. Configure:
   - **Build command:** (leave empty — no build step)
   - **Build output directory:** `/` (root of the repo)
6. Click **Save and Deploy**
7. Once deployed, go to **Custom domains** → Add `anchor-enterprise.com`
8. Update your domain's DNS:
   - Add a CNAME record pointing `anchor-enterprise.com` to your Pages project URL
   - Or transfer DNS to Cloudflare for automatic configuration

### Option B: Direct Upload

1. Go to [Cloudflare Dashboard → Pages](https://dash.cloudflare.com/?to=/:account/pages)
2. Click **Create a project** → **Direct Upload**
3. Name the project `anchor-enterprise`
4. Drag and drop all files from this directory
5. Click **Deploy**
6. Add custom domain as described above

### Option C: Wrangler CLI

```bash
npm install -g wrangler
wrangler login
wrangler pages project create anchor-enterprise
wrangler pages deploy . --project-name anchor-enterprise
```

Then add custom domain in the Cloudflare dashboard.

## DNS Configuration

If your domain is already on Cloudflare:
- The custom domain setup will auto-configure DNS

If your domain is elsewhere:
- Add a CNAME record: `anchor-enterprise.com` → `anchor-enterprise.pages.dev`
- Or transfer nameservers to Cloudflare

## Contact

- Phone: (425) 331-9022
- Email: clark@anchor-enterprise.com
