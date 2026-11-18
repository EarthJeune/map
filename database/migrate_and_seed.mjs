/**
 * DA-CALABARZON Interactive 3D Map & Spatial Hub
 * 10-Table MySQL Schema Migration & Automatic Ground-Truth Seeder
 * Populates the `kiosk` MySQL database from existing ES modules and GeoJSON files.
 */

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { STATIONS } from '../js/data/stations.js';
import { BUILDING_DIRECTORY, CUSTOM_3D_BUILDINGS, LARES_DRAWINGS } from '../js/data/buildings.js';
import { BUILDING_OFFICES } from '../js/data/offices.js';
import { BUILDING_WAYFINDING_INFO } from '../js/data/descriptions.js';
import { FIELD_COMMODITY_ZONES } from '../js/data/plots.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function readJsonSafe(relPath, fallback = null) {
    try {
        const fullPath = path.join(ROOT_DIR, relPath);
        if (fs.existsSync(fullPath)) {
            return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        }
    } catch (e) {
        console.warn(`[Seed] Warning reading ${relPath}:`, e.message);
    }
    return fallback;
}

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'kiosk',
        multipleStatements: true
    });

    console.log('=================================================================');
    console.log('DA-CALABARZON 10-TABLE MYSQL MIGRATION & SEEDER');
    console.log('Connected to MySQL database:', process.env.DB_NAME || 'kiosk');
    console.log('=================================================================');

    // 1. Run Schema Migrations (10 Tables)
    console.log('[1/7] Running 10-Table MySQL Schema Migrations...');
    await conn.query(`
        SET FOREIGN_KEY_CHECKS = 0;

        CREATE TABLE IF NOT EXISTS stations (
            station_id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            label VARCHAR(150) NOT NULL,
            subtitle VARCHAR(255) NULL,
            full_name VARCHAR(255) NULL,
            province VARCHAR(150) NULL,
            status ENUM('live', 'under_development') DEFAULT 'under_development',
            kiosk_pin_lng DOUBLE NOT NULL,
            kiosk_pin_lat DOUBLE NOT NULL,
            drone_offset_dx DOUBLE DEFAULT 0,
            drone_offset_dy DOUBLE DEFAULT 0,
            default_center_lng DOUBLE NOT NULL,
            default_center_lat DOUBLE NOT NULL,
            default_zoom DOUBLE DEFAULT 19.0,
            default_pitch DOUBLE DEFAULT 52.0,
            default_bearing DOUBLE DEFAULT 0.0,
            mbtiles_filename VARCHAR(255) NULL,
            boundary_geojson LONGTEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS buildings (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            station_id VARCHAR(50) NOT NULL,
            building_code VARCHAR(100) NOT NULL,
            building_num INT NULL,
            name VARCHAR(255) NOT NULL,
            category VARCHAR(80) DEFAULT 'infrastructure',
            type_label VARCHAR(150) NULL,
            section VARCHAR(150) DEFAULT 'Compound',
            icon VARCHAR(80) DEFAULT '🏢',
            pin_color VARCHAR(30) DEFAULT '#3b82f6',
            roof_color VARCHAR(30) DEFAULT '#334155',
            description TEXT NULL,
            compact_tag VARCHAR(150) NULL,
            visual_landmark TEXT NULL,
            key_services TEXT NULL,
            marker_lng DOUBLE NULL,
            marker_lat DOUBLE NULL,
            label_offset_lng DOUBLE NULL,
            label_offset_lat DOUBLE NULL,
            model_glb_url VARCHAR(255) NULL,
            model_scale VARCHAR(100) NULL,
            model_rotation VARCHAR(100) NULL,
            model_altitude DOUBLE DEFAULT 0,
            footprint_geojson LONGTEXT NULL,
            height DOUBLE DEFAULT 5.0,
            is_subplot TINYINT(1) DEFAULT 0,
            has_marker TINYINT(1) DEFAULT 1,
            is_visible TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_station_building (station_id, building_code),
            CONSTRAINT fk_bldg_station FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS building_images (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            station_id VARCHAR(50) NOT NULL,
            building_code VARCHAR(100) NOT NULL,
            image_webp_url VARCHAR(255) NOT NULL,
            caption VARCHAR(255) NULL,
            display_order INT DEFAULT 1,
            is_primary TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_bldg_images (station_id, building_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS building_offices (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            station_id VARCHAR(50) NOT NULL,
            building_code VARCHAR(100) NOT NULL,
            office_name VARCHAR(255) NOT NULL,
            office_desc TEXT NULL,
            floor_or_room VARCHAR(100) NULL,
            search_keywords VARCHAR(255) NULL,
            display_order INT DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_bldg_offices (station_id, building_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS building_entrances (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            station_id VARCHAR(50) NOT NULL,
            building_code VARCHAR(100) NOT NULL,
            entrance_lng DOUBLE NOT NULL,
            entrance_lat DOUBLE NOT NULL,
            is_main_entrance TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_bldg_entrances (station_id, building_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS agricultural_plots (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            station_id VARCHAR(50) NOT NULL,
            plot_code VARCHAR(100) NOT NULL,
            plot_number VARCHAR(50) NULL,
            zone_name VARCHAR(255) NOT NULL,
            category VARCHAR(80) DEFAULT 'orchard',
            icon VARCHAR(80) DEFAULT '🌱',
            color VARCHAR(30) DEFAULT '#22c55e',
            current_crop VARCHAR(255) NULL,
            tree_or_plant_count INT NULL,
            cropping_cycle ENUM('annual', 'perennial', 'monthly_seasonal', 'fallow') DEFAULT 'perennial',
            cycle_months VARCHAR(100) NULL,
            area_hectares DECIMAL(8,2) NULL,
            soil_type VARCHAR(150) NULL,
            status VARCHAR(80) DEFAULT 'Active',
            description TEXT NULL,
            image_webp_url VARCHAR(255) NULL,
            center_lng DOUBLE NULL,
            center_lat DOUBLE NULL,
            label_offset_lng DOUBLE NULL,
            label_offset_lat DOUBLE NULL,
            polygon_geojson LONGTEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_station_plot (station_id, plot_code),
            CONSTRAINT fk_plot_station FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS plot_subplots (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            station_id VARCHAR(50) NOT NULL,
            parent_plot_code VARCHAR(100) NOT NULL,
            subplot_code VARCHAR(100) NOT NULL,
            name VARCHAR(255) NOT NULL,
            category VARCHAR(80) NULL,
            current_crop VARCHAR(255) NULL,
            tree_or_plant_count INT NULL,
            cropping_cycle VARCHAR(80) NULL,
            description TEXT NULL,
            image_webp_url VARCHAR(255) NULL,
            extra_images_json TEXT NULL,
            center_lng DOUBLE NULL,
            center_lat DOUBLE NULL,
            polygon_geojson LONGTEXT NULL,
            display_order INT DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_station_subplot (station_id, subplot_code),
            INDEX idx_plot_subplots (station_id, parent_plot_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS campus_trees (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            station_id VARCHAR(50) NOT NULL,
            tree_code VARCHAR(100) NULL,
            species_model VARCHAR(100) DEFAULT 'mango',
            lng DOUBLE NOT NULL,
            lat DOUBLE NOT NULL,
            scale DOUBLE DEFAULT 1.0,
            rotation DOUBLE DEFAULT 0.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_trees_station (station_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS road_features (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            station_id VARCHAR(50) NOT NULL,
            feature_code VARCHAR(100) NULL,
            road_type VARCHAR(80) DEFAULT 'road',
            name VARCHAR(255) NULL,
            building_code VARCHAR(100) NULL,
            geometry_geojson LONGTEXT NOT NULL,
            properties_json TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_roads_station (station_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS admin_audit_logs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            admin_username VARCHAR(100) DEFAULT 'admin',
            action VARCHAR(100) NOT NULL,
            target_table VARCHAR(100) NOT NULL,
            target_id VARCHAR(100) NULL,
            summary TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS admin_users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username_sha256 CHAR(64) NOT NULL UNIQUE,
            password_sha256 CHAR(64) NOT NULL,
            role VARCHAR(50) DEFAULT 'super_admin',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        SET FOREIGN_KEY_CHECKS = 1;
    `);

    // 2. Seed Stations (Table 1)
    console.log('[2/7] Seeding `stations` (DA-LARES, DA-QARES, DA-RARES, DA-CARES)...');
    const laresPin = readJsonSafe('pin.json', { coordinates: [121.16643361549615, 13.958120847881375] });
    const qaresPin = readJsonSafe('qares_pin.json', { coordinates: [121.3713315, 13.9432268] });
    const raresPin = readJsonSafe('rares_pin.json', { coordinates: [121.34000, 14.57550] });
    const droneOffset = readJsonSafe('drone_offset.json', { dx: 0, dy: 0 });
    const raresBoundary = readJsonSafe('rares_boundary.json', null);

    const mbtilesMap = {
        lares: 'LARES v1.mbtiles',
        qares: 'QARES v1.mbtiles',
        rares: 'RARES v1.mbtiles',
        cares: null
    };
    const pinMap = {
        lares: laresPin.coordinates || STATIONS.lares.kioskCoords,
        qares: qaresPin.coordinates || STATIONS.qares.kioskCoords,
        rares: raresPin.coordinates || STATIONS.rares.kioskCoords,
        cares: STATIONS.cares.center
    };

    for (const [sId, st] of Object.entries(STATIONS)) {
        const pin = pinMap[sId] || st.center;
        const statusVal = st.status === 'active' ? 'live' : 'under_development';
        await conn.query(`
            INSERT INTO stations (
                station_id, name, label, subtitle, full_name, province, status,
                kiosk_pin_lng, kiosk_pin_lat, drone_offset_dx, drone_offset_dy,
                default_center_lng, default_center_lat, default_zoom, default_pitch, default_bearing,
                mbtiles_filename, boundary_geojson
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                label = VALUES(label),
                subtitle = VALUES(subtitle),
                full_name = VALUES(full_name),
                province = VALUES(province),
                mbtiles_filename = VALUES(mbtiles_filename)
        `, [
            sId, st.name, st.label, st.sub || '', st.fullName || '', st.province || '', statusVal,
            pin[0], pin[1], sId === 'lares' ? (droneOffset.dx || 0) : 0, sId === 'lares' ? (droneOffset.dy || 0) : 0,
            st.center[0], st.center[1], st.zoom || 19.0, st.pitch || 52.0, st.bearing || 0.0,
            mbtilesMap[sId], sId === 'rares' && raresBoundary ? JSON.stringify(raresBoundary) : null
        ]);
    }

    // 3. Seed Buildings (Table 2: LARES, QARES, RARES)
    console.log('[3/7] Seeding `buildings` across DA-LARES, DA-QARES, and DA-RARES...');
    const footprintMap = {};
    if (LARES_DRAWINGS && Array.isArray(LARES_DRAWINGS.features)) {
        for (const f of LARES_DRAWINGS.features) {
            if (f.properties && f.properties.id) {
                footprintMap[f.properties.id] = f;
            }
        }
    }

    let laresBldgCount = 0;
    for (const b of BUILDING_DIRECTORY) {
        const wf = BUILDING_WAYFINDING_INFO[b.id] || {};
        const modelCfg = CUSTOM_3D_BUILDINGS[b.id] || null;
        const fp = footprintMap[b.id] || null;
        const fpProps = (fp && fp.properties) || {};

        await conn.query(`
            INSERT INTO buildings (
                station_id, building_code, building_num, name, category, type_label, section,
                icon, pin_color, roof_color, description, compact_tag, visual_landmark, key_services,
                marker_lng, marker_lat, label_offset_lng, label_offset_lat,
                model_glb_url, model_scale, model_rotation, model_altitude,
                footprint_geojson, height, is_subplot, has_marker, is_visible
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
                building_num = VALUES(building_num),
                name = VALUES(name),
                category = VALUES(category),
                type_label = VALUES(type_label),
                description = VALUES(description),
                compact_tag = VALUES(compact_tag),
                visual_landmark = VALUES(visual_landmark),
                key_services = VALUES(key_services),
                model_glb_url = VALUES(model_glb_url),
                footprint_geojson = VALUES(footprint_geojson)
        `, [
            'lares', b.id, b.num, b.name, b.category || 'infrastructure', b.type || 'Infrastructure Facility', b.section || 'Compound',
            b.icon || '🏢', b.color || '#3b82f6', b.roofColor || '#334155',
            b.desc || '', wf.compactTag || null, wf.visualLandmark || null, wf.keyServices || null,
            b.coords ? b.coords[0] : null, b.coords ? b.coords[1] : null,
            fpProps.labelOffset ? fpProps.labelOffset[0] : null, fpProps.labelOffset ? fpProps.labelOffset[1] : null,
            modelCfg ? modelCfg.modelUrl : null,
            modelCfg && modelCfg.scale ? JSON.stringify(modelCfg.scale) : null,
            modelCfg && modelCfg.rotation ? JSON.stringify(modelCfg.rotation) : null,
            modelCfg ? (modelCfg.altitude || 0) : 0,
            fp ? JSON.stringify(fp.geometry) : null,
            fpProps.height || 5.0,
            b.isSubPlot ? 1 : 0,
            b.hasMarker ? 1 : 0
        ]);
        laresBldgCount++;
    }

    // QARES buildings
    const qaresBldgs = readJsonSafe('qares_buildings.json', { features: [] });
    let qaresBldgCount = 0;
    let qaresNum = 0;
    for (const f of (qaresBldgs.features || [])) {
        const props = f.properties || {};
        const bCode = props.id || `qares_bldg_${++qaresNum}`;
        const poly = (f.geometry && f.geometry.coordinates && f.geometry.coordinates[0]) || [];
        let lng = 0, lat = 0;
        if (poly.length > 0) {
            poly.forEach(c => { lng += c[0]; lat += c[1]; });
            lng /= poly.length; lat /= poly.length;
        }
        await conn.query(`
            INSERT INTO buildings (
                station_id, building_code, building_num, name, category, type_label, section,
                icon, pin_color, roof_color, description, marker_lng, marker_lat,
                label_offset_lng, label_offset_lat, footprint_geojson, height, is_subplot, has_marker, is_visible
            ) VALUES (?, ?, ?, ?, ?, ?, 'Tiaong Compound', '🏢', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 1)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                footprint_geojson = VALUES(footprint_geojson)
        `, [
            'qares', bCode, props.num || ++qaresBldgCount, props.name || bCode,
            props.category || 'infrastructure', props.type || 'Station Facility',
            props.color || '#10b981', props.roofColor || '#334155', props.description || 'DA-QARES Research Facility',
            lng || null, lat || null,
            props.labelOffset ? props.labelOffset[0] : null, props.labelOffset ? props.labelOffset[1] : null,
            f.geometry ? JSON.stringify(f.geometry) : null,
            props.height || 5.0
        ]);
    }

    // RARES buildings
    const raresBldgs = readJsonSafe('rares_buildings.json', { features: [] });
    let raresBldgCount = 0;
    for (const f of (raresBldgs.features || [])) {
        const props = f.properties || {};
        const bCode = props.id || `rares_bldg_${++raresBldgCount}`;
        const poly = (f.geometry && f.geometry.coordinates && f.geometry.coordinates[0]) || [];
        let lng = 0, lat = 0;
        if (poly.length > 0) {
            poly.forEach(c => { lng += c[0]; lat += c[1]; });
            lng /= poly.length; lat /= poly.length;
        }
        const isGuardHouse = bCode === 'rares_building_1';
        await conn.query(`
            INSERT INTO buildings (
                station_id, building_code, building_num, name, category, type_label, section,
                icon, pin_color, roof_color, description, marker_lng, marker_lat,
                label_offset_lng, label_offset_lat, model_glb_url, footprint_geojson, height, is_subplot, has_marker, is_visible
            ) VALUES (?, ?, ?, ?, ?, ?, 'Tanay Compound', '🏢', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 1)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                model_glb_url = VALUES(model_glb_url),
                footprint_geojson = VALUES(footprint_geojson)
        `, [
            'rares', bCode, props.num || ++raresBldgCount, props.name || bCode,
            props.category || 'infrastructure', props.type || 'Station Facility',
            props.color || '#22c55e', props.roofColor || '#334155', props.description || 'DA-RARES Research Facility',
            lng || null, lat || null,
            props.labelOffset ? props.labelOffset[0] : null, props.labelOffset ? props.labelOffset[1] : null,
            isGuardHouse ? 'models/rares_guard_house.glb' : (props.modelUrl || null),
            f.geometry ? JSON.stringify(f.geometry) : null,
            props.height || 5.0
        ]);
    }
    console.log(`      Seeded ${laresBldgCount} LARES buildings, ${qaresBldgs.features?.length || 0} QARES buildings, ${raresBldgs.features?.length || 0} RARES buildings.`);

    // 4. Seed Building Images (Table 3) & Building Offices (Table 4)
    console.log('[4/7] Seeding `building_images` (.webp) and `building_offices`...');
    await conn.query('DELETE FROM building_images; DELETE FROM building_offices;');

    const imagesDir = path.join(ROOT_DIR, 'images');
    const webpFiles = fs.existsSync(imagesDir)
        ? fs.readdirSync(imagesDir).filter(f => f.endsWith('.webp'))
        : [];

    let imgCount = 0;
    for (const file of webpFiles) {
        const base = file.replace(/\.webp$/, '');
        let stationId = 'lares';
        let bCode = base;
        let caption = 'Primary Facility View';
        let order = 1;
        let isPrimary = 1;

        if (base.startsWith('rares_')) {
            stationId = 'rares';
        } else if (base.endsWith('_inside')) {
            bCode = base.replace(/_inside$/, '');
            caption = 'Interior / Inside View';
            order = 2;
            isPrimary = 0;
        } else if (base.endsWith('_side')) {
            bCode = base.replace(/_side$/, '');
            caption = 'Side Angle View';
            order = 3;
            isPrimary = 0;
        } else if (base.endsWith('_angle')) {
            bCode = base.replace(/_angle$/, '');
            caption = 'Secondary Angle View';
            order = 2;
            isPrimary = 0;
        } else if (base === 'corn_casava_building') {
            bCode = 'corn/casava_building';
        }

        await conn.query(`
            INSERT INTO building_images (station_id, building_code, image_webp_url, caption, display_order, is_primary)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [stationId, bCode, `images/${file}`, caption, order, isPrimary]);
        imgCount++;
    }

    let officeCount = 0;
    for (const [bCode, officeData] of Object.entries(BUILDING_OFFICES)) {
        if (!Array.isArray(officeData)) continue;
        let order = 1;
        for (const item of officeData) {
            if (typeof item === 'string') {
                await conn.query(`
                    INSERT INTO building_offices (station_id, building_code, office_name, floor_or_room, display_order)
                    VALUES ('lares', ?, ?, NULL, ?)
                `, [bCode, item, order++]);
                officeCount++;
            } else if (item && typeof item === 'object' && Array.isArray(item.offices)) {
                for (const subName of item.offices) {
                    await conn.query(`
                        INSERT INTO building_offices (station_id, building_code, office_name, floor_or_room, display_order)
                        VALUES ('lares', ?, ?, ?, ?)
                    `, [bCode, subName, item.floor || null, order++]);
                    officeCount++;
                }
            }
        }
    }
    console.log(`      Seeded ${imgCount} .webp images and ${officeCount} official offices.`);

    // 5. Seed Agricultural Plots (Table 6) & Sub-Plots (Table 7)
    console.log('[5/7] Seeding `agricultural_plots` and `plot_subplots`...');
    await conn.query('DELETE FROM plot_subplots;');

    let plotCount = 0;
    let subPlotCount = 0;
    for (const zone of FIELD_COMMODITY_ZONES) {
        const isSeasonal = /corn|rice|vegetable|cassava|legume|rootcrop|fallow/i.test(zone.name);
        const isFallow = /fallow/i.test(zone.name);
        const cycleType = isFallow ? 'fallow' : (isSeasonal ? 'monthly_seasonal' : 'perennial');
        const cycleLabel = isFallow ? 'Fallow / Soil Rest' : (isSeasonal ? '3–4 Months (Seasonal)' : 'Year-round (Perennial)');

        await conn.query(`
            INSERT INTO agricultural_plots (
                station_id, plot_code, plot_number, zone_name, category, icon, color,
                current_crop, tree_or_plant_count, cropping_cycle, cycle_months,
                status, description, image_webp_url, center_lng, center_lat, polygon_geojson
            ) VALUES ('lares', ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'Active', ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                plot_number = VALUES(plot_number),
                zone_name = VALUES(zone_name),
                category = VALUES(category),
                description = VALUES(description),
                polygon_geojson = VALUES(polygon_geojson)
        `, [
            zone.id, zone.plotRange || '', zone.name, zone.category || 'orchard',
            zone.icon || '🌱', zone.color || '#22c55e',
            zone.name, cycleType, cycleLabel,
            zone.description || '',
            fs.existsSync(path.join(ROOT_DIR, `images/${zone.id}.webp`)) ? `images/${zone.id}.webp` : null,
            zone.centerCoords ? zone.centerCoords[0] : null,
            zone.centerCoords ? zone.centerCoords[1] : null,
            zone.groupPolygon ? JSON.stringify(zone.groupPolygon) : null
        ]);
        plotCount++;

        if (Array.isArray(zone.subPlots)) {
            let spOrder = 1;
            for (const sp of zone.subPlots) {
                const spCode = sp.id || sp.buildingId || `${zone.id}_sp_${spOrder}`;
                const spPoly = sp.polygon || [];
                let spLng = sp.coords ? sp.coords[0] : null;
                let spLat = sp.coords ? sp.coords[1] : null;
                if (!spLng && spPoly.length > 0) {
                    let sLng = 0, sLat = 0;
                    spPoly.forEach(c => { sLng += c[0]; sLat += c[1]; });
                    spLng = sLng / spPoly.length;
                    spLat = sLat / spPoly.length;
                }
                await conn.query(`
                    INSERT INTO plot_subplots (
                        station_id, parent_plot_code, subplot_code, name, category,
                        current_crop, description, image_webp_url, center_lng, center_lat, polygon_geojson, display_order
                    ) VALUES ('lares', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        name = VALUES(name),
                        description = VALUES(description),
                        image_webp_url = VALUES(image_webp_url),
                        polygon_geojson = VALUES(polygon_geojson)
                `, [
                    zone.id, spCode, sp.name, sp.category || zone.category,
                    sp.crop || sp.name, sp.desc || sp.description || '',
                    sp.image ? sp.image.replace(/\.(jpg|png)$/i, '.webp') : null,
                    spLng, spLat,
                    sp.polygon ? JSON.stringify(sp.polygon) : null,
                    spOrder++
                ]);
                subPlotCount++;
            }
        }
    }

    // RARES plots
    const raresPlots = readJsonSafe('rares_plots.json', { features: [] });
    for (const f of (raresPlots.features || [])) {
        const props = f.properties || {};
        const pCode = props.id || `rares_plot_${props.plotNumber || plotCount}`;
        const poly = (f.geometry && f.geometry.coordinates && f.geometry.coordinates[0]) || [];
        let lng = 0, lat = 0;
        if (poly.length > 0) {
            poly.forEach(c => { lng += c[0]; lat += c[1]; });
            lng /= poly.length; lat /= poly.length;
        }
        await conn.query(`
            INSERT INTO agricultural_plots (
                station_id, plot_code, plot_number, zone_name, category, icon, color,
                current_crop, cropping_cycle, cycle_months, status, description,
                center_lng, center_lat, label_offset_lng, label_offset_lat, polygon_geojson
            ) VALUES ('rares', ?, ?, ?, ?, '🌱', ?, ?, 'perennial', 'Year-round (Perennial)', 'Active', ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                zone_name = VALUES(zone_name),
                polygon_geojson = VALUES(polygon_geojson)
        `, [
            pCode, String(props.plotNumber || ''), props.name || `Plot ${props.plotNumber}`,
            props.category || 'orchard', props.color || '#22c55e',
            props.crop || props.name || 'Research Crop', props.description || 'DA-RARES Agricultural Plot',
            lng || null, lat || null,
            props.labelOffset ? props.labelOffset[0] : null, props.labelOffset ? props.labelOffset[1] : null,
            f.geometry ? JSON.stringify(f.geometry) : null
        ]);
        plotCount++;
    }
    console.log(`      Seeded ${plotCount} agricultural plots and ${subPlotCount} screenhouse sub-plots.`);

    // 6. Seed Campus Trees (Table 8) & Roads/Entrances (Table 5 & Table 9)
    console.log('[6/7] Seeding `campus_trees`, `road_features`, and `building_entrances`...');
    await conn.query('DELETE FROM campus_trees; DELETE FROM road_features; DELETE FROM building_entrances;');

    const treesGeo = readJsonSafe('trees.json', { features: [] });
    let treeCount = 0;
    for (const f of (treesGeo.features || [])) {
        if (!f.geometry || !f.geometry.coordinates) continue;
        const props = f.properties || {};
        await conn.query(`
            INSERT INTO campus_trees (station_id, tree_code, species_model, lng, lat, scale, rotation)
            VALUES ('lares', ?, ?, ?, ?, ?, ?)
        `, [
            props.id || `tree_${++treeCount}`,
            props.model || props.type || 'mango',
            f.geometry.coordinates[0],
            f.geometry.coordinates[1],
            props.scale || 1.0,
            props.rotation || 0.0
        ]);
    }

    const roadFiles = [
        { station: 'lares', file: 'roads.json' },
        { station: 'qares', file: 'qares_roads.json' },
        { station: 'rares', file: 'rares_roads.json' }
    ];
    let roadCount = 0;
    let entranceCount = 0;
    for (const rf of roadFiles) {
        const rGeo = readJsonSafe(rf.file, { features: [] });
        for (const f of (rGeo.features || [])) {
            if (!f.geometry) continue;
            const props = f.properties || {};
            const rType = props.type || (f.geometry.type === 'Point' ? 'entrance' : 'road');
            await conn.query(`
                INSERT INTO road_features (station_id, feature_code, road_type, name, building_code, geometry_geojson, properties_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                rf.station, props.id || `road_${++roadCount}`, rType,
                props.name || null, props.buildingId || null,
                JSON.stringify(f.geometry), JSON.stringify(props)
            ]);

            if (f.geometry.type === 'Point' && props.type === 'entrance' && props.buildingId) {
                await conn.query(`
                    INSERT INTO building_entrances (station_id, building_code, entrance_lng, entrance_lat, is_main_entrance)
                    VALUES (?, ?, ?, ?, 1)
                `, [rf.station, props.buildingId, f.geometry.coordinates[0], f.geometry.coordinates[1]]);
                entranceCount++;
            }
        }
    }
    console.log(`      Seeded ${treeCount} 3D trees, ${roadCount} road features, and ${entranceCount} building entrances.`);

    // 7. Record Audit Log Entry (Table 10)
    console.log('[7/7] Writing initial migration & seed audit log...');
    await conn.query(`
        INSERT INTO admin_audit_logs (admin_username, action, target_table, target_id, summary)
        VALUES ('admin', 'DATABASE_SEED', 'ALL_10_TABLES', 'v1.0', ?)
    `, [`Seeded 4 stations, ${laresBldgCount} LARES buildings, ${imgCount} WebP images, ${officeCount} offices, ${plotCount} plots, ${subPlotCount} sub-plots, ${treeCount} trees, and ${roadCount} road features.`]);

    await conn.end();
    console.log('=================================================================');
    console.log('SUCCESS: All 10 MySQL tables created and seeded in `kiosk`!');
    console.log('=================================================================');
}

main().catch(err => {
    console.error('Migration/Seed Error:', err);
    process.exit(1);
});
