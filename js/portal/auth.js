/**
 * Canonical /login Gate, Intro Splash, Sign-In/Sign-Up/Forgot-Password,
 * Exact FarmVault Password Rules & Segmented 6-Box OTP Engine
 */

import { PortalState, ROLE_META, showToast, syncPortalPrefToServer, hydratePortalPrefsFromServer } from './core.js';
import { guardAsyncAction } from '../ui-guard.js';

const REMEMBER_EMAIL_KEY = 'iguide_remember_email';
const REMEMBER_ME_KEY = 'iguide_remember_me';
const LOGIN_THEME_KEY = 'iguide_login_theme';
let pendingOtpToken = '';
let pendingResetToken = '';
let resendTimer = null;
let idleLogoutTimer = null;
let onAuthenticatedHook = null;

function getUserThemeStorageKey(email) {
    const clean = String(email || '').trim().toLowerCase();
    return clean ? `iguide_theme_${clean}` : '';
}

export function resolveSavedPortalTheme(email = '') {
    try {
        const userKey = getUserThemeStorageKey(email || PortalState.email || localStorage.getItem(REMEMBER_EMAIL_KEY) || '');
        if (userKey) {
            const perUser = localStorage.getItem(userKey);
            if (perUser === 'light' || perUser === 'dark') return perUser;
        }
        const globalTheme = localStorage.getItem(LOGIN_THEME_KEY);
        if (globalTheme === 'light' || globalTheme === 'dark') return globalTheme;
    } catch (_) {}
    return 'dark';
}

export function applyPortalTheme(mode, persist = false) {
    const isLight = mode === 'light';
    const normalized = isLight ? 'light' : 'dark';
    delete document.body.dataset.loginTheme;
    document.body.dataset.theme = normalized;
    const themeBtns = [
        document.getElementById('portal-theme-toggle-btn')
    ].filter(Boolean);
    themeBtns.forEach(btn => {
        const sun = btn.querySelector('.theme-icon-sun');
        const moon = btn.querySelector('.theme-icon-moon');
        if (sun) sun.style.display = isLight ? 'none' : '';
        if (moon) moon.style.display = isLight ? '' : 'none';
        btn.title = isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode';
    });
    if (persist) {
        try {
            localStorage.setItem(LOGIN_THEME_KEY, normalized);
            const activeEmail = PortalState.email || document.getElementById('login-user')?.value.trim() || localStorage.getItem(REMEMBER_EMAIL_KEY) || '';
            const userKey = getUserThemeStorageKey(activeEmail);
            if (userKey) localStorage.setItem(userKey, normalized);
            syncPortalPrefToServer(LOGIN_THEME_KEY, normalized);
        } catch (_) {}
    }
}

/**
 * Exact 4 FarmVault unique-password rules (no false highlights on symbols outside @$!%*?&)
 */
export function evaluatePasswordRules(pw) {
    const val = String(pw || '');
    const checks = {
        minLength: val.length >= 10,
        uppercase: /[A-Z]/.test(val),
        number: /[0-9]/.test(val),
        special: /[@$!%*?&]/.test(val)
    };
    const metCount = Object.values(checks).filter(Boolean).length;
    return { checks, metCount, allValid: metCount === 4 && !/\s/.test(val) };
}

function setBtnLoading(btn, loading, loadingLabel, idleHtml) {
    if (!btn) return;
    if (loading) {
        if (!btn.dataset.idleHtml) btn.dataset.idleHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="btn-spinner"></span><span>${loadingLabel}</span>`;
    } else {
        btn.disabled = false;
        btn.innerHTML = idleHtml || btn.dataset.idleHtml || btn.innerHTML;
    }
}

function showBanner(elId, type, msg) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!msg) {
        el.className = 'auth-status-banner';
        el.textContent = '';
        return;
    }
    el.className = `auth-status-banner ${type} visible`;
    el.innerHTML = `<span>${msg}</span>`;
}

export function switchAuthView(viewName) {
    const card = document.getElementById('auth-card-container');
    const views = ['signin', 'signup', 'forgot', 'otp', 'pending'];
    views.forEach(v => {
        const el = document.getElementById(`auth-view-${v}`);
        if (!el) return;
        if (v === viewName) {
            el.hidden = false;
            el.style.animation = 'none';
            void el.offsetWidth;
            el.style.animation = '';
        } else {
            el.hidden = true;
        }
    });
    if (card) {
        card.classList.toggle('is-signup', viewName === 'signup');
    }
    ['signin-banner', 'signup-banner', 'forgot-banner', 'otp-banner'].forEach(id => showBanner(id, 'error', ''));
    // Reset any revealed password fields and eye icons when switching views
    const resetEyeSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    document.querySelectorAll('[data-toggle-pw]').forEach(btn => {
        const inp = document.getElementById(btn.dataset.togglePw);
        if (inp) inp.type = 'password';
        btn.innerHTML = resetEyeSvg;
        btn.classList.remove('is-revealed');
        btn.setAttribute('title', 'Show Password');
        btn.setAttribute('aria-label', 'Show Password');
    });
}

function bindPasswordFieldEnhancements(inputId, capsPillId) {
    const input = document.getElementById(inputId);
    const caps = document.getElementById(capsPillId);
    if (!input) return;

    input.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
            e.preventDefault();
        }
        if (caps && e.getModifierState) {
            caps.classList.toggle('visible', e.getModifierState('CapsLock'));
        }
    });
    input.addEventListener('keyup', (e) => {
        if (caps && e.getModifierState) {
            caps.classList.toggle('visible', e.getModifierState('CapsLock'));
        }
    });
    input.addEventListener('blur', () => {
        if (caps) caps.classList.remove('visible');
    });
    input.addEventListener('input', () => {
        if (/\s/.test(input.value)) {
            input.value = input.value.replace(/\s+/g, '');
        }
    });
}

function bindPasswordChecklist({ pwId, confirmId, drawerId, prefix, matchHintId, pwHintId, identityGetter, onValidityChange }) {
    const pwEl = document.getElementById(pwId);
    const cfEl = document.getElementById(confirmId);
    const drawer = document.getElementById(drawerId);
    const matchHint = document.getElementById(matchHintId);
    const pwHint = pwHintId ? document.getElementById(pwHintId) : null;
    if (!pwEl || !drawer) return () => ({ valid: false });

    function update() {
        const pw = pwEl.value || '';
        const cf = cfEl ? (cfEl.value || '') : '';
        const { checks, metCount, allValid } = evaluatePasswordRules(pw);

        drawer.classList.toggle('open', pw.length > 0 || document.activeElement === pwEl);
        const tierClass = metCount <= 1 ? 'tier-weak' : (metCount <= 3 ? 'tier-mid' : 'tier-strong');

        for (let i = 1; i <= 4; i++) {
            const bar = document.getElementById(`${prefix}-bar-${i}`);
            if (!bar) continue;
            bar.className = 'pw-bar-seg';
            if (i <= metCount) bar.classList.add(tierClass);
        }

        ['minLength', 'uppercase', 'number', 'special'].forEach(rule => {
            const item = document.getElementById(`${prefix}-rule-${rule}`);
            if (!item) return;
            item.classList.toggle('met', Boolean(checks[rule]));
        });

        let identityConflict = '';
        if (pw.length > 0 && typeof identityGetter === 'function') {
            const { email = '', firstName = '', lastName = '' } = identityGetter() || {};
            const lowerPw = pw.toLowerCase();
            const localPart = String(email).split('@')[0].trim().toLowerCase();
            const fn = String(firstName).trim().toLowerCase();
            const ln = String(lastName).trim().toLowerCase();
            if (localPart.length >= 4 && lowerPw.includes(localPart)) {
                identityConflict = '! Password cannot contain your email';
            } else if ((fn.length >= 3 && lowerPw.includes(fn)) || (ln.length >= 3 && lowerPw.includes(ln))) {
                identityConflict = '! Password cannot include your name';
            }
        }
        if (pwHint) {
            if (identityConflict) {
                pwHint.className = 'field-status-hint err';
                pwHint.textContent = identityConflict;
            } else {
                pwHint.className = 'field-status-hint';
                pwHint.textContent = '';
            }
        }

        const matches = cf.length > 0 && pw === cf;
        if (matchHint) {
            if (!cf.length) {
                matchHint.className = 'field-status-hint';
                matchHint.textContent = '';
            } else if (matches) {
                matchHint.className = 'field-status-hint ok';
                matchHint.textContent = '✓ Passwords Match';
            } else {
                matchHint.className = 'field-status-hint err';
                matchHint.textContent = '! Passwords do not match';
            }
        }
        const valid = allValid && matches && !identityConflict;
        if (typeof onValidityChange === 'function') onValidityChange(valid);
        return { valid };
    }

    pwEl.addEventListener('focus', () => drawer.classList.add('open'));
    pwEl.addEventListener('input', update);
    cfEl?.addEventListener('input', update);
    return update;
}

function bindSegmentedOtp(containerId, onComplete, onChange = null) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return { getValue: () => '', clear: () => {}, focusFirst: () => {} };
    const boxes = Array.from(wrap.querySelectorAll('.otp-digit-box'));

    const getValue = () => boxes.map(b => b.value.trim()).join('');

    const syncFilled = () => {
        boxes.forEach(b => b.classList.toggle('filled', b.value.length === 1));
        if (typeof onChange === 'function') onChange(getValue());
    };

    boxes.forEach((box, idx) => {
        box.addEventListener('input', (e) => {
            const cleaned = e.target.value.replace(/\D/g, '');
            if (cleaned.length > 1) {
                // Handle paste or autofill into a single box
                cleaned.slice(0, 6).split('').forEach((ch, off) => {
                    if (boxes[idx + off]) boxes[idx + off].value = ch;
                });
                const nextIdx = Math.min(5, idx + cleaned.length);
                boxes[nextIdx].focus();
            } else {
                box.value = cleaned;
                if (cleaned && idx < 5) boxes[idx + 1].focus();
            }
            syncFilled();
            const full = getValue();
            if (full.length === 6 && typeof onComplete === 'function') {
                onComplete(full);
            }
        });

        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && idx > 0) {
                boxes[idx - 1].value = '';
                boxes[idx - 1].focus();
                syncFilled();
            } else if (e.key === 'ArrowLeft' && idx > 0) {
                boxes[idx - 1].focus();
            } else if (e.key === 'ArrowRight' && idx < 5) {
                boxes[idx + 1].focus();
            }
        });

        box.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
            if (!pasted) return;
            pasted.split('').forEach((ch, i) => {
                if (boxes[i]) boxes[i].value = ch;
            });
            boxes[Math.min(5, pasted.length - 1)].focus();
            syncFilled();
            if (pasted.length === 6 && typeof onComplete === 'function') {
                onComplete(pasted);
            }
        });
    });

    return {
        getValue,
        clear() {
            boxes.forEach(b => { b.value = ''; b.classList.remove('filled'); });
            if (typeof onChange === 'function') onChange('');
        },
        focusFirst() {
            boxes[0]?.focus();
        }
    };
}

function startResendCooldown(btnId, seconds = 60) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    clearInterval(resendTimer);
    let rem = seconds;
    btn.disabled = true;
    btn.textContent = `Resend in ${rem}s`;
    resendTimer = setInterval(() => {
        rem -= 1;
        if (rem <= 0) {
            clearInterval(resendTimer);
            btn.disabled = false;
            btn.textContent = 'Resend Code';
        } else {
            btn.textContent = `Resend in ${rem}s`;
        }
    }, 1000);
}

export function resetIdleLogoutTimer() {
    if (idleLogoutTimer) clearTimeout(idleLogoutTimer);
    if (!PortalState.token) return;
    idleLogoutTimer = setTimeout(() => {
        if (PortalState.token) {
            showToast('Session timed out after 15 minutes of inactivity.');
            logoutPortal();
        }
    }, 15 * 60 * 1000);
}

export async function logoutPortal() {
    if (idleLogoutTimer) clearTimeout(idleLogoutTimer);
    const tok = PortalState.token;
    PortalState.token = '';
    try { sessionStorage.removeItem('da_admin_token'); } catch (_) {}
    try { localStorage.removeItem('da_admin_token'); } catch (_) {}
    if (tok) {
        try {
            await fetch('/api/admin/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Token': tok },
                body: JSON.stringify({ token: tok })
            });
        } catch (_) {}
    }
    pendingOtpToken = '';
    const passEl = document.getElementById('login-pass');
    if (passEl) passEl.value = '';
    const userEl = document.getElementById('login-user');
    const remEl = document.getElementById('remember-email-check');
    const savedEmail = (() => { try { return localStorage.getItem(REMEMBER_EMAIL_KEY) || ''; } catch (_) { return ''; } })();
    if (savedEmail && userEl) {
        userEl.value = savedEmail;
        if (remEl) remEl.checked = true;
    }
    switchAuthView('signin');
    applyPortalTheme(resolveSavedPortalTheme(savedEmail), false);
    const ov = document.getElementById('login-overlay');
    if (ov) ov.style.display = 'flex';
}

function startHeroTypewriter() {
    const target = document.getElementById('login-typewriter-text');
    if (!target) return;
    const phrases = [
        'Unified 3D Geospatial Directory across DA-CALABARZON Stations',
        'Station-Locked GIS Governance & Role-Based Workflows',
        'Zero-Reload Spatial Publishing with 2-Step Gmail OTP'
    ];
    let pIdx = 0;
    let cIdx = 0;
    let deleting = false;

    function tick() {
        const current = phrases[pIdx];
        if (!deleting) {
            cIdx++;
            target.textContent = current.slice(0, cIdx);
            if (cIdx >= current.length) {
                deleting = true;
                setTimeout(tick, 2200);
                return;
            }
            setTimeout(tick, 38);
        } else {
            cIdx--;
            target.textContent = current.slice(0, cIdx);
            if (cIdx <= 0) {
                deleting = false;
                pIdx = (pIdx + 1) % phrases.length;
                setTimeout(tick, 320);
                return;
            }
            setTimeout(tick, 20);
        }
    }
    tick();
}

function runIntroSplashAnimation() {
    const splashEl = document.getElementById('admin-splash-screen');
    const splitEl = document.getElementById('login-split-wrapper');
    const splashSubEl = splashEl?.querySelector('.admin-splash-sub');

    const isReturningFromVisitor = Boolean(sessionStorage.getItem('da_admin_token'))
        && new URLSearchParams(window.location.search).get('from_preview') === 'visitor';
    if (isReturningFromVisitor) {
        splashEl?.classList.add('hidden');
        splitEl?.classList.add('visible');
        return;
    }

    if (splashSubEl) {
        const text = 'Interactive Geospatial Unified Information Directory and Explorer';
        let charIdx = 0;
        splashSubEl.innerHTML = text.split(' ').map(word => {
            const chars = word.split('').map(ch => {
                const delay = 420 + (charIdx++ * 22);
                return `<span class="unfold-char" style="animation-delay:${delay}ms">${ch}</span>`;
            }).join('');
            return `<span class="unfold-word">${chars}</span>`;
        }).join('');
    }

    let revealed = false;
    const revealSplit = () => {
        if (revealed) return;
        revealed = true;
        splashEl?.classList.add('hidden');
        setTimeout(() => {
            splitEl?.classList.add('visible');
            const wm = document.getElementById('login-brand-wordmark');
            if (wm) wm.src = '/Main Icon/iGUIDE_Wordmark_Botanical_Animated.svg?t=' + Date.now();
        }, 380);
    };

    // Allow impatient users to click splash to enter right after logo renders
    splashEl?.addEventListener('click', revealSplit);
    setTimeout(revealSplit, 3400);
}

export function initAuthModule(onAuthenticated) {
    onAuthenticatedHook = onAuthenticated;

    // Light / Dark Mode Toggle (inside the authenticated Portal topbar next to notification bell, persisted per-user & globally)
    const themeBtns = [
        document.getElementById('portal-theme-toggle-btn')
    ].filter(Boolean);
    applyPortalTheme(resolveSavedPortalTheme(), false);
    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const next = document.body.dataset.theme === 'light' ? 'dark' : 'light';
            applyPortalTheme(next, true);
        });
    });

    runIntroSplashAnimation();
    startHeroTypewriter();

    // Restore Remember Me (email + checkbox state) cleanly
    const loginUserEl = document.getElementById('login-user');
    const rememberCheckEl = document.getElementById('remember-email-check');
    const savedEmail = (() => { try { return localStorage.getItem(REMEMBER_EMAIL_KEY) || ''; } catch (_) { return ''; } })();
    const savedRemember = (() => { try { return localStorage.getItem(REMEMBER_ME_KEY) === '1'; } catch (_) { return false; } })();
    if (savedEmail && loginUserEl) {
        loginUserEl.value = savedEmail;
    }
    if (rememberCheckEl && (savedRemember || Boolean(savedEmail))) {
        rememberCheckEl.checked = true;
    }
    rememberCheckEl?.addEventListener('change', () => {
        try {
            if (!rememberCheckEl.checked) {
                localStorage.removeItem(REMEMBER_ME_KEY);
                localStorage.removeItem(REMEMBER_EMAIL_KEY);
                localStorage.removeItem('da_admin_token');
            } else {
                localStorage.setItem(REMEMBER_ME_KEY, '1');
                const curEmail = loginUserEl?.value.trim() || '';
                if (curEmail) localStorage.setItem(REMEMBER_EMAIL_KEY, curEmail);
            }
        } catch (_) {}
    });

    // Eye toggles (swap between eye and eye-off SVG icons)
    const EYE_OPEN_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    const EYE_OFF_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>';

    document.querySelectorAll('[data-toggle-pw]').forEach(btn => {
        btn.addEventListener('click', () => {
            const inp = document.getElementById(btn.dataset.togglePw);
            if (!inp) return;
            const revealing = inp.type === 'password';
            inp.type = revealing ? 'text' : 'password';
            btn.innerHTML = revealing ? EYE_OFF_SVG : EYE_OPEN_SVG;
            btn.classList.toggle('is-revealed', revealing);
            btn.setAttribute('title', revealing ? 'Hide Password' : 'Show Password');
            btn.setAttribute('aria-label', revealing ? 'Hide Password' : 'Show Password');
        });
    });

    // View switch links
    document.getElementById('goto-signup-btn')?.addEventListener('click', () => switchAuthView('signup'));
    document.getElementById('goto-forgot-btn')?.addEventListener('click', () => {
        switchAuthView('forgot');
        document.getElementById('forgot-step-email').hidden = false;
        document.getElementById('forgot-step-reset').hidden = true;
    });
    document.querySelectorAll('[data-back-signin]').forEach(btn => {
        btn.addEventListener('click', () => switchAuthView('signin'));
    });

    // Password Caps Lock + space prevention across Sign In / Sign Up / Forgot Reset
    bindPasswordFieldEnhancements('login-pass', 'login-caps-pill');
    bindPasswordFieldEnhancements('su-pass', 'su-caps-pill');
    bindPasswordFieldEnhancements('su-confirm', 'su-caps-pill');
    bindPasswordFieldEnhancements('fp-new-pass', 'fp-caps-pill');
    bindPasswordFieldEnhancements('fp-confirm-pass', 'fp-caps-pill');

    // Sign-Up Email Availability (debounced), Domain Quick-Pills, Cascading Division / Office-Section Comboboxes & Password Checklist
    let emailAvailable = false;
    let emailDebounce = null;
    let suPasswordValid = false;

    const suBtn = document.getElementById('signup-submit-btn');
    const suEmailEl = document.getElementById('su-email');
    const suEmailHint = document.getElementById('su-email-hint');

    const DA_DIVISIONS_CATALOG = [
        {
            division: 'Office of the Regional Executive Director',
            offices: []
        },
        {
            division: 'RTD Research, Regulations and ILD - Regional Technical Director for Research, Regulations and Integrated Laboratories Division',
            offices: []
        },
        {
            division: 'RTD Operations - Regional Technical Director for Operations',
            offices: []
        },
        {
            division: 'AFD - Admin and Finance Division',
            offices: [
                'Admin - Admin',
                'Personnel - Personnel',
                'Accounting - Accounting',
                'Budget - Budget',
                'BAC - Bids and Awards Committee',
                'General Services - General Services',
                'RAFIS - Regional Agriculture and Fisheries Information Section',
                'Records - Records',
                'Property - Property',
                'Cashier - Cashier',
                'Motorpool - Motorpool'
            ]
        },
        {
            division: 'PMED - Planning, Monitoring, and Evaluation Division',
            offices: [
                'MIS - Management Information Systems Unit',
                'MNE - Monitoring and Evaluation Section',
                'Planning and Programming Section'
            ]
        },
        {
            division: 'FOD - Field Operation Division',
            offices: [
                'Rice - Rice Program',
                'Corn - Corn Program',
                'Livestock - Livestock Program',
                'Organic - Organic Agriculture Program',
                'Halal - Halal Food Industry Development Program',
                'HVCDP - High Value Crops Development Program',
                'NUPAP - National Urban and Peri-Urban Agriculture Program',
                'APCO Batangas - APCO Batangas',
                'APCO Cavite - APCO Cavite',
                'APCO Laguna - APCO Laguna',
                'APCO Rizal - APCO Rizal',
                'APCO Quezon - APCO Quezon'
            ]
        },
        {
            division: 'RAED - Regional Agricultural Engineering Division',
            offices: [
                'PPMS - Programs and Projects Management Section',
                'EPDSS - Engineering Plans, Designs and Specifications Section',
                'SRES - Standards, Regulations and Enforcement Section',
                'SEPPS - Special Engineering Programs and Projects Section'
            ]
        },
        {
            division: 'AMAD - Agribusiness and Marketing Assistance Division',
            offices: []
        },
        {
            division: 'Research - Research Division',
            offices: [
                'RND - Research and Development',
                'CARES - CARES',
                'LARES - LARES',
                'RARES - RARES',
                'QARES - QARES'
            ]
        },
        {
            division: 'Regulatory - Regulatory Division',
            offices: []
        },
        {
            division: 'ILD - Integrated Laboratory Division',
            offices: [
                'ILD - Integrated Laboratory Division',
                'RSL - Regional Soils Laboratory',
                'RADDL - Regional Animal Disease Diagnostic Laboratory',
                'RCPC - Regional Crop Protection Center',
                'RAFL - Regional Animal Feed Laboratory',
                'RAFC - Regional Agricultural and Fishery Council'
            ]
        },
        {
            division: 'LFFAP - Locally Funded and Foreign Assisted Projects',
            offices: [
                '4K - Kabuhayan at Kaunlaran ng Kababayang Katutubo (4Ks) Project',
                'RSBSA - Registry System for Basic Sectors in Agriculture',
                'AMIA - Adaptation and Mitigation Initiative in Agriculture',
                'SAAD - Special Area for Agricultural Development',
                'AFLO/Cold Storage - Agricultural and Fisheries Logistics Office/Cold Storage',
                'Fuel Assistance - Fuel Assistance',
                'YFCF - Young Farmers Challenge Fund',
                'PRDP - Philippine Rural Development Project',
                'F2C2 - Farmer and Fisheries Cluster and Consolidation',
                'ACEDD - Agricultural Cooperative Enterprise Development Services',
                'CSO - Civil Society Organizations',
                'ACEF - Agricultural Competitiveness Enhancement Fund',
                'GAD - Gender and Development',
                'AMAD-DAP - Agribusiness and Marketing Assistance Division - Digital Agriculture Project',
                'Sagip Saka - Sagip Saka Program',
                'DRRM - Disaster Risk Reduction and Management',
                'FMR - Farm-to-Market Road',
                'NSHP - National Soil Health Program'
            ]
        }
    ];

    const formatOptionHtml = (str) => {
        const s = String(str || '');
        const idx = s.indexOf(' - ');
        if (idx > 0) {
            const code = s.slice(0, idx);
            const title = s.slice(idx + 3);
            return `<span class="opt-code">${code} - </span><span class="opt-title">${title}</span>`;
        }
        return `<span class="opt-title">${s}</span>`;
    };

    const updateSignupButtonState = () => {
        const first = document.getElementById('su-first')?.value.trim();
        const last = document.getElementById('su-last')?.value.trim();
        const position = document.getElementById('su-position')?.value.trim();
        const division = document.getElementById('su-division')?.value.trim();
        const office = document.getElementById('su-office')?.value.trim();
        const ready = Boolean(first && last && position && division && office && emailAvailable && suPasswordValid);
        if (suBtn) suBtn.disabled = !ready;
    };

    ['su-first', 'su-last', 'su-position'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateSignupButtonState);
    });

    // Quick email domain chips (@gmail.com, @calabarzon.da.gov.ph)
    document.querySelectorAll('[data-email-domain]').forEach(chip => {
        chip.addEventListener('click', () => {
            if (!suEmailEl) return;
            const domain = chip.dataset.emailDomain || '@gmail.com';
            const raw = suEmailEl.value.trim();
            const localPart = raw.includes('@') ? raw.split('@')[0] : raw;
            suEmailEl.value = (localPart || 'username') + domain;
            suEmailEl.focus();
            if (!localPart) {
                suEmailEl.setSelectionRange(0, 8);
            }
            suEmailEl.dispatchEvent(new Event('input', { bubbles: true }));
        });
    });

    // Searchable Cascading Division & Office / Section Comboboxes
    const divInput = document.getElementById('su-division');
    const divTrigger = document.getElementById('su-division-trigger');
    const divLabel = document.getElementById('su-division-label');
    const divMenu = document.getElementById('su-division-menu');
    const divSearch = document.getElementById('su-division-search');
    const divList = document.getElementById('su-division-list');

    const ofcInput = document.getElementById('su-office');
    const ofcTrigger = document.getElementById('su-office-trigger');
    const ofcLabel = document.getElementById('su-office-label');
    const ofcMenu = document.getElementById('su-office-menu');
    const ofcSearch = document.getElementById('su-office-search');
    const ofcList = document.getElementById('su-office-list');
    const stInput = document.getElementById('su-station');

    let activeDivisionObj = null;

    const closeAllSignupCombos = () => {
        divMenu?.classList.remove('open');
        divTrigger?.classList.remove('open');
        divTrigger?.setAttribute('aria-expanded', 'false');
        ofcMenu?.classList.remove('open');
        ofcTrigger?.classList.remove('open');
        ofcTrigger?.setAttribute('aria-expanded', 'false');
    };

    const renderOfficeOptions = (queryText = '') => {
        if (!ofcList) return;
        const offices = activeDivisionObj ? activeDivisionObj.offices : [];
        const q = queryText.trim().toLowerCase();
        const filtered = offices.filter(o => !q || o.toLowerCase().includes(q));
        if (!filtered.length) {
            ofcList.innerHTML = `<div class="iguide-combo-empty">No matching office or section.</div>`;
            return;
        }
        ofcList.innerHTML = filtered.map(o => `
            <button type="button" class="iguide-combo-option ${ofcInput?.value === o ? 'selected' : ''}" data-office-val="${o.replace(/"/g, '&quot;')}">
                ${formatOptionHtml(o)}
            </button>
        `).join('');
        ofcList.querySelectorAll('[data-office-val]').forEach(btn => {
            btn.addEventListener('click', () => {
                const chosen = btn.dataset.officeVal;
                if (ofcInput) ofcInput.value = chosen;
                if (ofcLabel) {
                    ofcLabel.textContent = chosen;
                    ofcLabel.classList.remove('placeholder');
                }
                // Auto-infer research station if selecting CARES / LARES / RARES / QARES
                const upper = chosen.toUpperCase();
                if (stInput) {
                    if (upper.startsWith('CARES')) stInput.value = 'cares';
                    else if (upper.startsWith('QARES')) stInput.value = 'qares';
                    else if (upper.startsWith('RARES')) stInput.value = 'rares';
                    else if (upper.startsWith('LARES')) stInput.value = 'lares';
                }
                closeAllSignupCombos();
                updateSignupButtonState();
            });
        });
    };

    const renderDivisionOptions = (queryText = '') => {
        if (!divList) return;
        const q = queryText.trim().toLowerCase();
        const filtered = DA_DIVISIONS_CATALOG.filter(d => !q || d.division.toLowerCase().includes(q));
        if (!filtered.length) {
            divList.innerHTML = `<div class="iguide-combo-empty">No matching division.</div>`;
            return;
        }
        divList.innerHTML = filtered.map(d => `
            <button type="button" class="iguide-combo-option ${divInput?.value === d.division ? 'selected' : ''}" data-div-val="${d.division.replace(/"/g, '&quot;')}">
                ${formatOptionHtml(d.division)}
            </button>
        `).join('');
        divList.querySelectorAll('[data-div-val]').forEach(btn => {
            btn.addEventListener('click', () => {
                const chosenDiv = btn.dataset.divVal;
                activeDivisionObj = DA_DIVISIONS_CATALOG.find(d => d.division === chosenDiv) || null;
                if (divInput) divInput.value = chosenDiv;
                if (divLabel) {
                    divLabel.textContent = chosenDiv;
                    divLabel.classList.remove('placeholder');
                }

                // Configure cascading Office / Section combobox
                if (activeDivisionObj && activeDivisionObj.offices.length === 0) {
                    if (ofcInput) ofcInput.value = 'None';
                    if (ofcLabel) {
                        ofcLabel.textContent = 'None (Direct under Division)';
                        ofcLabel.classList.remove('placeholder');
                    }
                    if (ofcTrigger) ofcTrigger.disabled = true;
                } else {
                    if (ofcInput) ofcInput.value = '';
                    if (ofcLabel) {
                        ofcLabel.textContent = 'Select Office';
                        ofcLabel.classList.add('placeholder');
                    }
                    if (ofcTrigger) ofcTrigger.disabled = false;
                    if (ofcSearch) ofcSearch.value = '';
                    renderOfficeOptions('');
                }
                closeAllSignupCombos();
                updateSignupButtonState();
            });
        });
    };

    renderDivisionOptions('');

    divTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = !divMenu?.classList.contains('open');
        closeAllSignupCombos();
        if (willOpen && divMenu) {
            divMenu.classList.add('open');
            divTrigger.classList.add('open');
            divTrigger.setAttribute('aria-expanded', 'true');
            if (divSearch) {
                divSearch.value = '';
                renderDivisionOptions('');
                setTimeout(() => divSearch.focus(), 40);
            }
        }
    });

    ofcTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (ofcTrigger.disabled) return;
        const willOpen = !ofcMenu?.classList.contains('open');
        closeAllSignupCombos();
        if (willOpen && ofcMenu) {
            ofcMenu.classList.add('open');
            ofcTrigger.classList.add('open');
            ofcTrigger.setAttribute('aria-expanded', 'true');
            if (ofcSearch) {
                ofcSearch.value = '';
                renderOfficeOptions('');
                setTimeout(() => ofcSearch.focus(), 40);
            }
        }
    });

    divSearch?.addEventListener('input', (e) => renderDivisionOptions(e.target.value));
    ofcSearch?.addEventListener('input', (e) => renderOfficeOptions(e.target.value));
    divMenu?.addEventListener('click', (e) => e.stopPropagation());
    ofcMenu?.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', closeAllSignupCombos);

    suEmailEl?.addEventListener('input', () => {
        const val = suEmailEl.value.trim().toLowerCase();
        emailAvailable = false;
        updateSignupButtonState();
        clearTimeout(emailDebounce);
        if (!val) {
            suEmailHint.className = 'field-status-hint';
            suEmailHint.textContent = '';
            return;
        }
        suEmailHint.className = 'field-status-hint muted';
        suEmailHint.textContent = 'Checking availability...';
        emailDebounce = setTimeout(async () => {
            try {
                const res = await fetch('/api/auth/check-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: val })
                });
                const data = await res.json();
                if (!data.valid) {
                    emailAvailable = false;
                    suEmailHint.className = 'field-status-hint err';
                    suEmailHint.textContent = '! Enter a valid email address';
                } else if (!data.available) {
                    emailAvailable = false;
                    suEmailHint.className = 'field-status-hint err';
                    suEmailHint.textContent = '! Email is already registered';
                } else {
                    emailAvailable = true;
                    suEmailHint.className = 'field-status-hint ok';
                    suEmailHint.textContent = '✓ Email is available';
                }
            } catch (_) {
                emailAvailable = false;
                suEmailHint.textContent = '';
            }
            updateSignupButtonState();
        }, 360);
    });

    const refreshSuChecklist = bindPasswordChecklist({
        pwId: 'su-pass',
        confirmId: 'su-confirm',
        drawerId: 'signup-pw-checklist',
        prefix: 'su',
        matchHintId: 'su-match-hint',
        pwHintId: 'su-pw-hint',
        identityGetter: () => ({
            email: suEmailEl?.value || '',
            firstName: document.getElementById('su-first')?.value || '',
            lastName: document.getElementById('su-last')?.value || ''
        }),
        onValidityChange: (valid) => {
            suPasswordValid = valid;
            updateSignupButtonState();
        }
    });
    ['su-first', 'su-last', 'su-email'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            if ((document.getElementById('su-pass')?.value || '').length > 0) refreshSuChecklist();
        });
    });

    let fpPasswordValid = false;
    const fpResetBtn = document.getElementById('fp-reset-submit-btn');
    bindPasswordChecklist({
        pwId: 'fp-new-pass',
        confirmId: 'fp-confirm-pass',
        drawerId: 'fp-pw-checklist',
        prefix: 'fp',
        matchHintId: 'fp-match-hint',
        onValidityChange: (valid) => {
            fpPasswordValid = valid;
            if (fpResetBtn) fpResetBtn.disabled = !(valid && resetOtpControl.getValue().length === 6);
        }
    });

    const loginOtpControl = bindSegmentedOtp('otp-boxes-login', () => {
        document.getElementById('auth-view-otp')?.requestSubmit();
    });
    const resetOtpControl = bindSegmentedOtp('otp-boxes-reset', null, (code) => {
        if (fpResetBtn) fpResetBtn.disabled = !(fpPasswordValid && code.length === 6);
    });

    // 1. Sign-In Submit
    document.getElementById('auth-view-signin')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const card = document.getElementById('auth-card-container');
        const btn = document.getElementById('login-submit-btn');
        await guardAsyncAction(btn, async () => {
            const emailVal = loginUserEl?.value.trim() || '';
            const password = document.getElementById('login-pass')?.value || '';

            if (rememberCheckEl?.checked) {
                try {
                    localStorage.setItem(REMEMBER_ME_KEY, '1');
                    if (emailVal) localStorage.setItem(REMEMBER_EMAIL_KEY, emailVal);
                } catch (_) {}
            } else {
                try {
                    localStorage.removeItem(REMEMBER_ME_KEY);
                    localStorage.removeItem(REMEMBER_EMAIL_KEY);
                    localStorage.removeItem('da_admin_token');
                } catch (_) {}
            }

            showBanner('signin-banner', 'error', '');
            card?.classList.add('card-submitting');
            setBtnLoading(btn, true, 'Signing In...');

            try {
                const res = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailVal, username: emailVal, password })
                });
                const data = await res.json();
                if (!res.ok) {
                    const bannerType = data.approvalStatus === 'pending' ? 'warning' : 'error';
                    showBanner('signin-banner', bannerType, data.error || 'Sign-in failed.');
                    return;
                }
                if (data.step === 'otp') {
                    pendingOtpToken = data.otpToken;
                    loginOtpControl.clear();
                    switchAuthView('otp');
                    const msgEl = document.getElementById('otp-sent-msg');
                    if (msgEl) {
                        msgEl.textContent = data.mailMode === 'gmail'
                            ? `We sent a 6-digit verification code to ${data.maskedEmail}.`
                            : `OTP generated for ${data.maskedEmail} (check server terminal while local).`;
                    }
                    startResendCooldown('otp-resend-btn', 60);
                    setTimeout(() => loginOtpControl.focusFirst(), 80);
                } else if (data.token) {
                    completeAuthSession(data, { animate: true, mode: 'login' });
                }
            } catch (err) {
                showBanner('signin-banner', 'error', err.message || 'Network error while signing in.');
            } finally {
                card?.classList.remove('card-submitting');
                setBtnLoading(btn, false);
            }
        }, { lockKey: 'portal:signin', cooldownMs: 900 });
    });

    // 2. OTP Verify Submit
    document.getElementById('auth-view-otp')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = loginOtpControl.getValue();
        const btn = document.getElementById('otp-submit-btn');
        const card = document.getElementById('auth-card-container');
        showBanner('otp-banner', 'error', '');
        if (code.length !== 6) {
            showBanner('otp-banner', 'error', 'Please enter all 6 digits.');
            return;
        }
        await guardAsyncAction(btn, async () => {
            card?.classList.add('card-submitting');
            setBtnLoading(btn, true, 'Verifying Code...');
            try {
                const res = await fetch('/api/admin/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ otpToken: pendingOtpToken, otp: code })
                });
                const data = await res.json();
                if (!res.ok) {
                    showBanner('otp-banner', 'error', data.error || 'Invalid verification code.');
                    return;
                }
                pendingOtpToken = '';
                completeAuthSession(data, { animate: true, mode: 'login' });
            } catch (err) {
                showBanner('otp-banner', 'error', err.message || 'OTP verification failed.');
            } finally {
                card?.classList.remove('card-submitting');
                setBtnLoading(btn, false);
            }
        }, { lockKey: 'portal:verify-otp', cooldownMs: 800 });
    });

    const resendBtn = document.getElementById('otp-resend-btn');
    resendBtn?.addEventListener('click', async () => {
        await guardAsyncAction(resendBtn, async () => {
            showBanner('otp-banner', 'error', '');
            try {
                const res = await fetch('/api/admin/resend-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ otpToken: pendingOtpToken })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Could not resend OTP');
                pendingOtpToken = data.otpToken;
                startResendCooldown('otp-resend-btn', 60);
                showBanner('otp-banner', 'success', `Fresh 6-digit code sent to ${data.maskedEmail}.`);
            } catch (err) {
                showBanner('otp-banner', 'error', err.message);
            }
        }, { lockKey: 'portal:resend-otp', cooldownMs: 1200 });
    });

    // 3. Sign Up Submit
    document.getElementById('auth-view-signup')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const card = document.getElementById('auth-card-container');
        showBanner('signup-banner', 'error', '');
        card?.classList.add('card-submitting');
        setBtnLoading(suBtn, true, 'Submitting Request...');

        const divisionVal = document.getElementById('su-division')?.value.trim() || '';
        const officeVal = document.getElementById('su-office')?.value.trim() || '';
        const positionVal = document.getElementById('su-position')?.value.trim() || '';
        const combinedOffice = (officeVal && officeVal !== 'None')
            ? `${divisionVal} — ${officeVal}`
            : divisionVal;

        const payload = {
            first_name: document.getElementById('su-first').value.trim(),
            last_name: document.getElementById('su-last').value.trim(),
            position: positionVal,
            division: divisionVal,
            office_section: officeVal,
            email: suEmailEl.value.trim().toLowerCase(),
            station_id: document.getElementById('su-station')?.value || 'lares',
            office_name: combinedOffice,
            responsibilities: positionVal,
            password: document.getElementById('su-pass').value,
            password_confirmation: document.getElementById('su-confirm').value
        };

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) {
                showBanner('signup-banner', 'error', data.error || 'Sign-up failed.');
                return;
            }
            document.getElementById('auth-view-signup').reset();
            if (divInput) divInput.value = '';
            if (ofcInput) ofcInput.value = '';
            activeDivisionObj = null;
            if (divLabel) {
                divLabel.textContent = 'Select Division';
                divLabel.classList.add('placeholder');
            }
            if (ofcLabel) {
                ofcLabel.textContent = 'Select Office';
                ofcLabel.classList.add('placeholder');
            }
            if (ofcTrigger) ofcTrigger.disabled = true;
            document.getElementById('signup-pw-checklist')?.classList.remove('open');
            suEmailHint.textContent = '';
            document.getElementById('pending-confirm-email').textContent = payload.email;
            switchAuthView('pending');
        } catch (err) {
            showBanner('signup-banner', 'error', err.message || 'Sign-up request failed.');
        } finally {
            card?.classList.remove('card-submitting');
            setBtnLoading(suBtn, false);
            updateSignupButtonState();
        }
    });

    // 4. Forgot Password Step A (Send Code) & Step B (Reset Password)
    document.getElementById('forgot-step-email')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('fp-send-btn');
        const emailVal = document.getElementById('fp-email').value.trim().toLowerCase();
        showBanner('forgot-banner', 'error', '');
        setBtnLoading(btn, true, 'Sending Code...');
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailVal })
            });
            const data = await res.json();
            if (!res.ok) {
                showBanner('forgot-banner', 'error', data.error || 'Could not send reset code.');
                return;
            }
            pendingResetToken = data.resetToken;
            resetOtpControl.clear();
            document.getElementById('forgot-step-email').hidden = true;
            document.getElementById('forgot-step-reset').hidden = false;
            showBanner('forgot-banner', 'success', `Reset code dispatched to ${data.maskedEmail}.`);
            setTimeout(() => resetOtpControl.focusFirst(), 80);
        } catch (err) {
            showBanner('forgot-banner', 'error', err.message);
        } finally {
            setBtnLoading(btn, false);
        }
    });

    document.getElementById('forgot-step-reset')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const card = document.getElementById('auth-card-container');
        showBanner('forgot-banner', 'error', '');
        card?.classList.add('card-submitting');
        setBtnLoading(fpResetBtn, true, 'Resetting Password...');
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resetToken: pendingResetToken,
                    otp: resetOtpControl.getValue(),
                    new_password: document.getElementById('fp-new-pass').value,
                    password_confirmation: document.getElementById('fp-confirm-pass').value
                })
            });
            const data = await res.json();
            if (!res.ok) {
                showBanner('forgot-banner', 'error', data.error || 'Password reset failed.');
                return;
            }
            pendingResetToken = '';
            switchAuthView('signin');
            showBanner('signin-banner', 'success', data.message || 'Password updated cleanly! Sign in with your new password.');
        } catch (err) {
            showBanner('forgot-banner', 'error', err.message);
        } finally {
            card?.classList.remove('card-submitting');
            setBtnLoading(fpResetBtn, false);
        }
    });

    ['mousemove', 'keydown', 'click', 'touchstart'].forEach(evt => {
        window.addEventListener(evt, resetIdleLogoutTimer, { passive: true });
    });
}

export function completeAuthSession(data, options = {}) {
    PortalState.token = data.token;
    try { sessionStorage.setItem('da_admin_token', data.token); } catch (_) {}
    try {
        const rememberChecked = document.getElementById('remember-email-check')?.checked || localStorage.getItem(REMEMBER_ME_KEY) === '1';
        if (rememberChecked) {
            localStorage.setItem(REMEMBER_ME_KEY, '1');
            localStorage.setItem('da_admin_token', data.token);
            if (data.email) localStorage.setItem(REMEMBER_EMAIL_KEY, data.email);
        } else {
            localStorage.removeItem('da_admin_token');
        }
    } catch (_) {}

    const roleSlug = data.role || 'super_admin';
    const meta = ROLE_META[roleSlug] || ROLE_META.super_admin;
    PortalState.baseRole = data.baseRole || roleSlug;
    PortalState.effectiveRole = roleSlug;
    PortalState.switchedRole = data.switchedRole || null;
    PortalState.roleName = data.roleName || meta.label;
    PortalState.roleColor = data.roleColor || meta.color;
    PortalState.stationScope = data.stationScope || data.stationId || 'all';
    PortalState.email = data.email || '';
    PortalState.fullName = data.fullName || 'Portal User';
    PortalState.jobTitle = data.jobTitle || '';
    PortalState.officeName = data.officeName || '';
    PortalState.permissions = Array.isArray(data.permissions) ? data.permissions : [];

    if (PortalState.stationScope !== 'all') {
        PortalState.currentStation = PortalState.stationScope;
    }

    if (data.uiPreferences && typeof data.uiPreferences === 'object') {
        hydratePortalPrefsFromServer(data.uiPreferences, PortalState.email);
    }

    // Restore and persist the authenticated user's preferred Light/Dark mode across logins & devices
    const preferredTheme = (() => {
        try {
            const serverTheme = data.uiPreferences && data.uiPreferences[LOGIN_THEME_KEY];
            if (serverTheme === 'light' || serverTheme === 'dark') return serverTheme;
            const userKey = getUserThemeStorageKey(PortalState.email);
            const userSaved = userKey ? localStorage.getItem(userKey) : null;
            if (userSaved === 'light' || userSaved === 'dark') return userSaved;
            const currentDomTheme = document.body.dataset.theme;
            if (currentDomTheme === 'light' || currentDomTheme === 'dark') return currentDomTheme;
            const globalSaved = localStorage.getItem(LOGIN_THEME_KEY);
            if (globalSaved === 'light' || globalSaved === 'dark') return globalSaved;
        } catch (_) {}
        return 'dark';
    })();
    applyPortalTheme(preferredTheme, true);

    if (!options.animate) {
        const ov = document.getElementById('login-overlay');
        if (ov) ov.style.display = 'none';
    }
    resetIdleLogoutTimer();
    if (typeof onAuthenticatedHook === 'function') {
        return onAuthenticatedHook(options);
    }
    return undefined;
}
