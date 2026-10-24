# Building Merge Plan — DA-LARES Campus Map

> **Status:** Planning — not yet implemented  
> **Created:** October 1, 2026

---

## Problem

Several entries in `BUILDING_DIRECTORY` are **offices within the same physical building**, not separate structures. This causes:
- Directory clutter (30+ entries when there are fewer actual buildings)
- Overlapping map markers at the same coordinates
- Confusing navigation (3 "buildings" route to the same front door)

---

## Buildings to Merge

| Merged Building | Offices Inside |
|----------------|---------------|
| **FMR Complex** *(name TBD)* | FMR, MIS Data Center, Vacant |
| **MIS-RAFIS Building** *(name TBD)* | MIS, RAFIS Building |
| **PMED-BAC Building** *(name TBD)* | PMED, BAC Building |

> [!IMPORTANT]
> Official names for each merged building need to be confirmed before implementation.

---

## Recommended Approach: Building → Office Drill-down

### Data Structure

Add an `offices` array to each building entry in `BUILDING_DIRECTORY`:

```js
{
  id: 'fmr_complex',
  name: 'FMR Complex',
  coords: [121.xxx, 13.xxx],  // single pin on the building
  color: '#...',
  desc: 'Houses FMR, MIS Data Center, and more',
  images: ['building_exterior.jpg', ...],
  offices: [
    { id: 'fmr', name: 'FMR Office', desc: 'Financial Management...', images: [...] },
    { id: 'mis_datacenter', name: 'MIS Data Center', desc: 'IT infrastructure...', images: [...] },
    { id: 'vacant', name: 'Vacant Office', desc: 'Currently unoccupied', images: [...] }
  ]
}
```

Buildings with no sub-offices simply omit the `offices` array and work exactly as today.

### User Experience Flow

| Step | What Happens |
|------|-------------|
| **Directory** | Shows "FMR Complex" as **1 entry** instead of 3. A subtle badge shows `3 offices` |
| **Tap building** | Building detail card appears with building-level photos at top |
| **Office list** | Below photos, a scrollable list of **office cards** — each with name, description, thumbnail |
| **Tap an office** | Card expands to show that office's full info (photos, staff, services) |
| **Navigation** | "Guide me here" routes to the **building entrance** — same destination for all offices |
| **Map marker** | **1 marker** on the map per physical building |

### Why This Approach

1. **Cleaner directory** — fewer entries, less scrolling
2. **Accurate map** — one pin per structure, no overlap
3. **No info lost** — every office retains its own name, description, photos
4. **Simpler routing** — all offices in a building share the same nav endpoint
5. **Scalable** — works whether a building has 1 office or 5

### Alternative Considered (Not Recommended)

**Tabs across the top** of the building detail card — works for 2-3 offices but breaks at 5+, and tabs feel awkward on small phone screens.

---

## Open Questions

- [ ] What is the official name for each merged building?
- [ ] Are there other buildings beyond these 3 groups that should be merged?
- [ ] Should the building-level entry have its own photos (exterior), separate from office-level photos (interior)?
- [ ] Should search in the directory match office names inside buildings? (e.g., searching "RAFIS" should surface the merged MIS-RAFIS building)

---

## Notes

- Some existing buildings already have only 1 office — those remain unchanged
- Navigation routing coordinates stay at the building level (single entrance point)
- The merge only affects the directory listing and detail view, not the underlying map layers or walkway graph
