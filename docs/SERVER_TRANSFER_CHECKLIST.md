# Server PC Transfer & Deployment Checklist

Quick reference for deploying updates from the **Admin/Dev Laptop** to the **24/7 Production Server PC**.

---

## 1. Transfer via Git (`git clone` / `git pull`)
Run `git push` from your laptop, then `git pull` on the Server PC (and `npm install` on first setup or when `package.json` changes):
- `index.html`, `server.js`, `package.json`, `package-lock.json`, `manifest.json`
- `js/`, `css/`, `icons/`, `fonts/`, `vendor/`, `Main Icon/`, `database/`
- `models/` (all `.glb` 3D models)
- `images/` (all `.webp` facility photos)
- Campus data files (`*.json`, `*.geojson`)

---

## 2. Copy Manually (USB / LAN Share — Excluded from Git)
- **Drone MBTiles:**
  - `LARES v1.mbtiles`
  - `QARES v1.mbtiles`
  - `RARES v1.mbtiles`
  *(Stop `node server.js` briefly before overwriting `.mbtiles` on Windows.)*
- **Server `.env` file** (copy from `.env.example` and set):
  ```env
  DB_HOST=localhost
  DB_USER=root
  DB_PASSWORD=<server_mysql_password>
  DB_NAME=kiosk
  PORT=8080
  ENABLE_ADMIN=false
  ```
- **Tunnel binary (if using Cloudflare Tunnel):** `cloudflared.exe`
- **MySQL `kiosk` database dump (`.sql`):** Only needed if you edited buildings/offices/plots in Admin MySQL on your laptop.

---

## 3. Do NOT Transfer to the Server PC
- `Building Images/` and `Building Images RARES/` (raw Blender source photos)
- `renders/`, `archive/`, `scratch/`
- `node_modules/` (run `npm install` on the Server PC instead)

---

## 4. Security Verification on Server PC
1. Confirm `.env` has `ENABLE_ADMIN=false`.
2. Restart `node server.js`.
3. Verify `/admin`, `/admin.html`, `/api/admin/*`, and `*_draw.html` return `403 Forbidden`.
4. Confirm MySQL port `3306` is not port-forwarded or exposed through the firewall.

