/**
 * Role-Coded HTML Email Templates for iGUIDE DA-CALABARZON
 * Styled after the clean FarmVault / NAS Analytics Security card layout
 * with dynamic RBAC role color palettes.
 */

const ROLE_EMAIL_THEMES = {
    super_admin: {
        label: 'Super Admin',
        headerBg: '#6d28d9',
        accent: '#8b5cf6',
        cardBorder: '#ddd6fe',
        tintBg: '#f5f3ff',
        codeInk: '#4c1d95',
        pillBg: 'rgba(255, 255, 255, 0.18)',
        ctaBg: '#7c3aed'
    },
    administrator: {
        label: 'Administrator (MIS)',
        headerBg: '#15803d',
        accent: '#16a34a',
        cardBorder: '#bbf7d0',
        tintBg: '#f0fdf4',
        codeInk: '#166534',
        pillBg: 'rgba(255, 255, 255, 0.18)',
        ctaBg: '#15803d'
    },
    gis_editor: {
        label: 'GIS Editor',
        headerBg: '#0369a1',
        accent: '#3b82f6',
        cardBorder: '#bfdbfe',
        tintBg: '#eff6ff',
        codeInk: '#1e3a8a',
        pillBg: 'rgba(255, 255, 255, 0.18)',
        ctaBg: '#0284c7'
    },
    reviewer: {
        label: 'Station Reviewer',
        headerBg: '#b45309',
        accent: '#f59e0b',
        cardBorder: '#fde68a',
        tintBg: '#fffbeb',
        codeInk: '#78350f',
        pillBg: 'rgba(255, 255, 255, 0.18)',
        ctaBg: '#d97706'
    },
    visitor: {
        label: 'Staff Access',
        headerBg: '#0f766e',
        accent: '#14b8a6',
        cardBorder: '#99f6e4',
        tintBg: '#f0fdfa',
        codeInk: '#134e4a',
        pillBg: 'rgba(255, 255, 255, 0.18)',
        ctaBg: '#0d9488'
    },
    denied: {
        label: 'Action Required',
        headerBg: '#b91c1c',
        accent: '#ef4444',
        cardBorder: '#fecaca',
        tintBg: '#fef2f2',
        codeInk: '#991b1b',
        pillBg: 'rgba(255, 255, 255, 0.18)',
        ctaBg: '#b91c1c'
    }
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getRoleEmailTheme(roleSlug) {
    const key = String(roleSlug || 'administrator').trim().toLowerCase();
    return ROLE_EMAIL_THEMES[key] || ROLE_EMAIL_THEMES.administrator;
}

/**
 * Shared email shell mirroring FarmVault / NAS Analytics centered security card design.
 */
function renderEmailShell({
    role = 'administrator',
    headerTitle = 'iGUIDE Security',
    roleBadgeText = '',
    greeting = 'Hello,',
    introHtml = '',
    centerBlockHtml = '',
    secondaryHtml = '',
    warningHtml = '',
    ctaLabel = '',
    ctaUrl = '',
    footerText = '© 2026 Department of Agriculture RFO IV-A • iGUIDE Spatial System'
}) {
    const theme = getRoleEmailTheme(role);
    const badgeHtml = roleBadgeText
        ? `<div style="margin-top:8px;"><span style="display:inline-block;padding:3px 11px;border-radius:999px;background:${theme.pillBg};border:1px solid rgba(255,255,255,0.28);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;">${escapeHtml(roleBadgeText)}</span></div>`
        : '';

    const ctaHtml = (ctaLabel && ctaUrl)
        ? `<div style="margin:22px 0 6px;text-align:center;">
               <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${theme.ctaBg};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:0.2px;">${escapeHtml(ctaLabel)}</a>
           </div>`
        : '';

    const warnBlock = warningHtml
        ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.55;color:#ef4444;text-align:center;">${warningHtml}</p>`
        : '';

    const secBlock = secondaryHtml
        ? `<div style="margin:18px 0 0;font-size:14px;line-height:1.55;color:#334155;text-align:center;">${secondaryHtml}</div>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#334155;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:540px;margin:0 auto;background:#ffffff;border:1px solid ${theme.cardBorder};border-radius:12px;overflow:hidden;border-collapse:separate;">
    <tr>
      <td style="background:${theme.headerBg};padding:22px 24px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.2px;line-height:1.25;">${escapeHtml(headerTitle)}</div>
        ${badgeHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:30px 28px 26px;background:#ffffff;">
        <p style="margin:0 0 16px;font-size:15px;color:#334155;text-align:center;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 24px;font-size:14.5px;line-height:1.6;color:#334155;text-align:center;">${introHtml}</p>
        ${centerBlockHtml}
        ${ctaHtml}
        ${secBlock}
        ${warnBlock}
      </td>
    </tr>
    <tr>
      <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 24px;text-align:center;font-size:12.5px;color:#94a3b8;">
        ${escapeHtml(footerText)}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * OTP Verification & Password Reset Code Email (exact FarmVault / NAS Analytics layout)
 */
function buildOtpSecurityEmail({ userName = 'User', role = 'administrator', otp, purpose = 'login' }) {
    const theme = getRoleEmailTheme(role);
    const spacedOtp = String(otp || '').split('').join(' ');
    const isReset = purpose === 'reset';

    const headerTitle = isReset ? '🌿 iGUIDE Password Recovery' : '🌿 iGUIDE Security';
    const roleBadgeText = `${theme.label} • ${isReset ? 'Reset Code' : '2-Step Verification'}`;
    const introHtml = isReset
        ? 'A password reset request was made for your iGUIDE Portal account.<br>Use the verification code below to set a new password:'
        : 'A sign-in attempt was just made to your iGUIDE Spatial Portal.<br>Use the code below to complete your authentication:';

    const centerBlockHtml = `
      <div style="background:${theme.tintBg};border:2px dashed ${theme.accent};border-radius:10px;padding:24px 16px;text-align:center;margin:0 auto;">
        <div style="font-size:34px;font-weight:800;letter-spacing:5px;color:${theme.codeInk};font-family:'Segoe UI',Roboto,Arial,sans-serif;line-height:1.15;">
          ${escapeHtml(spacedOtp)}
        </div>
      </div>`;

    return renderEmailShell({
        role,
        headerTitle,
        roleBadgeText,
        greeting: `Hello ${userName},`,
        introHtml,
        centerBlockHtml,
        secondaryHtml: 'This code will expire in <strong style="color:#1e293b;">5 minutes</strong>.',
        warningHtml: isReset
            ? 'If you did not request a password reset, please ignore this message and check your account activity.'
            : 'If you did not initiate this login, please change your password immediately and check your logs.'
    });
}

/**
 * Role-Coded Structured Summary Email (Sign-ups, Approvals, Review Queue, Publish)
 */
function buildWorkflowEmail({
    role = 'administrator',
    headerTitle = '🌿 iGUIDE Notification',
    roleBadgeText = '',
    greeting = 'Hello,',
    introText = '',
    details = [],
    ctaLabel = '',
    ctaUrl = '',
    noteText = '',
    warningText = ''
}) {
    const theme = getRoleEmailTheme(role);
    const rowsHtml = (details || [])
        .filter(d => d && d.label)
        .map(d => `
          <tr>
            <td style="padding:6px 10px 6px 0;font-size:12.5px;font-weight:700;color:${theme.codeInk};text-transform:uppercase;letter-spacing:0.4px;vertical-align:top;white-space:nowrap;">${escapeHtml(d.label)}</td>
            <td style="padding:6px 0;font-size:13.5px;color:#1e293b;vertical-align:top;line-height:1.45;">${escapeHtml(d.value || '—')}</td>
          </tr>`)
        .join('');

    const centerBlockHtml = rowsHtml
        ? `<div style="background:${theme.tintBg};border:2px dashed ${theme.accent};border-radius:10px;padding:16px 20px;margin:0 auto;">
             <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
               ${rowsHtml}
             </table>
           </div>`
        : '';

    return renderEmailShell({
        role,
        headerTitle,
        roleBadgeText: roleBadgeText || theme.label,
        greeting,
        introHtml: escapeHtml(introText),
        centerBlockHtml,
        ctaLabel,
        ctaUrl,
        secondaryHtml: noteText ? escapeHtml(noteText) : '',
        warningHtml: warningText ? escapeHtml(warningText) : ''
    });
}

module.exports = {
    ROLE_EMAIL_THEMES,
    getRoleEmailTheme,
    buildOtpSecurityEmail,
    buildWorkflowEmail
};

