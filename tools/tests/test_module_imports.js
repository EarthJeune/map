// Mock browser globals to test ES Module loading of all map JS files
global.window = {
    location: { search: '', href: 'http://localhost:8080/' },
    innerWidth: 1080,
    innerHeight: 1920,
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
    },
    navigator: { userAgent: 'Chrome Kiosk' },
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    document: {
        addEventListener: () => {},
        removeEventListener: () => {},
        documentElement: { classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false } },
        body: { classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false } },
        getElementById: () => ({
            classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
            style: {},
            textContent: '',
            value: '',
            setAttribute: () => {},
            getAttribute: () => null,
            addEventListener: () => {}
        }),
        querySelectorAll: () => [],
        createElement: () => ({
            classList: { add: () => {}, remove: () => {} },
            style: {},
            textContent: '',
            setAttribute: () => {},
            getAttribute: () => null,
            addEventListener: () => {}
        })
    }
};
global.document = global.window.document;
global.navigator = global.window.navigator;
global.localStorage = global.window.localStorage;
global.location = global.window.location;
global.fetch = () => Promise.resolve({ json: () => Promise.resolve({ features: [] }) });
global.requestAnimationFrame = global.window.requestAnimationFrame;

global.mapboxgl = {
    accessToken: '',
    Map: class {
        constructor() {
            this.on = () => {};
            this.addControl = () => {};
            this.addSource = () => {};
            this.getSource = () => null;
            this.addLayer = () => {};
            this.getLayer = () => null;
            this.getStyle = () => ({ layers: [] });
            this.setFog = () => {};
            this.getCenter = () => ({ lng: 121.169, lat: 13.959 });
            this.getZoom = () => 17.0;
            this.getPitch = () => 0;
            this.getCanvas = () => ({ style: {} });
            this.getCanvasContainer = () => ({ addEventListener: () => {}, removeEventListener: () => {} });
            this.touchPitch = { enable: () => {}, disable: () => {} };
            this.dragRotate = { enable: () => {}, disable: () => {} };
        }
    },
    NavigationControl: class {},
    ScaleControl: class {
        _setScale() {}
    },
    FullscreenControl: class {},
    Marker: class {
        constructor() {
            this.setLngLat = () => this;
            this.addTo = () => this;
            this.remove = () => {};
            this.getElement = () => ({ style: {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} } });
        }
    }
};

async function test() {
    try {
        console.log('Testing import of ../../js/app.js ...');
        await import('../../js/app.js');
        console.log('SUCCESS: ../../js/app.js imported without error!');
    } catch (e) {
        console.error('FATAL ERROR DURING IMPORT:', e);
    }
}

test();
