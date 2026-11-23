import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

test('3.2 & 3.5 CSS design tokens, contrast parity, reduced-motion, and brace balance', () => {
    const css = fs.readFileSync(path.join(ROOT, 'css', 'portal.css'), 'utf8');
    let bal = 0;
    for (const ch of css) {
        if (ch === '{') bal++;
        else if (ch === '}') bal--;
    }
    assert.equal(bal, 0, 'css/portal.css must have balanced braces');
    for (const token of ['--sp-2: 8px', '--fs-body: 14px', '--fs-xs: 12px', '--motion-fast: 150ms', 'prefers-reduced-motion', ':focus-visible', 'overscroll-behavior: contain', '.kpi-card-modern', '.portal-skeleton', 'body[data-theme="light"] #login-overlay']) {
        assert.ok(css.includes(token), `portal.css should define ${token}`);
    }
});

test('3.4 Navigation: breadcrumbs, global search, collapsible sidebar, and preserved sidebar layout', () => {
    const html = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
    assert.ok(html.includes('name="color-scheme" content="light dark"'));
    assert.ok(html.includes('id="portal-breadcrumbs"'));
    assert.ok(html.includes('id="portal-global-search"'));
    assert.ok(html.includes('id="sidebar-collapse-btn"'));
    assert.ok(html.includes('id="sidebar-footer-role-bar"'));
    assert.ok(html.indexOf('id="sidebar-user-card"') > html.indexOf('logoutAdmin()'), 'User card remains below Log Out');
});

test('3.1 & 3.3 Role-specific home screens, modern KPIs, single Open Live 3D Map CTA, and 5-state progress strip', () => {
    const dash = fs.readFileSync(path.join(ROOT, 'js', 'portal', 'dashboard.js'), 'utf8');
    assert.ok(dash.includes("role === 'gis_editor'"));
    assert.ok(dash.includes("role === 'reviewer'"));
    assert.ok(dash.includes("role === 'administrator'"));
    assert.ok(dash.includes('kpi-card-modern'));
    assert.ok(dash.includes('kpi-progress-track'));
    assert.ok(!dash.includes('Open Public Map ↗'), 'Duplicate Open Public Map button removed from dashboard');

    const cr = fs.readFileSync(path.join(ROOT, 'js', 'portal', 'change-requests.js'), 'utf8');
    for (const stateLabel of ["'Draft'", "'In review'", "'Needs revision'", "'Approved'", "'Published'"]) {
        assert.ok(cr.includes(stateLabel), `Request progress strip should include ${stateLabel}`);
    }
});
