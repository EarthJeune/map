# iGUIDE — Building Lifecycle Status Filters Plan (Future Feature)

**Target System:** iGUIDE — Interactive Geospatial Unified Information Directory and Explorer  
**Feature:** Filter campus buildings by lifecycle / construction status (`Existing`, `Proposed`, `Ongoing Construction`)

---

## 1. Purpose
Some facilities across DA-CALABARZON research stations are not yet completed or are planned for future development. Adding a lifecycle status filter lets visitors, researchers, and management clearly distinguish between operational buildings, active construction sites, and proposed infrastructure.

---

## 2. Status Categories

| Status Key | Display Label | Visual & Wayfinding Behavior |
| :--- | :--- | :--- |
| `existing` | **Existing** | Default operational facility; full 3D model, normal routing & office directory active. |
| `ongoing_construction` | **Ongoing Construction** | Amber status badge in directory & building drawer; optional construction safety notice or restricted entrance routing. |
| `proposed` | **Proposed** | Slate/blue planned badge; optional translucent 3D preview or dashed footprint outline; routing disabled or marked *"Planned Site"*. |

---

## 3. Proposed Implementation Scope

### A. Data & MySQL Schema
- Add `lifecycle_status` (`ENUM('existing', 'proposed', 'ongoing_construction') DEFAULT 'existing'`) to the `buildings` table and JSON/JS building records.
- Default all current verified operational buildings to `existing`.

### B. Admin UI ([admin.html](file:///c:/Users/LGU-SanPedro/Downloads/map/admin.html))
- Add a **Building Status** selector (`Existing`, `Proposed`, `Ongoing Construction`) inside the Building Create/Edit modal.
- Display a status pill in the Buildings CRUD table so admins can filter and update construction progress as projects finish.

### C. Public Map & Directory UI
- Add a **Status Filter** option alongside the existing **Type Filter** (`Existing`, `Proposed`, `Ongoing Construction`, or `All`) without adding extra horizontal chip bars to DA-LARES.
- Show the status badge inside the building list row and the facility drawer header so users immediately know whether a building is open, under construction, or proposed.

