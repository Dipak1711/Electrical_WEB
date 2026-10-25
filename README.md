# Gurukrupa Electrical & Services - catalogue, pricing & stock

Data (products, prices, stock, sales) is stored in **Supabase** (Postgres). Product photos go to Supabase Storage.

## Set up (once)
1. Supabase > SQL Editor > paste `supabase/schema.sql` > Run.
2. Copy `.env.example` to `.env` and fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL`.
3. `npm install`
4. Load the data, either
   - `npm run migrate` - copies your existing local data (`data/gurukrupa.db`) to Supabase, or
   - `npm run seed` - imports the starting catalogue into an empty database.
5. `npm run dev` (or `npm start`) -> http://localhost:3000

## Security
- The server connects with the database login; the website never sees any Supabase key.
- Row level security is ON with no policies, so Supabase's public anon key can read nothing (purchase prices stay private).
- Never put the service_role key in website code or share it.
- Admin demo password `87654321`; set `ADMIN_PASSWORD` before going public (the server refuses to start in production with the demo one).

## Other
`npm test` runs the API tests against a temporary local Postgres (needs Postgres installed). Backups: Admin > More > Backup.
