# Offline-First Order Management System

This repository is deliberately split into two deployable applications:

| Folder | Purpose | Deploy to |
| --- | --- | --- |
| [`frontend/`](frontend) | React + Vite offline-first PWA | Vercel |
| [`backend/`](backend) | Fastify API, device pairing, and sync | Render |

## Quick commands

From the repository root:

```powershell
npm run dev          # frontend
npm run server       # backend
npm run build        # frontend production build
npm run server:build # backend production build
```

Each application has its own `package.json`, deployment configuration, and environment example.

## Deployment

1. Create PostgreSQL on Render, then execute [`backend/sql/schema.sql`](backend/sql/schema.sql).
2. Deploy `backend/` to Render. Add its server-only environment variables from [`backend/.env.example`](backend/.env.example).
3. Deploy `frontend/` to Vercel with `VITE_API_URL` set to the Render backend URL.
4. Set the backend `WEB_ORIGIN` to the final Vercel URL.

Never commit database URLs, provider keys, `.env` files, dependencies, builds, or local ML artifacts.
