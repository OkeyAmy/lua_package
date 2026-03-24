/**
 * @file scoreFuser.test.js
 * Unit tests for src/scoring/scoreFuser.js
 *
 * Run: node --test src/__tests__/scoreFuser.test.js
 */

'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { fuse } = require('../scoring/scoreFuser');

describe('fuse()', () => {
    it('returns topIntent null for empty input', () => {
        const m = fuse({});
        assert.equal(m.topIntent, null);
        assert.equal(m.topScore, 0);
    });

    it('picks the intent with the highest α-weighted score', () => {
        const m = fuse({
            url: { buy_now: 10, compare: 2 },
        });
        assert.equal(m.topIntent, 'buy_now');
        assert.ok(m.topScore > m.secondScore);
    });

    it('applies signal coefficients correctly', () => {
        // url α = 0.45, referrer α = 0.20
        // url gives compare=10, referrer gives research=10
        // compare contribution: 0.45 × 10 = 4.5
        // research contribution: 0.20 × 10 = 2.0
        const m = fuse({
            url: { compare: 10 },
            referrer: { research: 10 },
        });
        assert.equal(m.topIntent, 'compare');
    });

    it('combines multiple layers for same intent', () => {
        // Both url and referrer agree on buy_now
        const m = fuse({
            url: { buy_now: 5 },
            referrer: { buy_now: 5 },
        });
        assert.equal(m.topIntent, 'buy_now');
        // Score should be higher than either layer alone
        const urlOnly = fuse({ url: { buy_now: 5 } });
        const bothTogether = m.topScore;
        assert.ok(bothTogether > urlOnly.topScore, 'Combined score should exceed URL-only score');
    });

    it('normalized values are in [0,1]', () => {
        const m = fuse({
            url: { buy_now: 10, compare: 5, research: 2 },
        });
        for (const [, v] of Object.entries(m.normalized)) {
            assert.ok(v >= 0 && v <= 1, `Normalized value out of range: ${v}`);
        }
    });

    it('separation is 1.0 when only one intent has a score', () => {
        const m = fuse({ url: { buy_now: 8 } });
        assert.equal(m.separation, 1.0);
    });

    it('separation is 0 when two intents have equal scores', () => {
        const m = fuse({ url: { buy_now: 5, compare: 5 } });
        assert.equal(m.separation, 0);
    });

    it('ignores unknown layer names gracefully', () => {
        const m = fuse({ unknownLayer: { buy_now: 999 } });
        // unknownLayer has α=0 (not in coefficients), so buy_now won't score
        assert.equal(m.topScore, 0);
    });
});
