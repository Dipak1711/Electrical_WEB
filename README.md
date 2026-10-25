# Gurukrupa Electrical & Services - catalogue, pricing & stock

## Run it
```
npm install
npm run seed     # first time only: imports the starting catalogue (never overwrites existing data)
npm run dev     # same as start, but restarts when you edit code
npm start        # http://localhost:3000   (admin: tap the person icon, top right)
npm test         # API tests (uses a temporary database)
```
Open it on your phone using your computer's IP, e.g. `http://192.168.x.x:3000` (same Wi-Fi).

## Admin password
Demo password: `87654321`. The check happens on the server; the admin data is only sent after login.
Before putting the site online, start it with your own password - the server refuses to start in production with the demo one:
```
NODE_ENV=production ADMIN_PASSWORD='your-private-password' npm start
```
Serve it over HTTPS when public (the login cookie is then marked Secure automatically).

## Data
- Database: `data/gurukrupa.db` (SQLite). Product photos: `data/uploads/`. Back both up, or use Admin > More > Backup.
- `seed/data.js` is the starting catalogue transcribed from your price sheet; `IMPORT_REPORT.txt` lists what needs checking.
