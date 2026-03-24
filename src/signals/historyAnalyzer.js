/**
 * @file historyAnalyzer.js
 * Reads visit history from localStorage and applies recency-weighted decay
 * to compute a per-intent historical score.
 *
 * Decay formula: score[intent] += 1 / (position + 1)
 *   - Most recent visit has weight 1.0
 *   - Second-most-recent has weight 0.5
 *   - Third has weight 0.33, etc.
 */

'use strict';

const { ALGORITHM } = require('../config/constants');

const STORAGE_KEY = 'lua_intent_history';

/**
 * Read visit history and compute per-intent decay scores.
 *
 * @param {Storage} [storage] - localStorage or a mock (for testing)
 * @returns {HistoryAnalysis}
 */
function analyzeHistory(storage) {
    const store = storage || safeLocalStorage();
    const visits = readVisits(store);
    const scores = {};
    const frequency = {};
    const lastIntent = visits.length > 0 ? visits[0].intent : null;

    // Apply recency decay over up to HISTORY_MAX_VISITS
    const maxVisits = Math.min(visits.length, ALGORITHM.HISTORY_MAX_VISITS);

    for (let i = 0; i < maxVisits; i++) {
        const visit = visits[i];
        const intent = visit.intent;
        if (!intent) continue;

        const weight = 1 / (i + 1); // recency decay
        scores[intent] = (scores[intent] || 0) + weight;
        frequency[intent] = (frequency[intent] || 0) + 1;
    }

    const isReturning = visits.length > 1;
    const firstVisitMs = visits.length > 0 ? visits[visits.length - 1].ts || 0 : 0;
    const daysSinceFirst = firstVisitMs
        ? Math.floor((Date.now() - firstVisitMs) / 86400000)
        : 0;

    return {
        visitCount: visits.length,
        lastIntent,
        scores,
        intentFrequency: frequency,
        isReturning,
        daysSinceFirst,
    };
}

/**
 * Record a new visit decision into history.
 *
 * @param {{ intent: string }} visit
 * @param {Storage} [storage]
 */
function recordVisit(visit, storage) {
    const store = storage || safeLocalStorage();
    const visits = readVisits(store);

    visits.unshift({ intent: visit.intent, ts: Date.now() });

    // Keep only the last HISTORY_MAX_VISITS entries
    if (visits.length > ALGORITHM.HISTORY_MAX_VISITS) {
        visits.length = ALGORITHM.HISTORY_MAX_VISITS;
    }

    try {
        store.setItem(STORAGE_KEY, JSON.stringify(visits));
    } catch { /* storage full or unavailable */ }
}

/**
 * Clear stored history (useful for tests / opt-out).
 * @param {Storage} [storage]
 */
function clearHistory(storage) {
    const store = storage || safeLocalStorage();
    try { store.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readVisits(store) {
    try {
        const raw = store.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function safeLocalStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : nullStorage();
    } catch {
        return nullStorage();
    }
}

function nullStorage() {
    const _store = {};
    return {
        getItem: (k) => _store[k] !== undefined ? _store[k] : null,
        setItem: (k, v) => { _store[k] = v; },
        removeItem: (k) => { delete _store[k]; },
    };
}

/**
 * @typedef {object} HistoryAnalysis
 * @property {number} visitCount
 * @property {string|null} lastIntent
 * @property {Record<string, number>} scores          (decay-weighted per intent)
 * @property {Record<string, number>} intentFrequency (raw visit count per intent)
 * @property {boolean} isReturning
 * @property {number}  daysSinceFirst
 */

module.exports = { analyzeHistory, recordVisit, clearHistory };
