# iGUIDE — Interactive Geospatial Unified Information Directory and Explorer

**Date:** 16 November 2026  
**Contact:** [Name, Position, Division] · [official email] · [local / mobile number] *(to be filled in before sharing)*  
**System name:** **iGUIDE** (*Interactive Geospatial Unified Information Directory and Explorer*)

## Executive Summary

**iGUIDE** (*Interactive Geospatial Unified Information Directory and Explorer*) is a digital 3D campus map and spatial directory for the Department of Agriculture research stations in Region IV-A (CALABARZON). It combines a public web map, an on-site touchscreen kiosk, and smartphone navigation in one system. It launches with the **DA-LARES** campus in Lipa City, Batangas, with **DA-RARES**, **DA-QARES**, and **DA-CARES** integrated in the multi-station platform.

**Status:**
- **Works today:** DA-LARES web map, lobby kiosk, QR handoff to phones, live phone navigation, and the staff update portal.
- **In progress:** DA-QARES and DA-RARES (drone maps and building outlines loaded; 3D buildings, photos, and directories pending).
- **Planned:** DA-CARES survey and mapping, a permanent web address, and a Tagalog language option.

### What It Does
Research stations contain dozens of buildings, laboratories, screenhouses, and field plots. First-time visitors often cannot find a specific division or service window, and field staff need an accurate reference of active plots.

The system provides:
1. **3D Wayfinding:** Search by building or office name to see the 3D building, a plain-language description, and the walking route.
2. **Phone Handoff:** Scanning an on-screen QR code opens the directions on a smartphone browser, with no app download.
3. **Plot Reference:** Staff can look up what is planted in each plot, tree counts, and cropping cycles.
4. **Staff Updates & Reviewer Approvals:** MIS Admin updates directories, photos, and plot records via `/admin` (localhost-only), while Station Researchers log into `/review` with 2-step Gmail OTP to **Approve, Reject, and Comment** on station changes with automatic email notifications.

**Privacy:** The map server does not receive or store a visitor's GPS location; location is used on the phone only to draw the position and directions.

### Key Numbers (DA-LARES)
- **4** research stations in the regional platform
- **39** numbered facilities and **47** internal offices
- **49** custom 3D building models
- **45** field plots in **23** commodity zones
- **2.68 km** of mapped walkways reaching **43** building entrances
- **63** real campus photographs to help visitors recognize each building

*(Full technical metrics: `docs/technical-fact-sheet.md` and `docs/numbers.md`.)*
