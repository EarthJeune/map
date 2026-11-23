/**
 * Shared Action-Lock, Rapid-Click Cooldown & Request Idempotency Guard
 * Prevents duplicate network submits, double animations, and GPS watch leaks
 * when buttons are tapped 1,000 times rapidly or concurrently.
 */

const activeAsyncLocks = new Set();
const cooldownUntilMap = new Map();
const inFlightRequests = new Map();

/**
 * Simple non-cryptographic 32-bit FNV-1a hash for short deterministic idempotency keys.
 */
function fnv1aHex(str) {
    let h = 0x811c9dc5;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Builds a deterministic idempotency key quantized to a 5-second burst window.
 */
export function buildIdempotencyKey(method, url, bodyStr = '') {
    const bucket = Math.floor(Date.now() / 5000);
    const upperMethod = String(method || 'POST').toUpperCase();
    return `${upperMethod}:${bucket}:${fnv1aHex(String(url || '') + '|' + String(bodyStr || ''))}`;
}

/**
 * Prevents synchronous / rapid animation/GPS button mashing via per-key cooldown.
 */
export function withCooldown(lockKey, fn, cooldownMs = 260) {
    const now = performance.now();
    const until = cooldownUntilMap.get(lockKey) || 0;
    if (now < until) {
        return { throttled: true, result: undefined };
    }
    cooldownUntilMap.set(lockKey, now + cooldownMs);
    return { throttled: false, result: fn() };
}

/**
 * Guards an async action against concurrent double/spam-clicks on a trigger element.
 */
export async function guardAsyncAction(triggerEl, fn, opts = {}) {
    const lockKey = opts.lockKey || (triggerEl && (triggerEl.id || triggerEl.dataset?.lockKey)) || 'global-async-action';
    const cooldownMs = Number(opts.cooldownMs ?? 500);
    const now = performance.now();
    const until = cooldownUntilMap.get(lockKey) || 0;

    if (activeAsyncLocks.has(lockKey) || now < until) {
        return undefined;
    }

    activeAsyncLocks.add(lockKey);
    const el = triggerEl && typeof triggerEl === 'object' && 'disabled' in triggerEl ? triggerEl : null;
    const prevHtml = el ? el.innerHTML : null;
    const prevDisabled = el ? el.disabled : false;

    if (el) {
        el.disabled = true;
        el.dataset.busy = '1';
        el.setAttribute('aria-busy', 'true');
        if (opts.busyText) {
            el.textContent = opts.busyText;
        }
    }

    try {
        return await fn();
    } finally {
        cooldownUntilMap.set(lockKey, performance.now() + cooldownMs);
        activeAsyncLocks.delete(lockKey);
        if (el) {
            el.disabled = prevDisabled;
            delete el.dataset.busy;
            el.removeAttribute('aria-busy');
            if (opts.busyText && prevHtml !== null) {
                el.innerHTML = prevHtml;
            }
        }
    }
}

/**
 * Deduplicates identical in-flight HTTP fetches fired simultaneously (e.g. burst rage clicks).
 */
export async function dedupeInFlightFetch(dedupeKey, runner) {
    if (inFlightRequests.has(dedupeKey)) {
        return inFlightRequests.get(dedupeKey);
    }
    const p = (async () => {
        try {
            return await runner();
        } finally {
            inFlightRequests.delete(dedupeKey);
        }
    })();
    inFlightRequests.set(dedupeKey, p);
    return p;
}

