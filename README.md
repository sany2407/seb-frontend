# Shared EB Bill — UI MVP (Next.js) + Express backend

Mobile-first UI. All pages read the Express API (`src/lib/api.ts`);
pure split logic in `src/lib/calc.ts` (mirrored in `backend/src/lib/calc.ts`).

## Run frontend
```bash
npm install
cp .env.example .env   # NEXT_PUBLIC_API_URL=http://localhost:4000
npm run dev   # http://localhost:3000
```

## Run backend (Supabase + Cloudinary)
```bash
cd backend
cp .env.example .env   # fill SUPABASE_* + CLOUDINARY_*
npm install
npm run dev            # http://localhost:4000
```
Run `backend/supabase/schema.sql` in the Supabase SQL editor first (tables + seed homes),
then `backend/supabase/auth.sql` (profiles + per-user `owner_id` columns).
Full endpoint list in `backend/README.md`. Upload flow: `POST /api/uploads/sign`
→ browser uploads direct to Cloudinary → `POST /api/attachments` stores the URL.

## Auth (SaaS)
Supabase Auth (email/password). `POST /api/auth/signup` returns a session;
the frontend stores it and sends `Authorization: Bearer <access_token>` on every
API call. All `/api/*` routes (except `/health`, `/docs`, `/api/auth/*`) require it
and are scoped to the signed-in user. Interactive docs at `http://localhost:4000/docs`.

## Pages
- `/` Dashboard (stats, per-home cards, Recharts, recent bills)
- `/homes` Homes & Meters (add/edit/deactivate UI)
- `/bills` list, `/bills/new` 2-min wizard (main + subs → Calculate Split → Save), `/bills/[id]` breakdown + payment + attachments placeholder
- `/readings` filter/search
- `/split` live lab for usage/equal/percentage (validates 100%, rounding fix)
- `/history` status filter, responsive table
- `/settings` property + common-cost rule + reset

## Next step: DB (not yet wired)
Planned Prisma Postgres tables (UUID PKs, created_at/updated_at):
`homes(id,name,occupant,meter_no,type,active,notes)` →
`meters` (or fold into homes for MVP) →
`meter_readings(id,meter_id,month_key,prev,curr,units,notes)` unique(meter,month) →
`eb_bills(id,month_key unique,bill_no,main_prev,main_curr,main_units,amount,bill_date,due_date,status,method)` →
`bill_splits(id,bill_id,home_id,units,percent,amount)` →
`payments(id,bill_id,amount,date,method,ref)` →
`attachments(id,owner_type,owner_id,file_name,file_url,file_type,file_size,attachment_type)`
- `attachment_type`: EB_BILL | METER_PHOTO | PAYMENT_RECEIPT | PAYMENT_SCREENSHOT | OTHER
- Files → object storage (S3/R2), DB stores URL only. Compress client-side before upload.
- Validation lives in `lib/calc.ts` + zod on server actions later.

PWA: `public/manifest.json` present; add `next-pwa` + icons + service worker when going to production.
