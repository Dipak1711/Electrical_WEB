# Gurukrupa Electrical & Services - catalogue, pricing & stock

Data (products, prices, stock, sales) is stored in **Supabase** (Postgres). Product photos go to Supabase Storage.

## Set up (once)
1. Supabase > SQL Editor > paste `supabase/schema.sql` > Run (safe to run again after updates).
2. Copy `.env.example` to `.env` and fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` (Project Settings > API).
3. `npm install`
4. Load the data, either
   - `npm run migrate` - copies your existing local data (`data/gurukrupa.db`) to Supabase, or
   - `npm run seed` - imports the starting catalogue into an empty database.
5. `npm run dev` (or `npm start`) -> http://localhost:3000

## Security
- Only `SUPABASE_URL` and `SUPABASE_ANON_KEY` are used, and only on the server. The website (browser) never receives the key;
  customers get data through our server, which never sends purchase prices.
- Because the anon key can read and write these tables (needed so the server can work with only that key), treat it like a password:
  keep it only in `.env`, never in website code, never share it. If it leaks, rotate it in Supabase.
- Admin demo password `87654321`; set `ADMIN_PASSWORD` before going public (the server refuses to start in production with the demo one).

## Other
`npm test` runs the API tests against a temporary local Postgres + PostgREST (needs both installed: `brew install postgresql postgrest`). Backups: Admin > More > Backup.
