/**
 * @file priorityWaterfall.js
 * 8-level priority decision engine.
 *
 * Levels (first match wins):
 *   P0: Persona override (?persona= URL param)
 *   P1: URL explicit intent (?intent= param, confidence ≥ 0.90)
 *   P2: URL inferred + referrer combined (high confidence)
 *   P3: Behavior-heavy (high engagement alone is decisive)
 *   P4: Time + device heuristics
 *   P5: History pattern (returning visitor with clear pattern)
 *   P6: AI augmentation (plugged in externally, low confidence path)
 *   P7: Default fallback (research @ 0.30)
 */

'use strict';

const {
    INTENT_TYPES,
    PRIORITY,
    ALGORITHM,
    DEVICE_INTENT_MAP,
    TIME_PATTERNS,
} = require('../config/constants');

/**
 * Run the priority waterfall on signals + the fused ScoreMatrix.
 *
 * @param {import('../signals/signalsCollector').AuraSignals} signals
 * @param {import('../scoring/scoreFuser').ScoreMatrix} matrix
 * @param {number} confidence - Pre-computed confidence from confidenceCalc
 * @returns {WaterfallResult}
 */
function runWaterfall(signals, matrix, confidence) {
    // P0: Persona override
    const persona = signals?.persona?.override;
    if (persona) {
        const intent = mapPersonaToIntent(persona);
        if (intent) {
            return result(intent, 0.75, PRIORITY.PERSONA_OVERRIDE, 'persona_override', signals);
        }
    }

    // P1: Explicit URL intent (highest confidence)
    const explicitIntent = signals?.url?.explicitIntent;
    if (explicitIntent) {
        const conf = Math.max(0.90, signals?.url?.confidence || 0.90);
        return result(explicitIntent, conf, PRIORITY.URL_EXPLICIT, 'url_explicit', signals);
    }

    // P2: URL inferred (confidence ≥ 0.65) or URL + referrer agreement
    if (matrix.topIntent && confidence >= 0.65) {
        return result(matrix.topIntent, confidence, PRIORITY.URL_INFERRED, 'url_inferred', signals);
    }

    // P2 also: URL + referrer agree on same intent → boost
    const urlIntent = signals?.url?.inferredIntent;
    const refIntent = signals?.referrer?.inferredIntent;
    if (urlIntent && refIntent && urlIntent === refIntent) {
        const boosted = Math.min(1, confidence + 0.10);
        return result(urlIntent, boosted, PRIORITY.URL_INFERRED, 'url_referrer_agree', signals);
    }

    // P3: Behavior-heavy — high engagement alone is decisive
    const eng = signals?.behavior?.engagementScore || 0;
    if (eng >= 0.75 && matrix.topIntent) {
        return result(matrix.topIntent, confidence, PRIORITY.BEHAVIOR_HEAVY, 'behavior_heavy', signals);
    }

    // P4: Time + device heuristics
    const timeResult = inferFromTime(signals?.time);
    if (timeResult) {
        return result(timeResult.intent, timeResult.confidence, PRIORITY.TIME_DEVICE, 'time_pattern', signals);
    }

    const deviceResult = inferFromDevice(signals?.device?.device);
    if (deviceResult) {
        return result(deviceResult.intent, deviceResult.confidence, PRIORITY.TIME_DEVICE, 'device_pattern', signals);
    }

    // P5: History pattern
    const historyIntent = getHistoryIntent(signals?.history);
    if (historyIntent) {
        return result(historyIntent, 0.45, PRIORITY.HISTORY_PATTERN, 'history_pattern', signals);
    }

    // P6 is handled externally (AI layer calls the waterfall result and decides to override)
    // P7: Default fallback
    return result(ALGORITHM.DEFAULT_INTENT, ALGORITHM.DEFAULT_CONFIDENCE, PRIORITY.DEFAULT_FALLBACK, 'default_fallback', signals);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function result(intent, confidence, priority, reasonKey, signals) {
    return {
        intent,
        confidence,
        priority,
        reasonKey,
        reason: buildReason(reasonKey, intent, signals),
    };
}

function buildReason(key, intent, signals) {
    switch (key) {
        case 'persona_override': {
            const p = signals?.persona?.override || intent;
            return `Persona override "${p}" mapped to intent "${intent}".`;
        }
        case 'url_explicit':
            return `Explicit ?intent=${intent} URL parameter detected.`;
        case 'url_inferred': {
            const patterns = (signals?.url?.matchedPatterns || []).join(', ');
            return patterns
                ? `URL/UTM signals matched patterns: ${patterns}.`
                : 'URL/UTM signals indicate intent.';
        }
        case 'url_referrer_agree':
            return `URL intent and referrer source both indicate "${intent}" — combined signal.`;
        case 'behavior_heavy':
            return `High engagement score (${((signals?.behavior?.engagementScore || 0) * 100).toFixed(0)}%) supports this intent.`;
        case 'time_pattern':
            return 'Time-of-day pattern heuristic indicates intent.';
        case 'device_pattern':
            return `Device type "${signals?.device?.device}" heuristically suggests intent.`;
        case 'history_pattern': {
            const count = signals?.history?.visitCount || 0;
            return `Returning visitor (${count} visits) — historical intent pattern used.`;
        }
        case 'default_fallback':
        default:
            return 'No strong signals detected; using default intent.';
    }
}

function mapPersonaToIntent(persona) {
    if (!persona) return null;
    const s = persona.toLowerCase().trim();
    if (Object.values(INTENT_TYPES).includes(s)) return s;
    if (/\b(gaming|game|esport|coding|dev|design|creative|streaming|studio)\b/.test(s)) return INTENT_TYPES.USE_CASE;
    if (/\b(buy|purchase|order)\b/.test(s)) return INTENT_TYPES.BUY_NOW;
    if (/\b(compare|vs|best|alternative)\b/.test(s)) return INTENT_TYPES.COMPARE;
    if (/\b(budget|cheap|deal)\b/.test(s)) return INTENT_TYPES.BUDGET;
    if (/\b(sale|promo|flash|limited)\b/.test(s)) return INTENT_TYPES.IMPULSE;
    return null;
}

function inferFromTime(time) {
    if (!time || typeof time.hour !== 'number') return null;
    for (const p of TIME_PATTERNS) {
        if (p.test(time.hour, time.day)) return p;
    }
    return null;
}

function inferFromDevice(device) {
    return DEVICE_INTENT_MAP[device] || null;
}

function getHistoryIntent(history) {
    if (!history || history.visitCount < 2) return null;
    const scores = history.scores || {};
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return entries[0]?.[0] || null;
}

/**
 * @typedef {object} WaterfallResult
 * @property {string} intent
 * @property {number} confidence
 * @property {number} priority
 * @property {string} reasonKey
 * @property {string} reason
 */

module.exports = { runWaterfall };
