# Team Task Manager

Full-stack app for **projects**, **team roles** (Admin / Member), **tasks** (create, assign, status), and a **dashboard** (counts, overdue, upcoming).  
Stack: **React (Vite) + TypeScript**, **Express REST API**, **PostgreSQL** via **Prisma**, **JWT** auth, **Zod** validation, **RBAC** on project routes.

## Prerequisites

- **Node.js** 20+ (or 22+)
- **PostgreSQL** installed and running on your machine (not Docker). [Windows installer](https://www.postgresql.org/download/windows/) / [macOS](https://www.postgresql.org/download/macosx/) / your Linux package manager.

## Quick start (local PostgreSQL)

1. **Create a database** (using `psql`, pgAdmin, or any SQL client connected as a superuser):

   ```sql
   CREATE DATABASE teamtasks;
   ```

2. **Configure the API** — copy `server/.env.example` to `server/.env` and set `DATABASE_URL` to match your local Postgres user, password, host (usually `localhost`), port (usually `5432`), and database name (`teamtasks`). Example:

   ```env
   DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/teamtasks?schema=public"
   ```

3. **API** — from `server/`:

   ```bash
   cd server
   npm install
   npx prisma migrate deploy
   npm run dev
   ```

4. **Web** — from `client/` in another terminal:

   ```bash
   cd client
   npm install
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api` to `http://localhost:4000`.

Register a user, create a project (you become **Admin**), add tasks, and invite others by **email** (they must register first).

## API overview

| Area | Method | Path | Notes |
|------|--------|------|--------|
| Auth | POST | `/api/auth/register` | Body: `email`, `password`, `name` |
| Auth | POST | `/api/auth/login` | Returns JWT |
| Auth | GET | `/api/auth/me` | Bearer token |
| Projects | GET/POST | `/api/projects` | List / create (creator = admin member) |
| Project | GET/PATCH/DELETE | `/api/projects/:projectId` | PATCH/DELETE: **Admin** |
| Members | GET | `/api/projects/:projectId/members` | Any member |
| Members | POST | `/api/projects/:projectId/members` | **Admin** — `{ email, role }` |
| Members | PATCH/DELETE | `/api/projects/:projectId/members/:userId` | **Admin** |
| Tasks | GET/POST | `/api/projects/:projectId/tasks` | Members |
| Tasks | PATCH/DELETE | `/api/projects/:projectId/tasks/:taskId` | Members edit assigned/created; assignee change **Admin** only |
| Dashboard | GET | `/api/dashboard` | Tasks assigned to or created by you |

Health: `GET /health`

## Role rules (summary)

- **Admin**: manage project, members, roles; full task control (including assignee).
- **Member**: view project; create tasks; edit tasks **assigned to them** or **they created**; cannot change assignee; delete only if **creator** (or use admin).

## Production-style deploy (no Docker in this repo)

1. Use a **PostgreSQL** instance you manage or rent (same `DATABASE_URL` idea as local).
2. Run the API on a host (Node, PM2, etc.) with `DATABASE_URL`, `JWT_SECRET`, and `CLIENT_ORIGIN` set.
3. On first deploy (and after schema changes): `npx prisma migrate deploy` in `server/`.
4. Build the client: `cd client && npm run build` and serve the `client/dist` folder with any static file server. If the API is on another origin, build with  
   `VITE_API_URL=https://your-api.example.com`  
   so the browser calls the correct host.

## Project layout

```
server/   Express + Prisma + PostgreSQL
client/   React + Vite + Tailwind CSS v4
```

## License

MIT (adjust as needed for your course/organization).
