# Offline Order Desk

An offline-first order-management PWA with workspace isolation, durable local storage, deterministic operation merging, device pairing, and a Fastify/PostgreSQL sync backend.

## Local development

Frontend:

```powershell
npm install
npm run dev
```

Backend:

```powershell
cd ../backend
npm install
npm run dev
```

Configure `../backend/.env` from `../backend/.env.example`. Run `../backend/sql/schema.sql` against PostgreSQL before starting the backend.

## Validation

```powershell
npm run lint
npm run test
npm run build
cd ../backend; npm run build
```

## Deployment

- Deploy `../backend/` as a Render Web Service with PostgreSQL.
- Deploy this folder as a Vercel static site.
- Configure `VITE_API_URL` in Vercel.
- Configure `DATABASE_URL`, `WEB_ORIGIN`, `NODE_ENV=production`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` in Render.

Never commit environment files, PostgreSQL URLs, email-provider keys, or local model artifacts.
