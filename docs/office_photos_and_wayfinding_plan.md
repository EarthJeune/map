# Implementation Plan: Office Photos & Internal Wayfinding Directory

## Executive Overview
This plan establishes the design, UI/UX architecture, and data structures for extending the DA-LARES interactive map with **individual office photography, internal doorway wayfinding, and floor-level directories** across both **Kiosk** (large touchscreens) and **Mobile** (smartphones).

---

## 1. UI/UX Experience by Platform

### A. Large Screen Kiosk Display (Landscape & Portrait)
* **2-Column Office Card Grid**: Replaces text pills with visual cards featuring a square doorway thumbnail, office title, floor tag, and primary services.
* **Floor Tab Filter**: Quick-filter pills at the top (`[All Floors]`, `[Ground Floor]`, `[2nd Floor]`).
* **Photo Zoom & Lightbox**: Tapping an office card opens a high-resolution preview showing the entrance door, counter, and room signage.
* **Mobile QR Handoff**: Scanning the kiosk QR code with a phone directly deep-links into the specific office view with doorway photos loaded.

### B. Mobile Interface (< 768px Viewports)
* **Bottom Sheet Integration**: Clean cards stacked vertically inside the 3-snap bottom sheet (`#phone-bottom-sheet`).
* **Tap-to-Expand Accordion**:
  * **Collapsed State**: Office name, floor badge, and small doorway thumbnail.
  * **Expanded State**: High-res doorway photo, operating hours, officer-in-charge, and list of services.
* **Fullscreen Photo Viewer**: Seamless pinch-to-zoom and lightbox view for office door signage.
* **Arrival Doorway Hint**: When a visitor finishes walking and arrives at the building, an arrival card displays:
  > *"You have arrived at Admin Building! Proceed to 2nd Floor, Room 202 (Accounting)."*
  > *Accompanied by the doorway photo so they instantly recognize the door.*

---

## 2. Target Data Architecture (`js/data/offices.js`)

The data model will support both simple string lists (backward-compatible fallback) and rich office objects with photos:

```javascript
export const BUILDING_OFFICES = {
    'admin_building': [
        {
            floor: 'Ground Floor',
            offices: [
                {
                    id: 'cashier',
                    name: 'Cashier',
                    floor: 'Ground Floor',
                    room: 'Window 1 - 2',
                    photos: ['images/offices/admin_cashier_door.jpg'],
                    services: 'Fee payments, Official Receipts, Check disbursements',
                    head: 'Cashier Unit Head'
                },
                {
                    id: 'budget_1',
                    name: 'Budget 1',
                    floor: 'Ground Floor',
                    room: 'Room 104',
                    photos: ['images/offices/admin_budget1_door.jpg'],
                    services: 'Allotment obligations and financial appropriations'
                }
            ]
        },
        {
            floor: '2nd Floor',
            offices: [
                {
                    id: 'accounting',
                    name: 'Accounting',
                    floor: '2nd Floor',
                    room: 'Room 201',
                    photos: ['images/offices/admin_accounting_door.jpg'],
                    services: 'Financial clearance, disbursements, audit documentation'
                },
                {
                    id: 'office_of_the_admin',
                    name: 'Office of the Admin',
                    floor: '2nd Floor',
                    room: 'Room 205',
                    photos: ['images/offices/admin_exec_door.jpg'],
                    services: 'Administrative directives and regional management'
                }
            ]
        }
    ],
    'tanco_hall_building': [
        {
            id: 'pmed_chief',
            name: 'PMED Office of the Chief',
            floor: 'Main Floor',
            photos: ['images/offices/tanco_pmed_chief.jpg'],
            services: 'Planning, monitoring, and evaluation executive office'
        }
        // Additional Tanco Hall offices...
    ]
};
```

---

## 3. Directory & Search Synergy

* **Global Instant Search**:
  * Typing an office name (e.g., *"Accounting"*, *"Cashier"*, *"Rice"*, *"GAD"*) will highlight the parent building in the directory.
  * Tapping the search result will directly focus on that specific office card inside the building view.
* **Deep URL Routing**:
  * Supports URL parameters like `?dest=admin_building&office=accounting` for QR codes or mobile links.

---

## 4. Implementation Steps (When Ready to Resume)

| Phase | Milestone | Deliverable |
| :---: | :--- | :--- |
| **Phase 1** | **Asset Preparation** | Capture high-quality phone camera photos of office doors/signboards and place in `images/offices/<building_id>_<office_id>.jpg`. |
| **Phase 2** | **Data Upgrade** | Enrich `js/data/offices.js` with photo filepaths, room numbers, and service descriptions. |
| **Phase 3** | **UI Card Component** | Update `renderBuildingOfficesHTML` in `js/data/offices.js` to render the rich interactive card layout. |
| **Phase 4** | **Lightbox & Arrival Hints** | Connect office thumbnails to the fullscreen modal lightbox (`#photo-lightbox-modal`) and add the doorway arrival prompt in `js/walker.js`. |
| **Phase 5** | **Verification** | Test on portrait/landscape kiosk screens and mobile smartphones. |
