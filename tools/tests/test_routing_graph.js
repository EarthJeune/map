const fs = require('fs');
const turf = require('@turf/turf');

const roads = JSON.parse(fs.readFileSync('roads.json', 'utf8'));

// Exact function from js/routing.js
function buildRoadGraph(geojson) {
    const graph = new Map();
    const nodeCoords = [];

    function getSnappedKey(coord) {
        let nearestDist = Infinity;
        let nearestKey = null;
        for (const n of nodeCoords) {
            const dist = turf.distance(coord, n.coord, { units: 'meters' });
            if (dist < 0.5) {
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestKey = n.key;
                }
            }
        }
        if (nearestKey) return nearestKey;
        const key = `${coord[0]},${coord[1]}`;
        nodeCoords.push({ key: key, coord: coord });
        return key;
    }

    function addEdge(coord1, coord2) {
        const key1 = getSnappedKey(coord1);
        const key2 = getSnappedKey(coord2);

        if (key1 === key2) return;

        if (!graph.has(key1)) graph.set(key1, { coord: coord1, edges: [] });
        if (!graph.has(key2)) graph.set(key2, { coord: coord2, edges: [] });

        const dist = turf.distance(coord1, coord2, { units: 'meters' });

        graph.get(key1).edges.push({ to: key2, cost: dist });
        graph.get(key2).edges.push({ to: key1, cost: dist });
    }

    geojson.features.forEach(feature => {
        if (feature.geometry.type === 'LineString') {
            try {
                const chunks = turf.lineChunk(feature, 1, { units: 'meters' });
                chunks.features.forEach(chunk => {
                    const coords = chunk.geometry.coordinates;
                    for (let i = 0; i < coords.length - 1; i++) {
                        addEdge(coords[i], coords[i + 1]);
                    }
                });
            } catch (e) {
                const coords = feature.geometry.coordinates;
                for (let i = 0; i < coords.length - 1; i++) {
                    addEdge(coords[i], coords[i + 1]);
                }
            }
        }
    });

    return graph;
}

function findNearestNode(coord, graph) {
    let nearestKey = null;
    let minDist = Infinity;
    for (const [key, node] of graph.entries()) {
        const dist = turf.distance(coord, node.coord, { units: 'meters' });
        if (dist < minDist) {
            minDist = dist;
            nearestKey = key;
        }
    }
    return nearestKey;
}

function findShortestPath(startCoord, endCoord, graph) {
    const startKey = findNearestNode(startCoord, graph);
    const endKey = findNearestNode(endCoord, graph);

    if (!startKey || !endKey) return null;

    const openSet = new Set([startKey]);
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    for (const key of graph.keys()) {
        gScore.set(key, Infinity);
        fScore.set(key, Infinity);
    }

    gScore.set(startKey, 0);
    fScore.set(startKey, turf.distance(graph.get(startKey).coord, graph.get(endKey).coord, { units: 'meters' }));

    while (openSet.size > 0) {
        let current = null;
        let lowestF = Infinity;
        for (const key of openSet) {
            const score = fScore.get(key);
            if (score < lowestF) {
                lowestF = score;
                current = key;
            }
        }

        if (current === endKey) {
            const path = [];
            let curr = current;
            while (curr) {
                path.unshift(graph.get(curr).coord);
                curr = cameFrom.get(curr);
            }
            return path;
        }

        openSet.delete(current);

        const neighbors = graph.get(current).edges;
        for (const neighbor of neighbors) {
            const tentativeGScore = gScore.get(current) + neighbor.cost;
            if (tentativeGScore < gScore.get(neighbor.to)) {
                cameFrom.set(neighbor.to, current);
                gScore.set(neighbor.to, tentativeGScore);
                const hScore = turf.distance(graph.get(neighbor.to).coord, graph.get(endKey).coord, { units: 'meters' });
                fScore.set(neighbor.to, tentativeGScore + hScore);
                openSet.add(neighbor.to);
            }
        }
    }
    return null;
}

console.log('Building graph using authentic turf lineChunk & 0.5m snapping...');
const t0 = Date.now();
const graph = buildRoadGraph(roads);
console.log(`Graph built in ${Date.now() - t0}ms: ${graph.size} nodes.`);

const kioskCoord = [121.16584, 13.95825];

const aliasMap = {
    'mis_building': 'mis_rafis_building',
    'rafis_building': 'mis_rafis_building',
    'fod_building': 'lares_building',
    'bac_building': 'tanco_hall_building',
    'pmed_building': 'tanco_hall_building',
    'fmr': 'multi_purpose_administrative_building',
    'mis_data_center': 'multi_purpose_administrative_building',
    'vacant': 'multi_purpose_administrative_building'
};

const entranceFeatures = roads.features.filter(f => f.geometry.type === 'Point' && f.properties && f.properties.type === 'entrance');
console.log(`Testing ${entranceFeatures.length} building entrances from Kiosk...`);

let reachable = 0;
let failed = [];

entranceFeatures.forEach(ent => {
    const rawId = ent.properties.buildingId || ent.properties.name;
    const targetId = aliasMap[rawId] || rawId;
    const coord = ent.geometry.coordinates;
    const path = findShortestPath(kioskCoord, coord, graph);
    if (path && path.length > 0) {
        reachable++;
    } else {
        failed.push(`${rawId} (${coord})`);
    }
});

console.log(`\nPathfinding Result: ${reachable}/${entranceFeatures.length} entrances reachable.`);
if (failed.length > 0) {
    console.log('Unreachable:', failed);
} else {
    console.log('All entrances are 100% reachable with zero broken road segments!');
}
