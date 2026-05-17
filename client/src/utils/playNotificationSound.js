/**
 * Short "new notification" chime (Web Audio API).
 * We always try to play when the user has not chosen "No thanks".
 * Many browsers still suspend AudioContext until a first user gesture; if resume fails,
 * we emit NOTIFICATION_AUTOPLAY_BLOCKED_EVENT so the UI can offer Enable / Mute once.
 */

const STORAGE_KEY = 'utas_notification_sound_preference';
const GESTURE_EVENT = 'utas-notification-gesture-unlock';
const AUTOPLAY_BLOCKED_EVENT = 'utas-notification-autoplay-blocked';

let sharedCtx = null;
let userGestureAudioUnlocked = false;
let autoplayBlockedDispatched = false;

function getAudioContext() {
    if (typeof window === 'undefined') return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedCtx) sharedCtx = new Ctx();
    return sharedCtx;
}

function markUserGestureAudioUnlock() {
    if (userGestureAudioUnlocked) return;
    userGestureAudioUnlocked = true;
    try {
        const ctx = getAudioContext();
        if (ctx?.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
    } catch {
        /* ignore */
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(GESTURE_EVENT));
    }
}

/** First pointer / key / touch anywhere on the page unlocks AudioContext (browser rule). */
function attachGlobalGestureUnlock() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
        markUserGestureAudioUnlock();
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
        window.removeEventListener('touchstart', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    window.addEventListener('keydown', unlock, { capture: true });
    window.addEventListener('touchstart', unlock, { capture: true, passive: true });
}
attachGlobalGestureUnlock();

/** Per auth token: skip sound on the very first fetch after login (baseline). */
const soundSessionByToken = new Map();

export function getNotificationSoundPreference() {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY);
}

export function isNotificationSoundEnabled() {
    return getNotificationSoundPreference() === 'enabled';
}

export const NOTIFICATION_GESTURE_UNLOCK_EVENT = GESTURE_EVENT;
export const NOTIFICATION_AUTOPLAY_BLOCKED_EVENT = AUTOPLAY_BLOCKED_EVENT;

export function dismissNotificationSoundPrompt() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, 'dismissed');
}

/** Explicit enable: saves preference + sample chime (counts as gesture). */
export function unlockNotificationSound() {
    markUserGestureAudioUnlock();
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, 'enabled');
    }
    playNotificationSoundRaw();
}

export function resetNotificationSoundSession(token) {
    autoplayBlockedDispatched = false;
    if (token) soundSessionByToken.delete(token);
    else soundSessionByToken.clear();
}

function markAutoplayBlockedOnce() {
    if (autoplayBlockedDispatched) return;
    autoplayBlockedDispatched = true;
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(AUTOPLAY_BLOCKED_EVENT));
    }
}

function canPlayNotificationChime() {
    return getNotificationSoundPreference() !== 'dismissed';
}

function playNotificationSoundRaw() {
    void playNotificationSoundRawInner();
}

async function playNotificationSoundRawInner() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            try {
                await ctx.resume();
            } catch {
                markAutoplayBlockedOnce();
                return;
            }
        }
        if (ctx.state !== 'running') {
            markAutoplayBlockedOnce();
            return;
        }
        const t0 = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, t0);
        osc.frequency.setValueAtTime(1174, t0 + 0.07);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.07, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
        osc.start(t0);
        osc.stop(t0 + 0.23);
    } catch {
        markAutoplayBlockedOnce();
    }
}

/**
 * @param {string|null} token
 * @param {boolean} hasNewId — true if API returned at least one notification id not in the previous list
 */
export function maybePlayNewNotificationSound(token, hasNewId) {
    if (!canPlayNotificationChime()) return;
    if (!token || !hasNewId) return;
    if (!soundSessionByToken.has(token)) {
        soundSessionByToken.set(token, true);
        return;
    }
    playNotificationSoundRaw();
}

export function playNotificationSound() {
    if (!canPlayNotificationChime()) return;
    playNotificationSoundRaw();
}
