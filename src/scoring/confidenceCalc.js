/**
 * @file confidenceCalc.js
 * Separation-adjusted confidence calculation.
 *
 * Two-step formula:
 *   1. rawConf  = clamp(BASE + min(MAX_ADD, topScore / SCALE), 0, 1)
 *   2. finalConf = rawConf × (SEP_BASE + SEP_WEIGHT × separation)
 *
 * The separation factor prevents false confidence when two intents are nearly
 * tied (e.g., compare=3.5 vs buy_now=3.4 → low separation → lower confidence).
 */

'use strict';

const { ALGORITHM } = require('../config/constants');

/**
 * Compute the final adjusted confidence from a ScoreMatrix.
 *
 * @param {import('./scoreFuser').ScoreMatrix} matrix
 * @returns {number} confidence in [0, 1]
 */
function computeConfidence(matrix) {
    if (!matrix || !matrix.topIntent) return ALGORITHM.DEFAULT_CONFIDENCE;

    const rawConf = clamp01(
        ALGORITHM.CONFIDENCE_BASE +
        Math.min(ALGORITHM.CONFIDENCE_MAX_ADD, matrix.topScore / ALGORITHM.SCORE_SCALE)
    );

    const finalConf = rawConf * (ALGORITHM.SEP_BASE + ALGORITHM.SEP_WEIGHT * matrix.separation);

    return clamp01(finalConf);
}

/**
 * Quick utility: should the AI layer be invoked?
 *
 * @param {number} confidence
 * @param {boolean} aiEnabled
 * @returns {boolean}
 */
function shouldInvokeAI(confidence, aiEnabled) {
    return aiEnabled === true && confidence < ALGORITHM.AI_THRESHOLD;
}

function clamp01(v) {
    return Math.max(0, Math.min(1, Number(v) || 0));
}

module.exports = { computeConfidence, shouldInvokeAI };
