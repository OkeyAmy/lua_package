/**
 * @file confidenceCalc.test.js
 * Unit tests for src/scoring/confidenceCalc.js
 *
 * Run: node --test src/__tests__/confidenceCalc.test.js
 */

'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { computeConfidence, shouldInvokeAI } = require('../scoring/confidenceCalc');

const makeMatrix = (topScore, secondScore = 0) => ({
    topIntent: 'buy_now',
    topScore,
    secondIntent: secondScore > 0 ? 'compare' : null,
    secondScore,
    separation: topScore > 0 ? Math.max(0, Math.min(1, (topScore - secondScore) / topScore)) : 0,
});

describe('computeConfidence()', () => {
    it('returns DEFAULT_CONFIDENCE for null matrix', () => {
        const conf = computeConfidence(null);
        assert.equal(conf, 0.30);
    });

    it('returns DEFAULT_CONFIDENCE when topIntent is null', () => {
        const conf = computeConfidence({ topIntent: null, topScore: 0, separation: 0 });
        assert.equal(conf, 0.30);
    });

    it('confidence is in [0, 1] for any input', () => {
        const testCases = [
            makeMatrix(0), makeMatrix(1), makeMatrix(5), makeMatrix(10),
            makeMatrix(100), makeMatrix(10, 9.9), makeMatrix(10, 0),
        ];
        for (const m of testCases) {
            const c = computeConfidence(m);
            assert.ok(c >= 0 && c <= 1, `Confidence out of range: ${c}`);
        }
    });

    it('higher score → higher confidence', () => {
        const low = computeConfidence(makeMatrix(1));
        const high = computeConfidence(makeMatrix(8));
        assert.ok(high > low, `Expected high > low, got ${high} vs ${low}`);
    });

    it('higher separation → higher confidence (same score)', () => {
        const tied = computeConfidence(makeMatrix(5, 4.9)); // separation ≈ 0.02
        const decisive = computeConfidence(makeMatrix(5, 0));   // separation = 1.0
        assert.ok(decisive > tied, `Expected decisive > tied, got ${decisive} vs ${tied}`);
    });
});

describe('shouldInvokeAI()', () => {
    it('returns false when AI is disabled', () => {
        assert.equal(shouldInvokeAI(0.30, false), false);
    });

    it('returns true when confidence is below threshold and AI enabled', () => {
        assert.equal(shouldInvokeAI(0.30, true), true);
    });

    it('returns false when confidence meets threshold even with AI enabled', () => {
        assert.equal(shouldInvokeAI(0.75, true), false);
    });

    it('returns false when AI enabled is undefined', () => {
        assert.equal(shouldInvokeAI(0.20, undefined), false);
    });
});
