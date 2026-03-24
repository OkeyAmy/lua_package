/**
 * @file LuaIntent.integration.test.js
 * End-to-end integration tests for the full LuaIntent pipeline.
 *
 * Tests the complete flow: signals → scoring → fusion → waterfall → decision.
 * All tests run without a browser (Node.js only).
 *
 * Run: node --test src/__tests__/LuaIntent.integration.test.js
 */

'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { LuaIntent } = require('../LuaIntent');

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Create a LuaIntent instance and decide with the given URL (no browser).
 */
function decide(url, opts) {
    const engine = new LuaIntent(Object.assign({ recordHistory: false }, opts || {}));
    return engine.decide({ url });
}

// ─── Integration Tests ────────────────────────────────────────────────────────

describe('LuaIntent integration — URL scoring', () => {
    it('detects buy_now from ?q= search query', () => {
        const d = decide('https://example.com/?q=buy+monitor+checkout+order+now');
        assert.equal(d.intent, 'buy_now');
        assert.ok(d.confidence > 0.50, `confidence was ${d.confidence}`);
    });

    it('detects compare from comparison query', () => {
        const d = decide('https://example.com/?q=best+gaming+monitor+vs+alternatives+2026');
        const validIntents = ['compare', 'use_case']; // could be either legitimately
        assert.ok(validIntents.includes(d.intent), `Expected compare or use_case, got ${d.intent}`);
        assert.ok(d.confidence > 0.40);
    });

    it('detects budget from price-sensitive query', () => {
        const d = decide('https://example.com/?q=cheap+budget+affordable+144hz+discount');
        assert.equal(d.intent, 'budget');
        assert.ok(d.confidence > 0.50);
    });

    it('detects use_case from gaming keywords', () => {
        const d = decide('https://example.com/?q=gaming+setup+esports+streaming+studio');
        assert.equal(d.intent, 'use_case');
    });

    it('detects impulse from flash sale keywords', () => {
        const d = decide('https://example.com/?q=flash+sale+limited+time+only+last+chance');
        assert.equal(d.intent, 'impulse');
    });
});

describe('LuaIntent integration — Explicit URL intent', () => {
    it('explicit ?intent= overrides scoring', () => {
        // Even though the query says "gaming", the ?intent= should win at P1
        const d = decide('https://example.com/?intent=budget&q=gaming+gaming+gaming');
        assert.equal(d.intent, 'budget');
        assert.ok(d.confidence >= 0.90);
        assert.equal(d.priority, 1); // P1
    });

    it('?intent= with unknown value falls back to scoring', () => {
        const d = decide('https://example.com/?intent=nonsense&q=buy+checkout');
        assert.notEqual(d.intent, 'nonsense');
        assert.equal(d.intent, 'buy_now'); // scoring takes over
    });
});

describe('LuaIntent integration — Default fallback', () => {
    it('returns research at low confidence for no URL signals (clock pinned)', () => {
        // Pin the clock to Wed 03 Mar 2026 07:00 UTC:
        //   hour=7  → before business hours (< 9), not late evening (< 20)
        //   day=3   → Wednesday, not weekend
        // → NO time heuristic fires at P4 → falls cleanly to P7 default
        const WED_7AM = new Date('2026-03-04T07:00:00.000Z');
        const engine = new LuaIntent({ recordHistory: false });
        const d = engine.decide({ url: 'https://example.com/', now: WED_7AM });
        assert.equal(d.intent, 'research');
        assert.ok(d.confidence <= 0.35, `Expected low confidence, got ${d.confidence}`);
        assert.equal(d.priority, 7); // P7 fallback
    });
});

describe('LuaIntent integration — IntentDecision shape', () => {
    it('always returns required fields', () => {
        const d = decide('https://example.com/?q=buy+now');
        assert.ok(typeof d.intent === 'string', 'intent should be string');
        assert.ok(typeof d.confidence === 'number', 'confidence should be number');
        assert.ok(typeof d.reason === 'string' && d.reason.length > 0, 'reason should be non-empty string');
        assert.ok(typeof d.source === 'string', 'source should be string');
        assert.ok(typeof d.priority === 'number', 'priority should be number');
        assert.ok(typeof d.decisionMs === 'number', 'decisionMs should be number');
        assert.ok(typeof d.sessionId === 'string', 'sessionId should be string');
        assert.ok(typeof d.aiUsed === 'boolean', 'aiUsed should be boolean');
        assert.ok(d.scores && typeof d.scores === 'object', 'scores should be an object');
    });

    it('confidence is always in [0, 1]', () => {
        const urls = [
            'https://example.com/',
            'https://example.com/?q=buy+now+checkout+order+purchase',
            'https://example.com/?intent=compare',
            'https://example.com/?q=gaming+gaming+gaming+gaming',
        ];
        for (const url of urls) {
            const d = decide(url);
            assert.ok(d.confidence >= 0 && d.confidence <= 1,
                `Confidence out of range for ${url}: ${d.confidence}`);
        }
    });

    it('signals field is undefined in non-debug mode', () => {
        const d = decide('https://example.com/');
        assert.equal(d.signals, undefined);
    });

    it('signals field is populated in debug mode', () => {
        const engine = new LuaIntent({ debug: true, recordHistory: false });
        const d = engine.decide({ url: 'https://example.com/' });
        assert.ok(d.signals && typeof d.signals === 'object', 'signals should be populated in debug mode');
    });
});

describe('LuaIntent integration — AI layer', () => {
    it('AI is not invoked when confidence is high', async () => {
        let aiCalled = false;
        const engine = new LuaIntent({
            recordHistory: false,
            ai: {
                enabled: true,
                adapter: async () => { aiCalled = true; return { intent: 'compare', confidence: 0.99 }; },
            },
        });
        await engine.decideAsync({ url: 'https://example.com/?intent=buy_now' });
        assert.equal(aiCalled, false, 'AI should not be called when confidence is high');
    });

    it('AI is invoked when confidence is below threshold', async () => {
        let aiCalled = false;
        const engine = new LuaIntent({
            recordHistory: false,
            ai: {
                enabled: true,
                adapter: async (signals, algo) => {
                    aiCalled = true;
                    return { intent: 'compare', confidence: algo.confidence + 0.20 };
                },
            },
        });
        const d = await engine.decideAsync({ url: 'https://example.com/' }); // low confidence
        assert.equal(aiCalled, true, 'AI should be called for low-confidence decisions');
        assert.equal(d.aiUsed, true);
        assert.equal(d.intent, 'compare');
    });

    it('AI failure falls back to algorithm gracefully', async () => {
        const engine = new LuaIntent({
            recordHistory: false,
            ai: {
                enabled: true,
                adapter: async () => { throw new Error('API timeout'); },
            },
        });
        const d = await engine.decideAsync({ url: 'https://example.com/' });
        // Should return the algorithmic decision without throwing
        assert.ok(typeof d.intent === 'string');
        assert.equal(d.aiUsed, false);
    });
});
