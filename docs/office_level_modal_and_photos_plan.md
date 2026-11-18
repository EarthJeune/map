# DA-LARES Office-Level Modal & Indoor Photo Trails — Implementation Plan

> **Status:** Drafted / Ready for execution  
> **Scope:** Directory Menu (Picture 1), Building Offices Dropdown (Picture 2), Two-Level Modal (Building ⇄ Office), Indoor Guidance (Picture 3), and Arrival Card Integration.  
> **Safety Constraint:** Does NOT modify road coordinates, graph pathfinding, or outdoor GPS navigation logic.

---

## 1. Architecture Overview: Two Levels in One Modal

```
[ Left Menu / Search / Map Marker / URL ]
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│  SINGLE UNIFIED MODAL CONTAINER (#building-panel)     │
│                                                        │
│  LEVEL 1: BUILDING VIEW                                │
│  ├── Building Photo & Badges (Coords, Type, Section)  │
│  ├── "Offices & Units (N)" Dropdown List (Picture 2)   │
│  └── "Get Directions to Building" Sticky Button        │
│                         │                              │
│         [ Tap Office ]  │  [ Back Arrow "<" ]          │
│                         ▼                              │
│  LEVEL 2: OFFICE VIEW                                  │
│  ├── Header: [< Building Name]               [✕ Close] │
│  ├── (Optional) "You searched for [PMED]" Banner       │
│  ├── Hero Photo Carousel (Door ➔ Hallway ➔ Building)   │
│  ├── Office Title & Chips ([🏢 Floor] [🚪 Room])       │
│  ├── Indoor Direction Hint ("→ Up the stairs...")      │
│  ├── Metadata (Hours, Head, Services - when available) │
│  ├── "Inside the Building" Step-by-Step Photo Trail   │
│  ├── Collapsible "Other offices on this floor"         │
│  └── "Get Directions to [Office]" Sticky Button        │
└────────────────────────────────────────────────────────┘
```

---

## 2. Component Specifications

### 2.1. Left Menu / Directory Cards (Picture 1)
- **Visuals:** Dark pill cards with high-contrast colored number square (`12` Green, `3` Orange, `9` Cyan).
- **Subtext Logic:**
  - If building has registered offices: Display `N offices inside` (e.g., `7 offices inside`).
  - If building has NO sub-offices: Display `DA-LARES Facility` or `Residential Facility` (avoiding awkward *"0 offices inside"*).
- **Affordance:** Tapping the card opens the Building Modal (Level 1) and centers the building on the 3D map.

### 2.2. Building Offices List & Dropdown (Picture 2)
- **Header:** `Offices & Units (N) ▼`
  - Buildings with **<= 3 offices** (e.g. MIS / RAFIS): Automatically expanded by default (0 extra taps needed).
  - Buildings with **4+ offices** (e.g. Tanco Hall, Admin): Collapsible accordion with clean toggle.
- **Card Structure:**
  - **Left Acronym Badge:** High-contrast emerald badge (`PMED`, `AMIA`, `CSO`, `RAFIS`, `MIS`).
  - **Main Column:** Full division name in clean white typography.
  - **Subtitle:** `[Floor] · Room [Room Number]` (e.g., `2nd floor · Room 204`).
- **Interaction:** Tapping any office smoothly slides the modal into **Level 2 (Office View)**.

### 2.3. Office Level Content (Merging Picture 3)
1. **Breadcrumb Header:** 
   - `← Tanco Hall Building` on the left.
   - `✕` close on the right. Tapping `←` returns to Level 1 without closing the modal.
2. **Context Banner (Search only):**
   - Shows `<div class="search-context-badge">YOU SEARCHED FOR <strong>PMED</strong></div>` only if opened directly from search results.
3. **Hero Photo Carousel:**
   - **Ordering:** Door / Room Signage photo first (highest confirmation value) ➔ Hallway / Stairs ➔ Exterior facade.
   - Dot indicator at bottom of image. Tapping image triggers the full-resolution lightbox.
   - Fallback: If office has no dedicated photos, display the building exterior photo and suppress dots.
4. **Office Title & Location Chips:**
   - Acronym + Full Name.
   - Pill chips: `<span class="chip-floor">🏢 2nd floor</span>` and `<span class="chip-room">🚪 Room 204</span>`.
5. **Indoor Path Hint:**
   - Quick navigational text: `→ Up the stairs, then turn right down the second corridor.`
6. **"Inside the Building" Visual Photo Trail:**
   - Numbered thumbnail steps for multi-floor navigation:
     1. `[Thumb]` *Enter through the main front glass doors.*
     2. `[Thumb]` *Take the stairs to the 2nd floor.*
     3. `[Thumb]` *Room 204 is the second door on your right.*
7. **Floor Neighborhood:**
   - Collapsible row: `Other offices on 2nd floor (2) ▾` linking to neighboring rooms in the same building.
8. **Primary Action:**
   - Sticky bottom button: `🧭 Get Directions to PMED` (initiates outdoor pathfinding to building entrance, with office details pre-loaded for arrival).

### 2.4. Arrival Card Integration (Point 6)
When the visitor reaches the building entrance (Kiosk stop-motion avatar or mobile live GPS):
- The arrival banner / card displays:
  - Office door confirmation photo thumbnail.
  - Title: `Arrived at PMED (Tanco Hall Building)`.
  - Subtitle: `2nd floor · Room 204`.
  - Indoor hint: `Up the stairs, then turn right.`

---

## 3. Data Schema & Backwards Compatibility

Location: [js/data/offices.js](js/data/offices.js)

```javascript
export const BUILDING_OFFICES = {
    "tanco_hall": {
        floors: [
            {
                floorNumber: 2,
                floorName: "2nd Floor",
                offices: [
                    {
                        id: "pmed",
                        acronym: "PMED",
                        name: "Planning, Monitoring and Evaluation Division",
                        aliases: ["Planning", "Monitoring", "Evaluation"],
                        floor: "2nd floor",
                        room: "Room 204",
                        indoorHint: "Up the stairs, then turn right.",
                        hours: "8:00 AM – 5:00 PM (Mon–Fri)",
                        head: "Division Chief",
                        photos: [
                            { src: "images/offices/tanco_pmed_door.webp", thumb: "images/offices/thumbs/tanco_pmed_door.webp", label: "door", caption: "PMED Entrance Door - Room 204" },
                            { src: "images/offices/tanco_hallway_2f.webp", thumb: "images/offices/thumbs/tanco_hallway_2f.webp", label: "hallway", caption: "2nd Floor Hallway" }
                        ],
                        steps: [
                            { step: 1, text: "Enter through the front lobby.", thumb: "images/offices/thumbs/tanco_lobby.webp" },
                            { step: 2, text: "Take the main stairs to the 2nd floor.", thumb: "images/offices/thumbs/tanco_stairs.webp" },
                            { step: 3, text: "Turn right; Room 204 is on the right side.", thumb: "images/offices/thumbs/tanco_pmed_door.webp" }
                        ]
                    },
                    // ... other offices
                ]
            }
        ]
    }
};
```

*Backwards Compatibility Guarantee:* The helper `getFlatBuildingOffices(buildingId)` will continue returning an array of string names for any building that has not yet been migrated to the new schema.

---

## 4. Responsive Layout & Ergonomics Specifications

| Surface | Width / Mode | Modal Layout Rule |
| :--- | :--- | :--- |
| **Desktop Kiosk / Browser** | >= 1024px | Slide-over drawer on right (~440px wide). Single-column office layout. |
| **Portrait Touch Kiosk** | Portrait 9:16 | Bottom panel expands to 60% height. Minimum text size 22px, minimum touch targets **64px**. |
| **Mobile Phone** | Smartphone viewport | Bottom sheet with `peek`, `half`, `full` snaps. Single-column card flow. |
| **Wide Screen (> 700px drawer)** | Modal >= 700px | Two-column grid: Photo carousel left, office metadata & indoor steps right. |

---

## 5. Performance & Asset Budget

1. **Image Dimensions:**
   - List & Indoor Step Thumbnails: Max 300px width (`.webp`, target size ~15KB–25KB).
   - Hero Carousel & Lightbox: Max 1200px width (`.webp`, target size ~80KB–120KB).
2. **Layout Stability (CLS):**
   - All image tags specify explicit `aspect-ratio: 16/9;` or `aspect-ratio: 4/3;` with background skeleton placeholders to eliminate content layout shifting while loading.
3. **Lazy Loading:**
   - Only the first carousel hero image loads eagerly; all subsequent indoor step thumbnails load with `loading="lazy"`.

---

## 6. Implementation Phasing

- **Phase A (Data & Adapter):** Update [js/data/offices.js](js/data/offices.js) with structured office schema for primary buildings (Tanco Hall, Admin, RAED, MIS/RAFIS) while retaining legacy string fallbacks.
- **Phase B (Left Menu & Dropdown):** Implement Picture 1 styling (`X offices inside` count) in [js/sidebar.js](js/sidebar.js) and Picture 2 acronym-first dropdown layout.
- **Phase C (Office View Level):** Build the Level 2 slide view inside [js/building-panel.js](js/building-panel.js) with carousel, chips, indoor path hints, and deep-link URL handler (`?dest=...&office=...`).
- **Phase D (Arrival Card Integration):** Connect the office door photo and indoor hint to the arrival banners in [js/steps.js](js/steps.js) and [js/walker.js](js/walker.js).
