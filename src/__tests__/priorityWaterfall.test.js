/**
 * @file priorityWaterfall.test.js
 * Unit tests for src/decision/priorityWaterfall.js
 *
 * Run: node --test src/__tests__/priorityWaterfall.test.js
 */

'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { runWaterfall } = require('../decision/priorityWaterfall');
const { PRIORITY } = require('../config/constants');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const emptyMatrix = { topIntent: null, topScore: 0, secondScore: 0, separation: 0 };

function signals(overrides) {
    return Object.assign({
        url: { explicitIntent: null, inferredIntent: null, confidence: 0, matchedPatterns: [] },
        referrer: { inferredIntent: null, confidence: 0, category: 'direct' },
        behavior: { engagementScore: 0, scrollDepth: 0, clickCount: 0 },
        // 'unknown' device → DEVICE_INTENT_MAP has no entry → no P4 device heuristic
        device: { device: 'unknown' },
        // Wednesday 07:00 am: before business hours (< 9), not late evening (< 20 and > 1),
        // not weekend midday → NO TIME_PATTERN matches → no P4 time heuristic
        time: { hour: 7, day: 3, isWeekend: false, isBusinessHours: false },
        history: { visitCount: 0, scores: {}, lastIntent: null, isReturning: false },
        persona: { override: null },
    }, overrides);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runWaterfall() — P0 Persona override', () => {
    it('persona override wins when set', () => {
        const sig = signals({ persona: { override: 'gaming' } });
        const r = runWaterfall(sig, emptyMatrix, 0.30);
        assert.equal(r.priority, PRIORITY.PERSONA_OVERRIDE);
        assert.equal(r.intent, 'use_case'); // gaming maps to use_case
        assert.ok(r.confidence >= 0.75);
    });

    it('unknown persona override falls through to next priority', () => {
        const sig = signals({ persona: { override: 'xyzzy' } });
        const r = runWaterfall(sig, emptyMatrix, 0.30);
        assert.notEqual(r.priority, PRIORITY.PERSONA_OVERRIDE);
    });
});

describe('runWaterfall() — P1 Explicit URL intent', () => {
    it('explicit intent wins at P1', () => {
        const sig = signals({
            url: { explicitIntent: 'buy_now', inferredIntent: null, confidence: 0.95, matchedPatterns: [] },
        });
        const r = runWaterfall(sig, emptyMatrix, 0.90);
        assert.equal(r.priority, PRIORITY.URL_EXPLICIT);
        assert.equal(r.intent, 'buy_now');
        assert.ok(r.confidence >= 0.90);
    });
});

describe('runWaterfall() — P2 URL inferred', () => {
    it('high-confidence URL inferred wins at P2', () => {
        const sig = signals({
            url: { explicitIntent: null, inferredIntent: 'compare', confidence: 0.75, matchedPatterns: ['compare(2)'] },
        });
        const matrix = { topIntent: 'compare', topScore: 6, secondScore: 1, separation: 0.83 };
        const r = runWaterfall(sig, matrix, 0.72);
        assert.equal(r.priority, PRIORITY.URL_INFERRED);
        assert.equal(r.intent, 'compare');
    });

    it('URL + referrer agreement boosts and wins at P2', () => {
        const sig = signals({
            url: { explicitIntent: null, inferredIntent: 'research', confidence: 0.60, matchedPatterns: [] },
            referrer: { inferredIntent: 'research', confidence: 0.45, category: 'search' },
        });
        const matrix = { topIntent: 'research', topScore: 4, secondScore: 2, separation: 0.5 };
        // confidence below 0.65 threshold, but url+referrer agree → P2 via agreement path
        const r = runWaterfall(sig, matrix, 0.55);
        assert.equal(r.priority, PRIORITY.URL_INFERRED);
        assert.equal(r.reasonKey, 'url_referrer_agree');
    });
});

describe('runWaterfall() — P7 Default fallback', () => {
    it('returns research as default with 0.30 confidence', () => {
        const sig = signals(); // no strong signals at all
        const matrix = emptyMatrix;
        const r = runWaterfall(sig, matrix, 0.30);
        assert.equal(r.priority, PRIORITY.DEFAULT_FALLBACK);
        assert.equal(r.intent, 'research');
        assert.equal(r.confidence, 0.30);
    });
});

describe('runWaterfall() — reason string always present', () => {
    it('reason is a non-empty string for every priority level', () => {
        const sig = signals();
        const r = runWaterfall(sig, emptyMatrix, 0.30);
        assert.ok(typeof r.reason === 'string' && r.reason.length > 0);
    });
});
