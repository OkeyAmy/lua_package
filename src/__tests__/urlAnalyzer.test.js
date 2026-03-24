/**
 * @file urlAnalyzer.test.js
 * Unit tests for src/signals/urlAnalyzer.js
 *
 * Run: node --test src/__tests__/urlAnalyzer.test.js
 */

'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { analyzeUrl, scoreText } = require('../signals/urlAnalyzer');

// ─── scoreText ────────────────────────────────────────────────────────────────

describe('scoreText()', () => {
    it('returns empty scores for blank text', () => {
        const { scores, matchedPatterns } = scoreText('');
        assert.deepEqual(scores, {});
        assert.deepEqual(matchedPatterns, []);
    });

    it('scores buy_now keywords correctly', () => {
        const { scores } = scoreText('buy now checkout order purchase');
        assert.ok(scores['buy_now'] > 0, 'buy_now should have a positive score');
        const topIntent = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
        assert.equal(topIntent, 'buy_now');
    });

    it('scores compare keywords correctly', () => {
        const { scores } = scoreText('best monitor vs alternative benchmark');
        assert.ok(scores['compare'] > 0);
    });

    it('accumulates scores for multiple keyword matches', () => {
        const { scores } = scoreText('cheap budget discount affordable deal');
        // "cheap", "budget", "discount", "affordable", "deal" — all budget words
        assert.ok(scores['budget'] > 5, `budget score should be high, got ${scores['budget']}`);
    });

    it('handles multi-intent text and picks the strongest', () => {
        // 3 gaming words vs 1 compare word
        const { scores } = scoreText('gaming setup streaming esports vs');
        const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
        assert.equal(top, 'use_case', `Expected use_case to win, got ${top}`);
    });

    it('returns all matched patterns', () => {
        const { matchedPatterns } = scoreText('gaming buy');
        assert.ok(matchedPatterns.length >= 2, 'should have at least 2 pattern entries');
    });
});

// ─── analyzeUrl ───────────────────────────────────────────────────────────────

describe('analyzeUrl()', () => {
    it('detects explicit ?intent= parameter', () => {
        const result = analyzeUrl('https://example.com/?intent=buy_now');
        assert.equal(result.explicitIntent, 'buy_now');
        assert.ok(result.confidence >= 0.90, `confidence should be >= 0.90, got ${result.confidence}`);
    });

    it('rejects unknown explicit intent values', () => {
        const result = analyzeUrl('https://example.com/?intent=nonsense');
        assert.equal(result.explicitIntent, null);
    });

    it('infers compare intent from ?q= search query', () => {
        const result = analyzeUrl('https://example.com/?q=best+gaming+monitor+vs+2026');
        assert.ok(result.inferredIntent === 'compare' || result.inferredIntent === 'use_case',
            `Got unexpected intent: ${result.inferredIntent}`);
        assert.ok(result.confidence > 0.4);
    });

    it('infers budget intent from ?q= search query', () => {
        const result = analyzeUrl('https://example.com/?q=cheap+budget+144hz+monitor+deal');
        assert.equal(result.inferredIntent, 'budget');
        assert.ok(result.confidence > 0.5);
    });

    it('extracts UTM params into utm object', () => {
        const result = analyzeUrl('https://example.com/?utm_source=google&utm_campaign=gaming-sale');
        assert.equal(result.utm.utm_source, 'google');
        assert.equal(result.utm.utm_campaign, 'gaming-sale');
    });

    it('returns zero confidence for a blank URL', () => {
        const result = analyzeUrl('https://example.com/');
        assert.equal(result.inferredIntent, null);
        assert.equal(result.confidence, 0);
    });

    it('detects persona override from URL', () => {
        const result = analyzeUrl('https://example.com/?persona=gaming');
        assert.equal(result.personaOverride, 'gaming');
    });

    it('scores utm_campaign text for intent', () => {
        const result = analyzeUrl('https://example.com/?utm_campaign=gaming+sale+limited+time');
        assert.ok(result.inferredIntent !== null, 'should infer an intent from utm_campaign');
        assert.ok(result.confidence > 0.4);
    });
});
