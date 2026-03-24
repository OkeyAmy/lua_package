/**
 * @file signalsCollector.js
 * Orchestrates all signal layers into a single typed AuraSignals object.
 * This is the formal input interface to the scoring engine.
 */

'use strict';

const { analyzeUrl } = require('./urlAnalyzer');
const { analyzeReferrer } = require('./referrerAnalyzer');
const { BehaviorAnalyzer } = require('./behaviorAnalyzer');
const { analyzeHistory } = require('./historyAnalyzer');

/**
 * Collect all signals and return the unified AuraSignals object.
 *
 * @param {{
 *   url?:              string|URL,
 *   referrer?:         string,
 *   userAgent?:        string,
 *   behavior?:         import('./behaviorAnalyzer').BehaviorSnapshot,
 *   simulateBehavior?: { timeOnPageMs?: number, scrollDepth?: number, clickCount?: number },
 *   now?:              Date|number,
 *   storage?:          Storage,
 * }} [ctx]
 * @returns {AuraSignals}
 */
function collectSignals(ctx) {
    ctx = ctx || {};

    // ── URL layer
    const url = analyzeUrl(ctx.url);

    // ── Referrer layer
    const referrer = analyzeReferrer(ctx.referrer);

    // ── Behavior layer
    let behavior;
    if (ctx.behavior) {
        behavior = ctx.behavior; // Pre-built snapshot (server or test)
    } else {
        const ba = new BehaviorAnalyzer({ enableListeners: false });
        if (ctx.simulateBehavior) ba.simulate(ctx.simulateBehavior);
        behavior = ba.snapshot();
    }

    // ── Device layer
    const ua = ctx.userAgent || safeUA();
    const device = detectDevice(ua);

    // ── Time layer
    const now = toDate(ctx.now);
    const hour = now.getHours();
    const day = now.getDay(); // 0 Sun … 6 Sat
    const time = {
        iso: now.toISOString(),
        hour,
        day,
        isWeekend: day === 0 || day === 6,
        isBusinessHours: ![0, 6].includes(day) && hour >= 9 && hour <= 17,
    };

    // ── History layer
    const history = analyzeHistory(ctx.storage);

    // ── Persona override (from URL)
    const persona = { override: url.personaOverride || null };

    return { url, referrer, behavior, device: { userAgent: ua, device }, time, history, persona };
}

// ─── Device detection ─────────────────────────────────────────────────────────

/**
 * @param {string|null} ua
 * @returns {'mobile'|'tablet'|'desktop'|'unknown'}
 */
function detectDevice(ua) {
    if (!ua) return 'unknown';
    const u = ua.toLowerCase();
    if (/\b(ipad|tablet|android(?!.*mobile))\b/.test(u)) return 'tablet';
    if (/\b(mobile|android|iphone|ipod|blackberry|windows phone)\b/.test(u)) return 'mobile';
    if (/\b(macintosh|windows nt|linux(?!.*android)|x11)\b/.test(u)) return 'desktop';
    return 'unknown';
}

function safeUA() {
    try { return typeof navigator !== 'undefined' ? navigator.userAgent || null : null; } catch { return null; }
}

function toDate(v) {
    if (v instanceof Date) return v;
    if (typeof v === 'number') return new Date(v);
    return new Date();
}

/**
 * @typedef {object} AuraSignals
 * @property {import('./urlAnalyzer').URLAnalysis} url
 * @property {import('./referrerAnalyzer').ReferrerAnalysis} referrer
 * @property {import('./behaviorAnalyzer').BehaviorSnapshot} behavior
 * @property {{ userAgent: string|null, device: 'mobile'|'tablet'|'desktop'|'unknown' }} device
 * @property {{ iso: string, hour: number, day: number, isWeekend: boolean, isBusinessHours: boolean }} time
 * @property {import('./historyAnalyzer').HistoryAnalysis} history
 * @property {{ override: string|null }} persona
 */

module.exports = { collectSignals, detectDevice };
