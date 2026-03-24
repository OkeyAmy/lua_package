/**
 * @file referrerAnalyzer.test.js
 * Unit tests for src/signals/referrerAnalyzer.js
 *
 * Run: node --test src/__tests__/referrerAnalyzer.test.js
 */

'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { analyzeReferrer } = require('../signals/referrerAnalyzer');

describe('analyzeReferrer()', () => {
    it('returns direct for empty referrer', () => {
        const r = analyzeReferrer('');
        assert.equal(r.category, 'direct');
        assert.equal(r.inferredIntent, 'return');
    });

    it('detects Google as search', () => {
        const r = analyzeReferrer('https://www.google.com/search?q=monitor');
        assert.equal(r.category, 'search');
        assert.equal(r.inferredIntent, 'research');
    });

    it('detects Bing as search', () => {
        const r = analyzeReferrer('https://www.bing.com/search?q=cheap+gaming');
        assert.equal(r.category, 'search');
    });

    it('detects Facebook as social', () => {
        const r = analyzeReferrer('https://www.facebook.com/ad12345');
        assert.equal(r.category, 'social');
        assert.equal(r.inferredIntent, 'impulse');
    });

    it('detects Twitter/X as social', () => {
        const r = analyzeReferrer('https://t.co/somelink');
        assert.equal(r.category, 'social');
    });

    it('detects Reddit as social', () => {
        const r = analyzeReferrer('https://www.reddit.com/r/monitors');
        assert.equal(r.category, 'social');
    });

    it('detects email newsletter as email', () => {
        const r = analyzeReferrer('https://mailchi.mp/newsletter/issue123');
        assert.equal(r.category, 'email');
        assert.equal(r.inferredIntent, 'buy_now');
    });

    it('returns higher confidence for paid traffic', () => {
        const r = analyzeReferrer('https://googleadservices.com/pagead/aclk?sa=L&ai=DChcSE...');
        assert.equal(r.category, 'paid');
        assert.ok(r.confidence >= 0.50, `Expected >= 0.50 confidence for paid, got ${r.confidence}`);
    });

    it('returns coeff for all categories', () => {
        const categories = ['https://google.com/', 'https://facebook.com/', '', 'https://mailchi.mp/'];
        for (const href of categories) {
            const r = analyzeReferrer(href);
            assert.ok(typeof r.coeff === 'number', `coeff should be a number for ${href}`);
            assert.ok(r.coeff > 0 && r.coeff <= 1, `coeff out of range for ${href}`);
        }
    });
});
