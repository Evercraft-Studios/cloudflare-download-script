# Cloudflare Pages — Gated Download Page

A modern, animated download page that:
- Shows a **banner preview** of the downloadable content
- Requires users to pass a **Cloudflare Turnstile** challenge before unlocking the download button
- Serves files directly from **Cloudflare R2** via a Pages Function
- Runs entirely on **Cloudflare Pages + Pages Functions** (no servers)

---

## File structure

```
cf-download-page/
├── index.html                  ← The front-end page
├── functions/
│   └── api/
│       └── download.js         ← Pages Function (POST /api/download)
├── wrangler.toml               ← Local dev config (optional)
└── README.md
```

---

## Step 1 — Replace placeholders in `index.html`

| Placeholder | What to put there |
|---|---|
| `WEB PAGE TITLE` | The browser tab title (in the `<title>` tag) |
| `TITLE` | Display title shown in the header and card (appears ×2) |
| `TURNSTILE_SITE_KEY` | Your Turnstile **Site Key** — copy from Cloudflare Dashboard → Turnstile → your site |
| `BASE64_FAVICON` | Base64-encoded favicon, raw data only (no `data:…` prefix) |
| `BASE64_LOGO` | Base64-encoded logo image, raw data only |
| `BASE64_BANNER` | Base64-encoded banner/preview image, raw data only |

> Convert an image to Base64: `base64 -w 0 yourimage.png`

---

## Step 2 — Cloudflare Dashboard setup

### Turnstile (get both keys)

1. Go to **Cloudflare Dashboard → Turnstile → Add Site**
2. Copy the **Site Key** → paste it into `index.html`, replacing `TURNSTILE_SITE_KEY`
3. Copy the **Secret Key** → you'll add this as a secret in the next step (it never goes in the HTML)

### Pages Environment Variables

In **Pages → Your project → Settings → Environment variables**, add:

| Variable name | Type | Value |
|---|---|---|
| `TURNSTILE_SECRET_KEY` | **Secret** | Your Turnstile **Secret Key** (from Dashboard → Turnstile → your site) |
| `R2_DEFAULT_FILE` | Plain text (optional) | The R2 object key to serve, e.g. `myapp.zip` |

### R2 Binding

In **Pages → Your project → Settings → Functions → R2 bucket bindings**, add:

| Variable name | R2 Bucket |
|---|---|
| `R2_BUCKET` | Select your bucket |

### Upload your file to R2

Upload the file you want to distribute to your R2 bucket. The object key (e.g. `myapp.zip`) is what you set as `R2_DEFAULT_FILE` above.

---

## Step 3 — Deploy

**Option A — Cloudflare Dashboard (drag & drop)**
1. Zip the `cf-download-page` folder
2. Go to **Pages → Create a project → Upload assets**
3. Upload the zip

**Option B — Wrangler CLI**
```bash
npx wrangler pages deploy . --project-name cf-download-page
```

**Local development**
```bash
npx wrangler pages dev . --r2=R2_BUCKET:YOUR_BUCKET_NAME
```

---

## How it works

```
Browser                        Pages Function             Cloudflare
  │                                   │                       │
  │── POST /api/download ────────────▶│                       │
  │   { token: "<turnstile token>" }  │                       │
  │                                   │── siteverify ────────▶│ Turnstile
  │                                   │◀── { success: true } ─│
  │                                   │                       │
  │                                   │── R2_BUCKET.get() ───▶│ R2
  │                                   │◀── file stream ────────│
  │                                   │                       │
  │◀── file stream (attachment) ──────│                       │
```

The file is streamed directly from R2 through the Pages Function to the browser — no presigned URLs, no extra hops.
