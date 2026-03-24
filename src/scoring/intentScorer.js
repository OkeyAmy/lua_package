/**
 * @file intentScorer.js
 * Per-signal weighted accumulation.
 *
 * For each signal layer, produces a partial score vector { intent → number }.
 * The scoreFuser then combines these across layers.
 */

'use strict';

const {
    INTENT_TYPES,
    BEHAVIOR_INTENT_BIAS,
    TIME_PATTERNS,
    DEVICE_INTENT_MAP,
    REFERRER_INTENT_MAP,
    ALGORITHM,
} = require('../config/constants');

/**
 * Score the URL signal layer.
 * Already has scores computed by urlAnalyzer; just normalize.
 *
 * @param {import('../signals/urlAnalyzer').URLAnalysis} urlSignal
 * @returns {Record<string, number>}
 */
function scoreURL(urlSignal) {
    return { ...(urlSignal.scores || {}) };
}

/**
 * Score the referrer signal layer.
 * Converts the intent + confidence into a simple score vector.
 *
 * @param {import('../signals/referrerAnalyzer').ReferrerAnalysis} refSignal
 * @returns {Record<string, number>}
 */
function scoreReferrer(refSignal) {
    if (!refSignal || !refSignal.inferredIntent) return {};
    const baseScore = refSignal.confidence * refSignal.coeff * 3; // scale to same range as URL
    return { [refSignal.inferredIntent]: baseScore };
}

/**
 * Score the behavior signal layer.
 * High engagement amplifies research/compare, low engagement amplifies impulse.
 *
 * @param {import('../signals/behaviorAnalyzer').BehaviorSnapshot} behaviorSignal
 * @returns {Record<string, number>}
 */
function scoreBehavior(behaviorSignal) {
    if (!behaviorSignal) return {};
    const eng = behaviorSignal.engagementScore || 0;
    const tier = eng >= 0.5 ? 'high' : 'low';
    const biases = BEHAVIOR_INTENT_BIAS[tier];
    const scores = {};

    for (const [intent, bias] of Object.entries(biases)) {
        // Base score = engagementScore scaled, modified by bias
        scores[intent] = eng * bias * 2; // scale to comparable range
    }

    return scores;
}

/**
 * Score the time-of-day signal layer.
 *
 * @param {{ hour: number, day: number }} timeSignal
 * @returns {Record<string, number>}
 */
function scoreTime(timeSignal) {
    if (!timeSignal || typeof timeSignal.hour !== 'number') return {};
    for (const pattern of TIME_PATTERNS) {
        if (pattern.test(timeSignal.hour, timeSignal.day)) {
            return { [pattern.intent]: pattern.confidence * 2 };
        }
    }
    return {};
}

/**
 * Score the device type signal layer.
 *
 * @param {'mobile'|'tablet'|'desktop'|'unknown'} device
 * @returns {Record<string, number>}
 */
function scoreDevice(device) {
    const mapping = DEVICE_INTENT_MAP[device];
    if (!mapping) return {};
    return { [mapping.intent]: mapping.confidence * 1.5 };
}

/**
 * Score the visit history signal layer (already decay-weighted from historyAnalyzer).
 *
 * @param {import('../signals/historyAnalyzer').HistoryAnalysis} historySignal
 * @returns {Record<string, number>}
 */
function scoreHistory(historySignal) {
    if (!historySignal || !historySignal.scores) return {};
    return { ...historySignal.scores };
}

module.exports = { scoreURL, scoreReferrer, scoreBehavior, scoreTime, scoreDevice, scoreHistory };
