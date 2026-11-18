# iGUIDE — Admin & Station Reviewer Approval Workflow

**System:** iGUIDE — Interactive Geospatial Unified Information Directory and Explorer  
**Purpose:** Architectural design and assessment for adding station-based **Researcher Reviewer** accounts, change-request approvals, comments, and Gmail notifications.

---

## 1. Assessment: Is This a Good Approach?
**Yes — this is a strong, practical governance model for DA-CALABARZON.**
- It separates **technical/spatial editing** (MIS Admin) from **scientific & local validation** (Station Researchers at DA-LARES, DA-QARES, DA-RARES, DA-CARES).
- It directly aligns **iGUIDE** with the Concept Note's `CHANGE_REQUEST` and `Reviewer` workflow while preventing unverified crop, plot, or building info from appearing on public kiosks.

### Key Deployment Trade-off to Note
- Previously, `/admin` was designed to be **localhost-only** (`ENABLE_ADMIN=false` on the Server PC).
- Because Station Reviewers are located at different campuses and need to log in remotely, the **Reviewer/Admin Portal must be accessible over HTTPS** (e.g., via Cloudflare Tunnel).
- Therefore, **strict role-based access control (RBAC)**, **station scoping**, **salted password hashing (`scrypt`/`bcrypt`)**, and **rate-limited login** are essential before enabling remote reviewer logins.

---

## 2. User Roles & Permissions

| Role | Assigned Scope | Allowed Actions | Restricted Actions |
| :--- | :--- | :--- | :--- |
| **MIS Admin** (You) | All Stations (`lares`, `qares`, `rares`, `cares`) | Full CRUD on buildings, plots, offices, photos, pins; create/manage Reviewer accounts; submit changes for review; publish approved changes; view audit logs. | — |
| **Station Reviewer** (Researchers) | Single Station (`station_id` assigned per account) | View pending & past change requests for their assigned station; inspect Before/After details; **Approve**, **Reject**, and **Comment**. | Cannot edit map/DB records directly; cannot manage users; cannot view or approve other stations' requests. |

---

## 3. Database Schema Additions (MySQL `kiosk`)

### A. `admin_users` (Expanded for Multi-User, Station Scoping & Login OTP)
- `id` (PK)
- `email` (VARCHAR, UNIQUE — used for login, OTP delivery & Gmail notifications)
- `full_name` (VARCHAR)
- `password_hash` (VARCHAR — salted `crypto.scrypt` or `bcrypt`)
- `role` (`ENUM('super_admin', 'reviewer')`)
- `station_id` (`VARCHAR(20) NULL` — `'lares'`, `'qares'`, `'rares'`, `'cares'` for reviewers; `NULL` for super_admin)
- `otp_hash` (`CHAR(64) NULL` — SHA-256 hash of 6-digit login OTP)
- `otp_expires_at` (`DATETIME NULL` — 5-minute expiration)
- `otp_attempts` (`TINYINT DEFAULT 0` — max 5 attempts per OTP)
- `is_active` (`TINYINT(1) DEFAULT 1`)
- `created_at` (`TIMESTAMP`)

### B. `change_requests` (Staging & Approval Queue)
- `id` (PK)
- `station_id` (`VARCHAR(20)`)
- `target_table` (`VARCHAR(50)` — e.g., `buildings`, `plots`, `building_offices`)
- `target_id` (`VARCHAR(100)`)
- `action` (`ENUM('CREATE', 'UPDATE', 'DELETE')`)
- `summary` (`VARCHAR(255)`)
- `previous_json` (`LONGTEXT` — snapshot before edit)
- `payload_json` (`LONGTEXT` — proposed new data)
- `status` (`ENUM('pending', 'approved', 'rejected', 'published') DEFAULT 'pending'`)
- `submitted_by` (`INT` FK -> `admin_users.id`)
- `reviewed_by` (`INT NULL` FK -> `admin_users.id`)
- `reviewer_comment` (`TEXT NULL`)
- `created_at` (`TIMESTAMP`)
- `reviewed_at` (`DATETIME NULL`)

---

## 4. End-to-End Approval & Gmail Notification Flow

1. **Admin Stages a Change:**
   - You edit a building, office, or agricultural plot (e.g., in `DA-RARES`) and submit it for review.
   - The change is saved in `change_requests` with `status = 'pending'`. Live public map data remains unchanged until approved.
2. **Automatic Gmail Notification:**
   - Node.js (via `nodemailer` using a dedicated DA-MIS Gmail + **Google App Password** stored in `.env`) automatically emails all active `reviewer` accounts where `station_id = 'rares'`.
   - Email contains: Station name, summary of change, who submitted it, and a link to open the Reviewer Portal.
3. **Two-Step OTP Login & Review:**
   - Researcher enters email + password on the split-screen login page.
   - Server generates a cryptographically random 6-digit OTP (`crypto.randomInt(100000, 999999)`), stores its hash with a **5-minute expiry**, and emails it to the user's Gmail.
   - Researcher enters the 6-digit OTP (with a **Resend OTP** cooldown) to complete sign-in.
   - Once verified, the UI filters to **only their station** and shows their **Pending Reviews** queue (Before vs. After comparison), where they click **Approve** or **Reject** with a **Comment**.
4. **Publish to Live:**
   - Once `approved`, the MIS Admin publishes the change (or optionally auto-publishes upon approval), applying `payload_json` to the live MySQL table and recording the action in `admin_audit_logs`.

---

## 5. Security Checklist Before Enabling Remote Reviewer Login
- **Mandatory 2-Step Email OTP:** Require a 6-digit Gmail OTP (`crypto.randomInt`, 5-minute TTL, max 5 attempts, cleared immediately on use) before issuing any Admin or Reviewer session.
- **HTTPS Only:** Serve only through Cloudflare Tunnel / HTTPS (never plain HTTP over the internet).
- **Localhost-Only Super Admin Option:** Optionally restrict `super_admin` login to `localhost` / office IP while allowing `reviewer` accounts remotely.
- **Salted Password Hashing:** Upgrade from plain SHA-256 to Node.js `crypto.scrypt` (per-user random salt).
- **Server-Side Station Enforcement:** Every `/api/review/*` endpoint must enforce `req.user.station_id === request.station_id` on the backend, never trusting client-side station parameters.
- **Database Isolation:** Keep MySQL (`3306`) bound to `localhost` and blocked in Windows Firewall.
- **`.env` Secrets (Never Committed):** Store `SMTP_USER`, `SMTP_APP_PASSWORD`, and `ADMIN_SECRET` strictly in `.env`.

