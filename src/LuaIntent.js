/**
 * @file LuaIntent.js
 * Main orchestrator class — combines all modules into a single public API.
 *
 * Backward compatible: does NOT modify existing utm.js or lua.js behaviour.
 * Just import LuaIntent instead of using LuaUTM directly.
 *
 * Usage:
 *   const engine = new LuaIntent({ debug: true });
 *   const decision = engine.decide();
 *   console.log(decision.intent, decision.confidence, decision.reason);
 */

'use strict';

const { collectSignals } = require('./signals/signalsCollector');
const { scoreURL, scoreReferrer, scoreBehavior, scoreTime, scoreDevice, scoreHistory } = require('./scoring/intentScorer');
const { fuse } = require('./scoring/scoreFuser');
const { computeConfidence, shouldInvokeAI } = require('./scoring/confidenceCalc');
const { runWaterfall } = require('./decision/priorityWaterfall');
const { recordVisit } = require('./signals/historyAnalyzer');
const { ALGORITHM, PRIORITY } = require('./config/constants');

class LuaIntent {
    /**
     * @param {{
     *   debug?:        boolean,
     *   ai?:           { enabled: boolean, threshold?: number, adapter?: Function },
     *   storage?:      Storage,
     *   recordHistory?: boolean,
     * }} [config]
     */
    constructor(config) {
        this._config = Object.assign({
            debug: false,
            ai: { enabled: false },
            recordHistory: true,
        }, config || {});

        this._version = '1.0.0';
        this._sessionId = generateSessionId();
    }

    /**
     * Collect signals and decide — the primary entry point.
     *
     * @param {{
     *   url?:              string|URL,
     *   referrer?:         string,
     *   userAgent?:        string,
     *   behavior?:         object,
     *   simulateBehavior?: object,
     *   now?:              Date|number,
     * }} [ctx]
     * @returns {IntentDecision}
     */
    decide(ctx) {
        const t0 = Date.now();

        // 1. Collect all signals
        const signals = collectSignals(Object.assign({ storage: this._config.storage }, ctx || {}));

        // 2. Score each signal layer
        const layerScores = {
            url: scoreURL(signals.url),
            referrer: scoreReferrer(signals.referrer),
            behavior: scoreBehavior(signals.behavior),
            time: scoreTime(signals.time),
            device: scoreDevice(signals.device.device),
            history: scoreHistory(signals.history),
        };

        // 3. Fuse scores (Bayesian α-combination)
        const matrix = fuse(layerScores);

        // 4. Compute confidence (separation-adjusted)
        const confidence = computeConfidence(matrix);

        // 5. Run priority waterfall
        let waterfall = runWaterfall(signals, matrix, confidence);

        // 6. AI augmentation (sync stub — async AI should use decideAsync())
        if (shouldInvokeAI(waterfall.confidence, this._config.ai?.enabled)) {
            waterfall = Object.assign({}, waterfall, {
                reason: waterfall.reason + ' (AI augmentation available via decideAsync)',
                priority: PRIORITY.AI_AUGMENT,
            });
        }

        const decisionMs = Date.now() - t0;

        const decision = {
            intent: waterfall.intent,
            confidence: waterfall.confidence,
            reason: waterfall.reason,
            source: waterfall.reasonKey,
            priority: waterfall.priority,
            scores: matrix,
            signals: this._config.debug ? signals : undefined,
            decisionMs,
            sessionId: this._sessionId,
            aiUsed: false,
            version: this._version,
        };

        // 7. Record to history
        if (this._config.recordHistory) {
            try {
                recordVisit({ intent: decision.intent }, this._config.storage);
            } catch { /* ignore storage errors */ }
        }

        if (this._config.debug) {
            console.log('[LuaIntent]', decision);
        }

        return decision;
    }

    /**
     * Async decide — supports an async AI adapter.
     *
     * @param {object} [ctx]
     * @returns {Promise<IntentDecision>}
     */
    async decideAsync(ctx) {
        const syncDecision = this.decide(ctx);

        const aiCfg = this._config.ai || {};
        if (!shouldInvokeAI(syncDecision.confidence, aiCfg.enabled)) {
            return syncDecision;
        }

        if (typeof aiCfg.adapter !== 'function') {
            return syncDecision;
        }

        try {
            const aiResult = await aiCfg.adapter(syncDecision.signals || {}, syncDecision);
            // AI only wins if it improves confidence by the required margin
            if (
                aiResult &&
                aiResult.confidence > syncDecision.confidence + ALGORITHM.AI_WIN_MARGIN
            ) {
                return Object.assign({}, syncDecision, {
                    intent: aiResult.intent,
                    confidence: aiResult.confidence,
                    reason: aiResult.reason || syncDecision.reason,
                    source: 'ai',
                    priority: PRIORITY.AI_AUGMENT,
                    aiUsed: true,
                });
            }
        } catch (err) {
            // AI failed — silently return the algorithmic decision
            if (this._config.debug) {
                console.warn('[LuaIntent] AI adapter error:', err.message);
            }
        }

        return syncDecision;
    }
}

// ─── Session ID ───────────────────────────────────────────────────────────────

function generateSessionId() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `s_${ts}_${rand}`;
}

/**
 * @typedef {object} IntentDecision
 * @property {string}  intent
 * @property {number}  confidence    (0–1)
 * @property {string}  reason        (human-readable, always present)
 * @property {string}  source        (reasonKey from waterfall)
 * @property {number}  priority      (waterfall level 0–7)
 * @property {import('./scoring/scoreFuser').ScoreMatrix} scores
 * @property {object|undefined}  signals  (only in debug mode)
 * @property {number}  decisionMs
 * @property {string}  sessionId
 * @property {boolean} aiUsed
 * @property {string}  version
 */

module.exports = { LuaIntent };
