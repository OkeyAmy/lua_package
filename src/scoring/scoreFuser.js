/**
 * @file scoreFuser.js
 * Bayesian combination of per-signal score vectors.
 *
 * Algorithm:
 *   combined[intent] = Σ( α_layer × scores_layer[intent] )
 *
 * Where α weights are the SIGNAL_COEFFICIENTS from constants.js.
 * The result is a ScoreMatrix with the top intent, scores, and separation.
 */

'use strict';

const { SIGNAL_COEFFICIENTS, ALGORITHM } = require('../config/constants');

/**
 * Fuse all per-signal score vectors into a unified ScoreMatrix.
 *
 * @param {{
 *   url?:       Record<string, number>,
 *   referrer?:  Record<string, number>,
 *   behavior?:  Record<string, number>,
 *   time?:      Record<string, number>,
 *   device?:    Record<string, number>,
 *   history?:   Record<string, number>,
 * }} layerScores
 * @returns {ScoreMatrix}
 */
function fuse(layerScores) {
    const combined = {};

    // Apply α weight to each layer and accumulate
    for (const [layer, scores] of Object.entries(layerScores)) {
        const alpha = SIGNAL_COEFFICIENTS[layer] || 0;
        if (alpha === 0 || !scores) continue;

        for (const [intent, score] of Object.entries(scores)) {
            combined[intent] = (combined[intent] || 0) + alpha * score;
        }
    }

    const totalMax = Math.max(...Object.values(combined), 0.001);

    // Normalize to 0–1
    const normalized = {};
    for (const [intent, score] of Object.entries(combined)) {
        normalized[intent] = score / totalMax;
    }

    // Find top two
    const entries = Object.entries(combined).sort((a, b) => b[1] - a[1]);
    const topIntent = entries[0]?.[0] || null;
    const topScore = entries[0]?.[1] || 0;
    const secondIntent = entries[1]?.[0] || null;
    const secondScore = entries[1]?.[1] || 0;
    const sep = topScore > 0 ? clamp01((topScore - secondScore) / topScore) : 0;

    return {
        raw: combined,
        weighted: combined,           // already α-weighted
        normalized,
        topIntent,
        topScore,
        secondIntent,
        secondScore,
        separation: sep,
    };
}

function clamp01(v) {
    return Math.max(0, Math.min(1, Number(v) || 0));
}

/**
 * @typedef {object} ScoreMatrix
 * @property {Record<string, number>} raw         Per-intent combined scores
 * @property {Record<string, number>} weighted    Same as raw (already α-weighted)
 * @property {Record<string, number>} normalized  Scores scaled to 0–1
 * @property {string|null} topIntent
 * @property {number} topScore
 * @property {string|null} secondIntent
 * @property {number} secondScore
 * @property {number} separation  (0–1, how decisive the top intent is)
 */

module.exports = { fuse };
