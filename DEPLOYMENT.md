# Deployment checklist (Vercel + Railway)

## Architecture

| Service | Host | Root / notes |
|---------|------|----------------|
| Frontend | Vercel | Root: `client` |
| API | Railway | Root: `server` |
| Database | Railway PostgreSQL | Linked via `DATABASE_URL` |

---

## Vercel (frontend)

**Project settings**

| Setting | Value |
|---------|--------|
| Framework Preset | Vite |
| Root Directory | `client` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

**Environment variables**

| Name | Example |
|------|---------|
| `VITE_API_URL` | `https://YOUR-RAILWAY-APP.up.railway.app` |

No trailing slash. Redeploy after changing env vars.

**SPA routing** — `client/vercel.json` rewrites all paths to `index.html` so `/login` and `/register` work on refresh.

---

## Railway (API)

**Service settings**

| Setting | Value |
|---------|--------|
| Root Directory | `server` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |

`npm start` runs **`prisma migrate deploy`** then starts the API (creates tables on first deploy).

**Required environment variables**

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | From Railway Postgres plugin (or external Postgres URL) |
| `JWT_SECRET` | Long random string (32+ chars) |
| `CLIENT_ORIGIN` | `https://team-task-manager-alpha-one.vercel.app` |
| `NODE_ENV` | `production` |

Multiple frontends: comma-separated `CLIENT_ORIGIN`  
`https://app1.vercel.app,https://app2.vercel.app`

**Health checks**

- API up: `GET https://YOUR-RAILWAY-APP.up.railway.app/health`
- DB connected: response includes `"database": "connected"`

If you see `"database": "disconnected"`:

1. Add/link Postgres on Railway and set `DATABASE_URL`.
2. Redeploy (migrations run on `npm start`).
3. Check Railway deploy logs for `prisma migrate deploy` errors.

**Register 500 — usual causes**

| Symptom | Fix |
|---------|-----|
| Health OK but register 500, logs: table does not exist | Redeploy after this repo’s `start` script fix; or run `npx prisma migrate deploy` in Railway shell |
| Health: database disconnected | Fix `DATABASE_URL`; use Railway’s internal Postgres URL |
| CORS error in browser | Set `CLIENT_ORIGIN` to exact Vercel URL (https, no trailing slash) |
| Works locally, not production | Set `VITE_API_URL` on Vercel to Railway URL, redeploy frontend |

---

## Verify end-to-end

1. Open `https://YOUR-RAILWAY-APP.up.railway.app/health` → `"database": "connected"`.
2. Register on Vercel app.
3. DevTools → Network → `POST .../api/auth/register` → **201**.

---

## Problems you fixed (summary)

1. **Vercel 404** — Vite preset + `vercel.json` SPA rewrite.
2. **Production API** — `VITE_API_URL` on Vercel.
3. **Wrong health URL** — use `/health`, not `/api/health`.
4. **CORS** — `CLIENT_ORIGIN` on Railway.
5. **Dashboard crash** — API now returns `recent: []` when user has no projects.
6. **Register 500** — run migrations on Railway start; `prisma` in dependencies; DB health on `/health`.

---

## Local vs production

| | Local | Production |
|---|--------|------------|
| API URL | Vite proxy → `localhost:4000` | `VITE_API_URL` → Railway |
| Database | Local Postgres `.env` | Railway `DATABASE_URL` |

Do not rely on `localhost:4000` in the Vercel build.
