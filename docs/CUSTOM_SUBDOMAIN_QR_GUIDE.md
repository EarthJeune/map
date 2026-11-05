# Custom Subdomain & Mobile QR Handoff Deployment Guide

This guide explains how to replace the temporary random Cloudflare Quick Tunnel domain (`*.trycloudflare.com`) shown in mobile **GPS Location & Compass permission popups** with your own clean, permanent project name (e.g., `da-lares-map.pages.dev`, `da-lares-map.vercel.app`, or an official DA domain)—**even without purchasing a domain name**.

---

## 1. Why the Phone Popup Shows `*.trycloudflare.com`

When a visitor scans a QR code on the kiosk and taps **"📍 Guide me live (GPS)"**, iOS Safari and Android Chrome display a native OS security dialog:

> **`"<hostname>" Would Like to Use Your Location`**

- **OS Anti-Phishing Lock:** Mobile browsers strictly pull `<hostname>` from the browser's address bar (`window.location.hostname`). Web applications cannot alter that text via HTML or JavaScript.
- **Temporary Quick Tunnel Behavior:** When [`server.js`](../server.js) starts an unauthenticated Cloudflare Quick Tunnel (`cloudflared tunnel --url http://localhost:8080`), Cloudflare assigns a random 4-word `*.trycloudflare.com` address on every server restart and does not allow custom subdomain names on `trycloudflare.com`.

---

## 2. Option A: Free Permanent Subdomain (No Domain Purchase Needed)

You can get a clean, permanent `https://` address for **100% free** using **Cloudflare Pages** (`*.pages.dev`) or **Vercel** (`*.vercel.app`).

Because all 3D models (`models/*.glb`), facility data (`js/data/buildings.js`), office directories (`js/data/offices.js`), agricultural plots (`js/data/plots.js`), and pathfinding graphs (`roads.json`) are static files—and [`js/app.js`](../js/app.js) already includes built-in fallbacks for `/api/colors` and `/api/pin`—the entire mobile wayfinding app runs out-of-the-box on static CDN hosting.

### Method 1: Deploy to Cloudflare Pages (`da-lares-map.pages.dev`)
1. Open a terminal in the project root (`c:\Users\LGU-SanPedro\Downloads\map`).
2. Log in to your free Cloudflare account via Wrangler CLI:
   ```powershell
   npx wrangler login
   ```
3. Create and deploy the project under your chosen name (for example, `da-lares-map`):
   ```powershell
   npx wrangler pages project create da-lares-map --production-branch main
   npx wrangler pages deploy . --project-name da-lares-map
   ```
4. Cloudflare Pages will publish the app at:
   ```text
   https://da-lares-map.pages.dev
   ```
   When visitors scan the QR code and tap **Guide me live (GPS)**, their phone will now prompt:
   > **`"da-lares-map.pages.dev" Would Like to Use Your Location`**

### Method 2: Deploy to Vercel (`da-lares-map.vercel.app`)
1. Open a terminal in the project root (`c:\Users\LGU-SanPedro\Downloads\map`).
2. Run the Vercel CLI and follow the prompt to name the project `da-lares-map`:
   ```powershell
   npx vercel --prod
   ```
3. Vercel will publish the app at:
   ```text
   https://da-lares-map.vercel.app
   ```

---

## 3. Linking the Kiosk (`localhost:8080`) QR Codes to Your Permanent URL

Once you have your permanent `https://da-lares-map.pages.dev` (or `.vercel.app`) URL, you can set the Kiosk to always generate QR codes pointing to that permanent URL:

### Option 3.1: Set `PUBLIC_QR_ORIGIN` in [`js/qr.js`](../js/qr.js)
In [`getMobileNavigationUrl(buildingId)`](../js/qr.js), set your permanent domain as the top-priority origin:

```javascript
// js/qr.js
const PERMANENT_PUBLIC_ORIGIN = 'https://da-lares-map.pages.dev'; // Replace with your deployed URL

export function getMobileNavigationUrl(buildingId) {
    let baseOrigin = PERMANENT_PUBLIC_ORIGIN || state.PUBLIC_TUNNEL_URL || window.location.origin;
    baseOrigin = baseOrigin.replace(/\/$/, '');

    const path = '/index.html';
    const currentMode = state.currentMapStyleMode || 'google';
    const viewMode = (currentMode === 'mapbox') ? 'mapbox' : 'google';
    const destParam = (buildingId && buildingId !== '1') ? `dest=${encodeURIComponent(buildingId)}&` : '';
    return `${baseOrigin}${path}?${destParam}mode=phone&view=${viewMode}&v=73`;
}
```

### Key Benefits of This Setup:
1. **Clean Branded Permission Prompt:** Phone users see `"da-lares-map.pages.dev"` instead of a random 4-word `trycloudflare.com` string.
2. **Saved Browser Permissions:** Because the domain never changes when the kiosk restarts, iOS Safari and Android Chrome **remember** the visitor's Location permission across sessions.
3. **Permanent Printed QR Codes:** Any QR code printed on physical campus signage remains valid permanently.
4. **Fast Global CDN Loading:** Mobile visitors on 4G/5G load the `.glb` 3D models directly from Cloudflare/Vercel's edge network instead of uploading over the kiosk's local internet connection.

---

## 4. Option B: Using an Official Custom Domain with a Named Cloudflare Tunnel

If you later acquire a custom domain (or an official agency subdomain such as `lares-map.da4a.gov.ph`):

1. Add the domain to your Cloudflare account.
2. Authenticate `cloudflared` on the kiosk PC:
   ```powershell
   cloudflared tunnel login
   ```
3. Create a persistent Named Tunnel:
   ```powershell
   cloudflared tunnel create da-lares-kiosk
   ```
4. Route your custom hostname to the tunnel:
   ```powershell
   cloudflared tunnel route dns da-lares-kiosk lares-map.yourdomain.com
   ```
5. Run the named tunnel pointing to `http://localhost:8080`:
   ```powershell
   cloudflared tunnel run --url http://localhost:8080 da-lares-kiosk
   ```

---

## 5. Summary of the Mobile QR Scan & Permission Flow

1. **QR Scan Opens Phone Mode (`?dest=<building_id>&mode=phone&view=<google|mapbox>`):**
   - [`handleUrlParameters()`](../js/app.js) always displays the **Welcome Modal** first while loading and orbiting the scanned destination building in the background.
   - Each visitor's device has completely independent view and map settings in its own browser session.
2. **Tapping "Proceed to Interactive Map":**
   - [`handleDashWelcomeProceed()`](../js/phone-ui.js) closes the Welcome Modal cleanly with **zero premature permission popups**, revealing the scanned building's details sheet and 3D camera orbit.
3. **Tapping "📍 Guide me live (GPS)":**
   - [`startPhoneLiveGPS()`](../js/gps.js) requests **Compass (`DeviceOrientationEvent`)** synchronously on the button tap first, and once answered, immediately requests **GPS Location (`navigator.geolocation`)** so iOS Safari never drops or overlaps the two native dialogs.
   - If the visitor denies GPS permission, [`showGPSPermissionCard()`](../js/gps.js) displays step-by-step instructions to re-enable Location in Safari/Chrome along with instant fallback buttons (**🔄 Retry GPS**, **📍 Tap Map to Start**, and **🏛️ Use the Kiosk**).

