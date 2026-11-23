/**
 * Super Admin Live Morphing Role Switcher (Top-Left Overseer Card -> 2x2 Role Grid Modal)
 */

import { PortalState, ROLE_META, apiFetch, showToast } from './core.js';
import { runRoleTransition } from './role-transition.js';

let onRoleChangedHook = null;
let isSwitchingRole = false;

export function openOverseerRoleModal() {
    if (PortalState.baseRole !== 'super_admin') return;
    // Automatically close off-canvas mobile sidebar drawer so the Role Switcher modal is front-and-center on mobile
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
        document.getElementById('portal-sidebar')?.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('open');
    }
    const modal = document.getElementById('overseer-role-modal');
    if (!modal) return;
    const subEl = document.getElementById('overseer-role-modal-sub');
    if (subEl) {
        const fullNameText = PortalState.fullName || 'Super Admin';
        const jobTitleText = PortalState.jobTitle || 'Computer Programmer I';
        subEl.textContent = `${fullNameText} • ${jobTitleText}`;
    }
    modal.querySelectorAll('.overseer-role-tile').forEach(tile => {
        tile.classList.toggle('active', tile.dataset.targetRole === PortalState.effectiveRole);
    });
    modal.style.display = 'flex';
}

export function closeOverseerRoleModal() {
    const modal = document.getElementById('overseer-role-modal');
    if (modal) modal.style.display = 'none';
}

export function syncRoleSwitcherUi() {
    // Keep legacy top-right dropdown hidden — role switching lives in top-left Overseer card
    const legacyWrap = document.getElementById('role-switcher-wrap');
    if (legacyWrap) legacyWrap.style.display = 'none';

    const banner = document.getElementById('role-morph-banner');
    const bannerIdentityEl = document.getElementById('role-morph-identity');
    const bannerRoleName = document.getElementById('role-morph-active-name');
    const sbCard = document.getElementById('sidebar-user-card');
    const footerRoleBar = document.getElementById('sidebar-footer-role-bar');
    const footerRolePill = document.getElementById('sidebar-footer-role-pill');

    const isSuper = PortalState.baseRole === 'super_admin';
    const meta = ROLE_META[PortalState.effectiveRole] || ROLE_META.super_admin;
    const isMorphed = isSuper && PortalState.effectiveRole !== 'super_admin';
    const fullNameText = PortalState.fullName || 'Earth Jeune Layola';
    const jobTitleText = PortalState.jobTitle || 'Computer Programmer I';

    if (sbCard) {
        sbCard.classList.remove('overseer-clickable');
        sbCard.title = '';
        sbCard.querySelector('.overseer-switch-hint')?.remove();
    }

    if (footerRoleBar) {
        footerRoleBar.style.display = isSuper ? 'flex' : 'none';
        footerRoleBar.classList.toggle('is-morphed', isMorphed);
    }
    if (footerRolePill) {
        footerRolePill.textContent = meta.label.replace(' (MIS Supt.)', '');
        footerRolePill.title = isMorphed ? `Viewing as ${meta.label}` : 'Super Admin (All Stations)';
    }

    document.querySelectorAll('.overseer-role-tile').forEach(tile => {
        tile.classList.toggle('active', tile.dataset.targetRole === PortalState.effectiveRole);
    });

    if (banner) {
        banner.classList.toggle('visible', isMorphed);
        if (bannerIdentityEl) bannerIdentityEl.textContent = `Super Admin (${fullNameText} — ${jobTitleText}):`;
        if (bannerRoleName) bannerRoleName.textContent = meta.label;
    }
}

export async function switchSuperAdminRole(targetRole) {
    closeOverseerRoleModal();
    if (isSwitchingRole) return;
    if (!['super_admin', 'administrator', 'gis_editor', 'reviewer'].includes(targetRole)) return;
    if (targetRole === PortalState.effectiveRole) return;

    const fromRole = PortalState.effectiveRole;
    const jobTitleText = PortalState.jobTitle || (PortalState.baseRole === 'super_admin' ? 'Computer Programmer I' : '');

    isSwitchingRole = true;
    try {
        const mode = targetRole === 'super_admin' ? 'return' : 'switch';
        const isOverseerMorph = PortalState.baseRole === 'super_admin' && targetRole !== 'super_admin';
        let switchedRes = null;

        await runRoleTransition({
            role: targetRole,
            mode,
            fromRole,
            baseRole: PortalState.baseRole,
            fullName: PortalState.fullName,
            jobTitle: jobTitleText,
            stationScope: 'all',
            currentStation: PortalState.currentStation,
            isOverseerMorph,
            minDurationMs: 1200,
            work: async () => {
                const [res] = await Promise.all([
                    apiFetch('/api/admin/switch-role', {
                        method: 'POST',
                        body: JSON.stringify({ targetRole })
                    }),
                    new Promise(r => setTimeout(r, 200))
                ]);
                switchedRes = res;
                PortalState.effectiveRole = res.role;
                PortalState.baseRole = res.baseRole;
                PortalState.switchedRole = res.switchedRole;
                PortalState.roleName = res.roleName;
                PortalState.roleColor = res.roleColor;
                PortalState.stationScope = res.stationScope;
                PortalState.permissions = Array.isArray(res.permissions) ? res.permissions : [];

                syncRoleSwitcherUi();
                if (typeof onRoleChangedHook === 'function') {
                    await onRoleChangedHook();
                }
            }
        });

        if (switchedRes) {
            showToast(`Now viewing as ${switchedRes.roleName} (${PortalState.fullName || 'Super Admin'})`);
        }
    } catch (err) {
        showToast(err.message || 'Could not switch role');
    } finally {
        isSwitchingRole = false;
    }
}

export function initRoleSwitcher(onRoleChanged) {
    onRoleChangedHook = onRoleChanged || null;
    const switchBtn = document.getElementById('sidebar-footer-switch-btn');
    const modal = document.getElementById('overseer-role-modal');
    const closeBtn = document.getElementById('overseer-role-modal-close');
    const returnBtn = document.getElementById('role-morph-return-btn');
    const bannerRolePill = document.getElementById('role-morph-active-name');

    switchBtn?.addEventListener('click', (e) => {
        if (PortalState.baseRole === 'super_admin') {
            e.preventDefault();
            openOverseerRoleModal();
        }
    });

    bannerRolePill?.addEventListener('click', () => {
        if (PortalState.baseRole === 'super_admin') openOverseerRoleModal();
    });
    if (bannerRolePill) {
        bannerRolePill.style.cursor = 'pointer';
        bannerRolePill.title = 'Tap to switch role';
    }

    closeBtn?.addEventListener('click', closeOverseerRoleModal);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeOverseerRoleModal();
    });

    document.querySelectorAll('.overseer-role-tile').forEach(tile => {
        tile.addEventListener('click', () => switchSuperAdminRole(tile.dataset.targetRole));
    });

    returnBtn?.addEventListener('click', () => switchSuperAdminRole('super_admin'));
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeOverseerRoleModal();
    });

    syncRoleSwitcherUi();
}
