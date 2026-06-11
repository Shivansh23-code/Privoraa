# Deploying Privoraa (frontend on Vercel + backend on Render)

The frontend is already on Vercel. These steps put the **backend** online and connect
the two so the live site does real AI chat, PDF/RAG upload, and image (vision) — not demo mode.

## 1. Push the repo

```powershell
git add -A
git commit -m "Add vision, SPA routing, deploy config"
git push origin main
```

## 2. Deploy the backend on Render (free, no database needed)

1. Go to https://dashboard.render.com → **New → Blueprint**.
2. Connect this GitHub repo. Render reads [`render.yaml`](render.yaml) and creates the
   `privoraa-backend` web service (Docker, free plan, in-memory H2 — no DB to set up).
3. Click **Apply**. The first build runs the Maven Docker build (~3–5 min).
4. Open the service → **Environment** → set **`OPENROUTER_API_KEY`** to your (rotated) key →
   Save. It redeploys.
5. When live you'll get a URL like `https://privoraa-backend.onrender.com`.
   Verify: open `https://privoraa-backend.onrender.com/actuator/health` → `{"status":"UP"}`.

> Free Render services sleep after ~15 min idle and cold-start in ~1 min. With H2, accounts
> reset on cold start — fine for a demo. For persistent data, add a hosted MySQL (e.g. Railway
> or Aiven) and set `SPRING_PROFILES_ACTIVE` back to the default plus `DB_URL/DB_USER/DB_PASS`.

## 3. Point the Vercel frontend at the backend

1. Vercel → your project → **Settings → Environment Variables** → add:
   - **Name:** `VITE_API_BASE_URL`
   - **Value:** `https://privoraa-backend.onrender.com/api/v1`  *(your Render URL + `/api/v1`)*
   - Environments: Production (and Preview).
2. **Redeploy** the frontend (Deployments → ⋯ → Redeploy, or push a commit). Vite inlines the
   variable at build time, so a redeploy is required.

## 4. Verify

- Open the live site → the header pill should read **Live** (not Demo) once the backend is awake.
- Register/login, send a chat, upload a PDF and ask about it, attach an image and ask what's in it.

## Notes
- CORS for `https://privoraaai.vercel.app` is already configured (`CORS_ORIGINS` in `render.yaml`).
  If your Vercel domain differs, update that env var on Render.
- The OpenRouter key lives only on Render (server-side) — it never reaches the browser.
- On a cold start the first request may show "Demo" for a few seconds until the backend wakes;
  it flips to "Live" automatically.
