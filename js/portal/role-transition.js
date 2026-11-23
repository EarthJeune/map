/**
 * Role-Themed Full-Screen Portal Transition Animation Engine
 * Drives fresh login transitions and Super Admin live role switches.
 */

import { escapeHtml } from './core.js';

export const ROLE_TRANSITION_PROFILES = {
    super_admin: {
        title: 'Super Admin Overseer',
        badgeTag: 'OVERSEER COMMAND',
        iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        loginSubtitle: 'Full multi-station oversight, live role switching, audit logs & publishing authority across DA-CALABARZON.',
        switchSubtitle: 'Restoring full Overseer Command controls, security audit trail & multi-station governance.',
        loginSteps: () => [
            'Authenticating Overseer credentials...',
            'Loading 4 research stations, audit logs & governance queues...',
            'Overseer Command ready.'
        ],
        switchSteps: () => [
            'Restoring Super Admin privileges...',
            'Syncing multi-station dashboard & audit modules...',
            'Overseer Command ready.'
        ]
    },
    administrator: {
        title: 'Administrator (MIS Supt.)',
        badgeTag: 'MIS ADMINISTRATOR',
        iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>`,
        loginSubtitle: 'Manage staff approvals, role assignments, verified change requests, read-only station directory & live map publishing.',
        switchSubtitle: 'Switching interface to Administrator (MIS Supt.) governance, approvals & direct publish controls.',
        loginSteps: (st) => [
            'Verifying Administrator session & station scope...',
            `Loading ${st} approvals, publish queue & read-only directory...`,
            'Administrator workspace ready.'
        ],
        switchSteps: (st) => [
            'Applying Administrator (MIS Supt.) permissions...',
            `Configuring ${st} governance & publish workspace...`,
            'Administrator view ready.'
        ]
    },
    gis_editor: {
        title: 'GIS Spatial Editor',
        badgeTag: 'SPATIAL EDITOR',
        iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
        loginSubtitle: 'Edit building footprints, agricultural plots, road graphs, photos & submit tracked change requests.',
        switchSubtitle: 'Switching workspace to GIS Spatial Editor CRUD modules & visual map drawing tools.',
        loginSteps: (st) => [
            'Authenticating GIS Editor credentials...',
            `Preparing ${st} buildings, plots, offices & map editors...`,
            'GIS Spatial Editor ready.'
        ],
        switchSteps: (st) => [
            'Configuring GIS Spatial Editor workspace...',
            `Loading ${st} visual editors & submission tracker...`,
            'GIS Spatial Editor ready.'
        ]
    },
    reviewer: {
        title: 'Station Reviewer',
        badgeTag: 'STATION REVIEWER',
        iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
        loginSubtitle: 'Inspect station directories in read-only mode, verify field diffs & approve change requests.',
        switchSubtitle: 'Switching interface to Station Reviewer approval queue & verified read-only directory.',
        loginSteps: (st) => [
            'Authenticating Station Reviewer session...',
            `Loading ${st} pending approvals & before/after diff viewer...`,
            'Station Reviewer workspace ready.'
        ],
        switchSteps: (st) => [
            'Applying Station Reviewer workspace permissions...',
            `Loading ${st} review queue & read-only directory...`,
            'Station Reviewer view ready.'
        ]
    },
    visitor: {
        title: 'Visitor 3D Map Preview',
        badgeTag: 'PUBLIC PREVIEW',
        iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
        loginSubtitle: 'Launching the interactive 3D campus wayfinding map with public navigation & directory controls.',
        switchSubtitle: 'Transitioning from Portal into the public 3D campus kiosk & interactive wayfinding map.',
        loginSteps: (st) => [
            'Initializing public 3D map preview...',
            `Preparing ${st} 3D buildings, drone imagery & routing...`,
            `Opening ${st} Live 3D Map...`
        ],
        switchSteps: (st) => [
            'Switching to public visitor perspective...',
            `Preparing ${st} 3D buildings, drone imagery & wayfinding...`,
            `Launching ${st} Live 3D Map...`
        ]
    }
};

let activeSeq = 0;
let activeCleanupFn = null;

function buildUnfoldMarkup(text) {
    let charIndex = 0;
    const baseDelayMs = 110;
    const stepDelayMs = 22;
    return String(text || '')
        .split(' ')
        .filter(Boolean)
        .map(word => {
            const charsHtml = word
                .split('')
                .map(ch => {
                    const delay = baseDelayMs + (charIndex++ * stepDelayMs);
                    return `<span class="rt-unfold-char" style="animation-delay:${delay}ms">${escapeHtml(ch)}</span>`;
                })
                .join('');
            return `<span class="rt-unfold-word">${charsHtml}</span>`;
        })
        .join('');
}

function getScopeLabel(roleSlug, stationScope, currentStation) {
    if (stationScope === 'all' && roleSlug !== 'visitor') {
        return 'All Stations';
    }
    const targetStation = (stationScope && stationScope !== 'all')
        ? stationScope
        : (currentStation || 'lares');
    return `DA-${String(targetStation).toUpperCase()}`;
}

export function hideRoleTransition(immediate = false) {
    activeSeq += 1;
    if (typeof activeCleanupFn === 'function') {
        try { activeCleanupFn(); } catch (_) {}
        activeCleanupFn = null;
    }
    const overlay = document.getElementById('role-transition-overlay');
    if (!overlay) return;
    if (immediate) {
        overlay.classList.add('rt-no-transition');
        overlay.classList.remove('active', 'leaving');
        overlay.setAttribute('aria-hidden', 'true');
        void overlay.offsetWidth;
        overlay.classList.remove('rt-no-transition');
        return;
    }
    overlay.classList.remove('active');
    overlay.classList.add('leaving');
    setTimeout(() => {
        if (!overlay.classList.contains('active')) {
            overlay.classList.remove('leaving');
            overlay.setAttribute('aria-hidden', 'true');
        }
    }, 340);
}

/**
 * Play the role-themed transition overlay while executing async portal setup work.
 */
export async function runRoleTransition(options = {}) {
    const seq = ++activeSeq;
    if (typeof activeCleanupFn === 'function') {
        try { activeCleanupFn(); } catch (_) {}
        activeCleanupFn = null;
    }

    const {
        role = 'super_admin',
        mode = 'login',
        fullName = '',
        jobTitle = '',
        fromRole = '',
        baseRole = '',
        stationScope = 'all',
        currentStation = 'lares',
        isOverseerMorph = false,
        minDurationMs = 1500,
        keepVisibleOnComplete = false,
        work = null
    } = options;

    const roleSlug = ROLE_TRANSITION_PROFILES[role] ? role : 'super_admin';
    const profile = ROLE_TRANSITION_PROFILES[roleSlug];
    const fromProfile = ROLE_TRANSITION_PROFILES[fromRole] || null;
    const overlay = document.getElementById('role-transition-overlay');

    if (!overlay) {
        if (typeof work === 'function') {
            await work();
        }
        return;
    }

    const scopeLabel = getScopeLabel(roleSlug, stationScope, currentStation);
    const stationContextText = scopeLabel === 'All Stations' ? 'multi-station' : scopeLabel;
    const steps = mode === 'login'
        ? profile.loginSteps(stationContextText)
        : profile.switchSteps(stationContextText);
    const identityLine = [fullName, jobTitle].filter(Boolean).join(' • ');

    const kickerEl = document.getElementById('rt-kicker');
    const roleIconEl = document.getElementById('rt-role-icon');
    const pillTextEl = document.getElementById('rt-role-pill-text');
    const titleEl = document.getElementById('rt-unfold-title');
    const subtitleEl = document.getElementById('rt-subtitle');
    const statusEl = document.getElementById('rt-status-text');
    const percentEl = document.getElementById('rt-percent-text');
    const fillEl = document.getElementById('rt-progress-fill');
    const skipHintEl = document.getElementById('rt-skip-hint');

    overlay.dataset.role = roleSlug;
    if (roleIconEl) roleIconEl.innerHTML = profile.iconSvg;

    if (kickerEl) {
        if (mode === 'login') {
            kickerEl.textContent = identityLine || 'Signing in to iGUIDE Portal';
        } else if (mode === 'return') {
            kickerEl.textContent = identityLine || 'Super Admin';
        } else {
            kickerEl.textContent = `${identityLine || 'Super Admin'}${baseRole === 'super_admin' ? ' (Super Admin)' : ''}`;
        }
    }

    if (pillTextEl) {
        if (mode === 'switch') {
            pillTextEl.textContent = fromProfile
                ? `SWITCHING: ${fromProfile.badgeTag} → ${profile.badgeTag}`
                : `SWITCHING TO ${profile.badgeTag} • ${scopeLabel}`;
        } else if (mode === 'return') {
            pillTextEl.textContent = fromProfile
                ? `RESTORING: ${fromProfile.badgeTag} → SUPER ADMIN`
                : 'RESTORING SUPER ADMIN OVERSEER';
        } else {
            pillTextEl.textContent = `${profile.badgeTag} • ${scopeLabel}`;
        }
    }

    if (titleEl) {
        titleEl.setAttribute('aria-label', profile.title);
        titleEl.innerHTML = buildUnfoldMarkup(profile.title);
    }

    if (subtitleEl) {
        const baseSub = mode === 'login' ? profile.loginSubtitle : profile.switchSubtitle;
        const suffix = (isOverseerMorph && (roleSlug === 'gis_editor' || roleSlug === 'reviewer'))
            ? ' (All Stations Unlocked)'
            : '';
        subtitleEl.textContent = `${baseSub}${suffix}`;
    }

    if (fillEl) fillEl.style.width = '0%';
    if (percentEl) percentEl.textContent = '0%';
    if (statusEl) statusEl.textContent = steps[0];
    if (skipHintEl) {
        skipHintEl.style.display = keepVisibleOnComplete ? 'none' : '';
        skipHintEl.style.opacity = '0';
    }

    overlay.classList.remove('leaving', 'rt-no-transition');
    overlay.setAttribute('aria-hidden', 'false');
    void overlay.offsetWidth;
    overlay.classList.add('active');

    let workDone = false;
    let workError = null;
    let skipRequested = false;
    let rafId = 0;
    let progressIntervalId = 0;
    let failsafeTimer = 0;

    const cleanup = () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (progressIntervalId) clearInterval(progressIntervalId);
        if (failsafeTimer) clearTimeout(failsafeTimer);
        overlay.removeEventListener('click', onSkipRequest);
        window.removeEventListener('keydown', onKeyDown);
    };
    const onSkipRequest = () => {
        if (!keepVisibleOnComplete) {
            skipRequested = true;
        }
    };
    const onKeyDown = (e) => {
        if (e.key === 'Escape' && !keepVisibleOnComplete) {
            skipRequested = true;
        }
    };

    overlay.addEventListener('click', onSkipRequest);
    window.addEventListener('keydown', onKeyDown);
    activeCleanupFn = cleanup;

    const workPromise = typeof work === 'function'
        ? Promise.resolve().then(() => work())
        : Promise.resolve();

    workPromise.then(
        () => {
            workDone = true;
            if (skipHintEl && !keepVisibleOnComplete) {
                skipHintEl.style.opacity = '1';
            }
        },
        (err) => {
            workError = err || new Error('Transition task failed');
            workDone = true;
        }
    );

    const startTime = performance.now();
    const hardTimeoutMs = Math.max(minDurationMs + 3000, 5000);

    await new Promise((resolve, reject) => {
        let finished = false;
        const finishError = (err) => {
            if (finished) return;
            finished = true;
            cleanup();
            if (activeSeq === seq) {
                activeCleanupFn = null;
                hideRoleTransition(true);
            }
            reject(err);
        };

        const finishSuccess = () => {
            if (finished) return;
            finished = true;
            cleanup();
            if (activeSeq !== seq) {
                resolve();
                return;
            }
            activeCleanupFn = null;
            if (fillEl) fillEl.style.width = '100%';
            if (percentEl) percentEl.textContent = '100%';
            if (statusEl) statusEl.textContent = steps[2];

            const holdMs = skipRequested ? 90 : (keepVisibleOnComplete ? 180 : 240);
            setTimeout(() => {
                if (activeSeq !== seq) {
                    resolve();
                    return;
                }
                if (keepVisibleOnComplete) {
                    resolve();
                    return;
                }
                overlay.classList.remove('active');
                overlay.classList.add('leaving');
                setTimeout(() => {
                    if (activeSeq === seq) {
                        overlay.classList.remove('leaving');
                        overlay.setAttribute('aria-hidden', 'true');
                    }
                    resolve();
                }, 340);
            }, holdMs);
        };

        failsafeTimer = setTimeout(() => {
            if (workError) {
                finishError(workError);
            } else {
                finishSuccess();
            }
        }, hardTimeoutMs);

        const tick = (scheduleNext = true) => {
            if (finished || activeSeq !== seq) {
                cleanup();
                if (!finished) resolve();
                return;
            }
            if (workError) {
                finishError(workError);
                return;
            }

            const elapsed = Math.max(0, performance.now() - startTime);
            const rawRatio = Math.min(1, elapsed / Math.max(1, minDurationMs));
            const easedRatio = 1 - Math.pow(1 - rawRatio, 3);
            let pct = Math.round(easedRatio * 86);

            if (!workDone && elapsed >= minDurationMs) {
                const extra = Math.min(6, Math.round(((elapsed - minDurationMs) / 1500) * 6));
                pct = Math.min(92, 86 + extra);
            }

            if (fillEl) fillEl.style.width = `${pct}%`;
            if (percentEl) percentEl.textContent = `${pct}%`;
            if (statusEl) {
                statusEl.textContent = pct < 38 ? steps[0] : steps[1];
            }

            if (workDone && (elapsed >= minDurationMs || skipRequested)) {
                finishSuccess();
                return;
            }

            if (scheduleNext) {
                rafId = requestAnimationFrame(() => tick(true));
            }
        };

        progressIntervalId = setInterval(() => tick(false), 60);
        rafId = requestAnimationFrame(() => tick(true));
    });
}

