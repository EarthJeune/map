/**
 * Super-Admin Capacity & Burst Stress Diagnostics Tab
 * Safe loopback burst check (read-only cache, DB ping & memory/pool telemetry).
 */

import { PortalState, apiFetch, escapeHtml, showToast } from './core.js';
import { guardAsyncAction } from '../ui-guard.js';

export async function renderDiagnosticsTab(container) {
    if (PortalState.baseRole !== 'super_admin') {
        container.innerHTML = `<div class="panel-card"><h3>Access Restricted</h3><p style="color:#94a3b8; margin-top:8px;">Capacity diagnostics are available exclusively to Super Admin accounts.</p></div>`;
        return;
    }

    container.innerHTML = `
        <div class="panel-card">
            <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px;">
                <div>
                    <h2 style="font-size:18px; color:#f8fafc;">Capacity & 1,000-Burst Diagnostics</h2>
                    <p style="font-size:12.5px; color:#94a3b8; margin-top:4px;">
                        Safely stress-test cached reads, MySQL pool responsiveness, and compression without inserting fake database rows.
                    </p>
                </div>
                <span class="badge-pill" style="background:rgba(16,185,129,0.14); border:1px solid rgba(52,211,153,0.35); color:#6ee7b7; padding:6px 12px; border-radius:999px; font-size:11.5px; font-weight:700;">
                    Node.js + Express + MySQL Stack
                </span>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:10px; margin-bottom:16px;">
                <div>
                    <label style="display:block; font-size:11px; color:#94a3b8; margin-bottom:5px; text-transform:uppercase;">Target Station</label>
                    <select id="diag-station" class="form-control" style="min-height:44px;">
                        <option value="lares" ${PortalState.currentStation === 'lares' ? 'selected' : ''}>DA-LARES</option>
                        <option value="qares" ${PortalState.currentStation === 'qares' ? 'selected' : ''}>DA-QARES</option>
                        <option value="rares" ${PortalState.currentStation === 'rares' ? 'selected' : ''}>DA-RARES</option>
                        <option value="cares" ${PortalState.currentStation === 'cares' ? 'selected' : ''}>DA-CARES</option>
                    </select>
                </div>
                <div>
                    <label style="display:block; font-size:11px; color:#94a3b8; margin-bottom:5px; text-transform:uppercase;">Concurrent Workers</label>
                    <select id="diag-concurrency" class="form-control" style="min-height:44px;">
                        <option value="50">50 concurrent</option>
                        <option value="100" selected>100 concurrent</option>
                        <option value="200">200 concurrent</option>
                    </select>
                </div>
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:10px;">
                <button type="button" class="btn btn-secondary" id="diag-btn-250" style="min-height:44px;">Run 250-Req Burst</button>
                <button type="button" class="btn btn-emerald" id="diag-btn-500" style="min-height:44px;">Run 500-Req Burst</button>
                <button type="button" class="btn btn-primary" id="diag-btn-1000" style="min-height:44px; background:linear-gradient(135deg,#8b5cf6,#6d28d9); border:none; color:#fff;">Run 1,000-Req Flood</button>
            </div>
        </div>

        <div class="panel-card" id="diag-results-card" style="margin-top:16px; display:none;"></div>

        <div class="panel-card" style="margin-top:16px;">
            <h3 style="font-size:15px; color:#f8fafc; margin-bottom:8px;">Full Offline CLI Stress Suite (Writes, Auth Cooldown & 1,000-Click Browser Chaos)</h3>
            <p style="font-size:12.5px; color:#94a3b8; line-height:1.5;">
                For destructive write-race verification (100x concurrent Publish locks, OTP spam limits, & 1,000 rapid headless UI clicks with automatic rollback cleanup), run these on your terminal:
            </p>
            <pre style="margin-top:10px; padding:12px; border-radius:10px; background:rgba(2,6,23,0.8); border:1px solid rgba(255,255,255,0.08); color:#a7f3d0; font-family:'JetBrains Mono',monospace; font-size:12px; overflow-x:auto;">npm run stress-test
python tools/ui_spam_stress.py</pre>
        </div>
    `;

    async function executeDiagnosticBurst(totalRequests, btn) {
        await guardAsyncAction(btn, async () => {
            const st = document.getElementById('diag-station')?.value || 'lares';
            const conc = Number(document.getElementById('diag-concurrency')?.value || 100);
            const resultsEl = document.getElementById('diag-results-card');
            if (resultsEl) {
                resultsEl.style.display = 'block';
                resultsEl.innerHTML = `<div style="color:#a7f3d0; font-size:13px;">Running ${totalRequests} requests (${conc} concurrent) on DA-${escapeHtml(st.toUpperCase())}...</div>`;
            }
            try {
                const data = await apiFetch('/api/admin/diagnostics/burst-test', {
                    method: 'POST',
                    body: JSON.stringify({ station: st, totalRequests, concurrency: conc })
                });
                const b = data.benchmarks.bootstrap;
                const v = data.benchmarks.version;
                const okBoot = Number(b.statusCounts['200'] || 0);
                const errBoot = totalRequests - okBoot;
                const okVer = Number(v.statusCounts['200'] || 0);
                const errVer = totalRequests - okVer;

                if (resultsEl) {
                    resultsEl.innerHTML = `
                        <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; margin-bottom:14px;">
                            <h3 style="font-size:15px; color:#f8fafc;">Burst Result (${totalRequests}× @ ${conc} concurrent)</h3>
                            <span style="font-size:12px; color:${errBoot === 0 && errVer === 0 ? '#4ade80' : '#fbbf24'}; font-weight:700;">
                                MySQL Ping: ${data.dbPingMs} ms • Pool Max: ${data.poolConfig.connectionLimit} (Queue Cap: ${data.poolConfig.queueLimit})
                            </span>
                        </div>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
                            <div style="padding:12px; border-radius:12px; background:rgba(16,185,129,0.08); border:1px solid rgba(52,211,153,0.22);">
                                <div style="font-size:11px; text-transform:uppercase; color:#6ee7b7; font-weight:700;">GET /api/bootstrap?station=${escapeHtml(st)}</div>
                                <div style="font-size:22px; font-weight:800; color:#f8fafc; margin-top:4px;">${b.rps} req/s</div>
                                <div style="font-size:12px; color:#cbd5e1; margin-top:6px;">
                                    200 OK: <strong>${okBoot}</strong> | Other: <strong>${errBoot}</strong><br>
                                    Wall: <strong>${b.wallMs} ms</strong> | p50: <strong>${b.p50Ms} ms</strong> | p95: <strong>${b.p95Ms} ms</strong> | Max: <strong>${b.maxMs} ms</strong>
                                </div>
                            </div>
                            <div style="padding:12px; border-radius:12px; background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.22);">
                                <div style="font-size:11px; text-transform:uppercase; color:#7dd3fc; font-weight:700;">GET /api/version</div>
                                <div style="font-size:22px; font-weight:800; color:#f8fafc; margin-top:4px;">${v.rps} req/s</div>
                                <div style="font-size:12px; color:#cbd5e1; margin-top:6px;">
                                    200 OK: <strong>${okVer}</strong> | Other: <strong>${errVer}</strong><br>
                                    Wall: <strong>${v.wallMs} ms</strong> | p50: <strong>${v.p50Ms} ms</strong> | p95: <strong>${v.p95Ms} ms</strong> | Max: <strong>${v.maxMs} ms</strong>
                                </div>
                            </div>
                        </div>
                        <div style="margin-top:12px; font-size:12px; color:#94a3b8;">
                            Memory RSS: ${data.memoryMb.rssBefore} MB → ${data.memoryMb.rssAfter} MB (Heap Used: ${data.memoryMb.heapUsed} MB) • Cached Stations: ${data.cacheEntries} • Async Mail Queue: ${data.mailQueueDepth}
                        </div>
                    `;
                }
                showToast(`Diagnostics passed: ${b.rps} req/s on /api/bootstrap`);
            } catch (err) {
                if (resultsEl) {
                    resultsEl.innerHTML = `<div style="color:#fda4af;">Diagnostics failed: ${escapeHtml(err.message)}</div>`;
                }
                showToast(err.message);
            }
        }, { lockKey: 'diag:burst', cooldownMs: 800, busyText: 'Testing...' });
    }

    document.getElementById('diag-btn-250')?.addEventListener('click', (e) => executeDiagnosticBurst(250, e.currentTarget));
    document.getElementById('diag-btn-500')?.addEventListener('click', (e) => executeDiagnosticBurst(500, e.currentTarget));
    document.getElementById('diag-btn-1000')?.addEventListener('click', (e) => executeDiagnosticBurst(1000, e.currentTarget));
}

