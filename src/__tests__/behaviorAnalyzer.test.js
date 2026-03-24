/**
 * @file behaviorAnalyzer.test.js
 * Unit tests for src/signals/behaviorAnalyzer.js
 *
 * Run: node --test src/__tests__/behaviorAnalyzer.test.js
 */

'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { BehaviorAnalyzer } = require('../signals/behaviorAnalyzer');

describe('BehaviorAnalyzer.snapshot()', () => {
    it('returns zero engagement on fresh instance (no listeners)', () => {
        const ba = new BehaviorAnalyzer({ enableListeners: false });
        const snap = ba.snapshot();
        assert.equal(snap.clickCount, 0);
        assert.equal(snap.scrollDepth, 0);
        assert.ok(typeof snap.engagementScore === 'number');
        assert.ok(snap.engagementScore >= 0 && snap.engagementScore <= 1);
    });

    it('simulate() sets time on page correctly', () => {
        const ba = new BehaviorAnalyzer({ enableListeners: false });
        ba.simulate({ timeOnPageMs: 8000 });
        const snap = ba.snapshot();
        assert.ok(snap.timeOnPageMs >= 7800, `expected ~8000ms, got ${snap.timeOnPageMs}`);
    });

    it('simulate() sets scroll depth correctly', () => {
        const ba = new BehaviorAnalyzer({ enableListeners: false });
        ba.simulate({ scrollDepth: 0.8 });
        const snap = ba.snapshot();
        assert.equal(snap.scrollDepth, 0.8);
    });

    it('simulate() sets click count correctly', () => {
        const ba = new BehaviorAnalyzer({ enableListeners: false });
        ba.simulate({ clickCount: 3 });
        const snap = ba.snapshot();
        assert.equal(snap.clickCount, 3);
    });

    it('produces high engagement for fully engaged user', () => {
        const ba = new BehaviorAnalyzer({ enableListeners: false });
        ba.simulate({ timeOnPageMs: 8000, scrollDepth: 1.0, clickCount: 5 });
        const snap = ba.snapshot();
        assert.ok(snap.engagementScore > 0.8, `expected engagement > 0.8, got ${snap.engagementScore}`);
    });

    it('engagement score stays in [0, 1]', () => {
        const ba = new BehaviorAnalyzer({ enableListeners: false });
        ba.simulate({ timeOnPageMs: 999999, scrollDepth: 2.0, clickCount: 9999 });
        const snap = ba.snapshot();
        assert.ok(snap.engagementScore <= 1, `score exceeded 1: ${snap.engagementScore}`);
    });
});
