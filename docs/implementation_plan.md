# Implementation Plan: A* Road Network Pathfinding (Phase 3)

We will now upgrade the map from "straight-line" directions to actual walkway routing like Waze/Google Maps, using the road network you just traced.

## Goal
Implement a graph-based A* (A-star) pathfinding algorithm inside `index.html` that uses your newly traced `roads.json` network to calculate the shortest walking path from the Kiosk to any selected building's entrance.

## Proposed Changes

### 1. Load Road Network
- Fetch `roads.json` during map initialization.
- Parse the GeoJSON `LineString` features.

### 2. Build the Routing Graph
- Iterate through all road segments.
- Extract every coordinate vertex and add it as a "Node" in an adjacency list.
- Create "Edges" between adjacent vertices on the same line segment.
- Use `turf.distance()` to calculate the physical weight (in meters) of each edge.
- If lines touch or cross at intersections (meaning they share exact or near-exact coordinates), they will be merged into the same graph node so the algorithm knows it can turn there.

### 3. A* Algorithm Implementation
- Write a standard A* search algorithm:
  - **Heuristic**: Straight-line distance from current node to destination node.
  - **Cost (g-score)**: Accumulated walking distance along the road network.
- The algorithm will trace from node to node, exploring intersections, and resolving the absolutely shortest path to the destination.

### 4. Update `getDirections()`
- **Start Point**: Snap the current `KIOSK_COORDS` to the closest node on the road graph.
- **End Point**: Snap the selected `building.coords` to the closest node on the road graph. (Because you drew the roads directly up to the building entrances, the closest road node to the building will perfectly align with the entrance you specified).
- **Execution**: Run the A* algorithm and extract the array of coordinates.
- **Display**: Replace the straight-line `routeCoords` with the A* path coordinates. The map will instantly draw the curving path, calculate the true distance, and animate the camera to show the whole route!

## User Review Required
> [!IMPORTANT]
> The algorithm will automatically find the entrance you drew because it snaps to the nearest road vertex to the building's center. Is there any specific building where the entrance is extremely far from the building's center coordinate? If so, we can manually adjust the "End Point" coordinate for that specific building. Otherwise, the auto-snap will work perfectly for all 1-entrance and 2-entrance buildings.

## Verification Plan
1. **Automated Graph Building**: I will verify that the graph parses all 40 roads from `roads.json` without errors.
2. **Manual Verification**: I will test the routing by generating a path to the Admin Building (which you noted has 2 entrances) and verify it takes the shortest walkway route instead of a straight line through the grass.
