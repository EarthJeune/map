// DA-LARES Wayfinding — Mobile-Only Turn-by-Turn Voice Guidance (Web Speech API)
import { lucideIcon } from './data/icons.js';
import { detectAppMode } from './mode.js';

const STORAGE_KEY = 'iguide_voice_muted';

let voiceMuted = false;
let lastSpokenKey = '';
let lastSpokenTime = 0;
let unlocked = false;

try {
    voiceMuted = localStorage.getItem(STORAGE_KEY) === '1';
} catch (_) {
    voiceMuted = false;
}

export function isMobileVoiceDevice() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    // Use detectAppMode() directly so it works accurately at module load time before applyAppModeToDOM() runs
    if (typeof detectAppMode === 'function') {
        return detectAppMode() === 'phone';
    }
    const isMobileUA = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);
    const hasPhoneParam = (new URLSearchParams(window.location.search).get('mode') || '').toLowerCase() === 'phone';
    return isMobileUA || hasPhoneParam || window.innerWidth <= 768;
}

export function isVoiceMuted() {
    return voiceMuted;
}

export function stopVoiceSpeech() {
    try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    } catch (_) { }
}

export function resetVoiceNavigationState() {
    lastSpokenKey = '';
    lastSpokenTime = 0;
    stopVoiceSpeech();
}

export function unlockVoiceNavigation() {
    if (!isMobileVoiceDevice() || voiceMuted) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (unlocked) return;
    try {
        // iOS Safari requires a speechSynthesis call inside a direct user tap gesture
        const warm = new SpeechSynthesisUtterance('');
        warm.volume = 0;
        window.speechSynthesis.speak(warm);
        unlocked = true;
    } catch (_) { }
}

function pickPreferredVoice() {
    try {
        const voices = window.speechSynthesis.getVoices() || [];
        if (!voices.length) return null;
        return (
            voices.find(v => /en[-_]US/i.test(v.lang) && /samantha|google|aria|jenny|natural/i.test(v.name)) ||
            voices.find(v => /en[-_]US/i.test(v.lang)) ||
            voices.find(v => /^en/i.test(v.lang)) ||
            null
        );
    } catch (_) {
        return null;
    }
}

export function speakNavInstruction(text, options = {}) {
    if (!text || typeof text !== 'string') return false;
    if (!isMobileVoiceDevice() || voiceMuted) return false;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;

    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return false;

    const now = Date.now();
    const dedupeKey = options.key || clean.toLowerCase();
    const priority = Boolean(options.priority);
    const minIntervalMs = priority ? 1200 : 4500;

    if (dedupeKey === lastSpokenKey && (now - lastSpokenTime) < (priority ? 6000 : 14000)) {
        return false;
    }
    if (!priority && (now - lastSpokenTime) < minIntervalMs) {
        return false;
    }

    try {
        if (priority || window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }
        const utter = new SpeechSynthesisUtterance(clean);
        utter.lang = 'en-US';
        utter.rate = 1.02;
        utter.pitch = 1.0;
        utter.volume = 1.0;
        const v = pickPreferredVoice();
        if (v) utter.voice = v;
        window.speechSynthesis.speak(utter);
        lastSpokenKey = dedupeKey;
        lastSpokenTime = now;
        return true;
    } catch (_) {
        return false;
    }
}

export function syncVoiceToggleButtons() {
    if (typeof document === 'undefined') return;
    const btns = document.querySelectorAll('.ctrl-voice-btn');
    btns.forEach(btn => {
        btn.classList.toggle('is-muted', voiceMuted);
        btn.setAttribute('aria-pressed', String(!voiceMuted));
        btn.setAttribute('title', voiceMuted ? 'Voice Directions Muted (Tap to Unmute)' : 'Voice Directions ON (Tap to Mute)');
        btn.innerHTML = `<span style="display: inline-flex; align-items: center; justify-content: center;">${lucideIcon(voiceMuted ? 'volume-x' : 'volume-2', 16)}</span>`;
    });
}

export function toggleVoiceMute() {
    voiceMuted = !voiceMuted;
    try {
        localStorage.setItem(STORAGE_KEY, voiceMuted ? '1' : '0');
    } catch (_) { }

    if (voiceMuted) {
        stopVoiceSpeech();
    } else {
        unlocked = false;
        unlockVoiceNavigation();
    }

    syncVoiceToggleButtons();

    if (typeof window !== 'undefined' && typeof window.showMobileToast === 'function') {
        window.showMobileToast(voiceMuted ? '🔇 Voice directions muted' : '🔊 Voice directions enabled', 2000);
    }
    return voiceMuted;
}

if (typeof window !== 'undefined') {
    window.toggleVoiceMute = toggleVoiceMute;
    window.isVoiceMuted = isVoiceMuted;
}
