/**
 * @file urlAnalyzer.js
 * Weighted multi-keyword scoring of URL signals (query params, UTM, path).
 *
 * Algorithm:
 *   1. Extract search text from ?q=, utm_term, path segments
 *   2. For each keyword rule, count matches and accumulate:
 *        score[intent] += weight × matchCount
 *   3. Pick top intent, compute confidence + separation
 *   4. Check for explicit ?intent= override (confidence → 0.90+)
 */

'use strict';

const {
    INTENT_TYPES,
    URL_RULES,
    ALGORITHM,
    INTENT_PARAM_KEYS,
    SEARCH_QUERY_KEYS,
    PERSONA_PARAM_KEYS,
} = require('../config/constants');

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyze a URL and return a typed URLAnalysis object.
 *
 * @param {string|URL} [inputUrl] - Defaults to window.location.href
 * @returns {URLAnalysis}
 */
function analyzeUrl(inputUrl) {
    const url = toURL(inputUrl);
    const query = Object.fromEntries(url.searchParams.entries());
    const utm = extractUTM(query);

    // Explicit intent override (?intent=buy_now)
    const explicitIntent = readFirstMatch(query, INTENT_PARAM_KEYS, knownIntent);

    // Persona override (?persona=gaming)
    const personaOverride = readFirstMatch(query, PERSONA_PARAM_KEYS, s => s || null);

    // Gather all text to score
    const rawText = [
        readFirstMatch(query, SEARCH_QUERY_KEYS, s => s),
        utm.utm_term,
        utm.utm_campaign,
        extractPathWords(url.pathname),
    ].filter(Boolean).join(' ');

    const { scores, matchedPatterns } = scoreText(rawText);
    const { topIntent, topScore, secondScore } = getTopTwo(scores);

    let confidence = 0;
    let inferredIntent = null;

    if (topIntent) {
        confidence = confidenceFromScore(topScore);
        const sep = separation(topScore, secondScore);
        confidence = confidence * (ALGORITHM.SEP_BASE + ALGORITHM.SEP_WEIGHT * sep);
        confidence = clamp01(confidence);
        inferredIntent = topIntent;
    }

    // Explicit intent overrides everything and bumps confidence
    if (explicitIntent) {
        return {
            href: url.href,
            query,
            utm,
            explicitIntent,
            inferredIntent: inferredIntent || explicitIntent,
            personaOverride,
            scores,
            confidence: Math.max(0.90, confidence),
            matchedPatterns: matchedPatterns.length ? matchedPatterns : ['explicit_intent_param'],
            rawText,
        };
    }

    return {
        href: url.href,
        query,
        utm,
        explicitIntent: null,
        inferredIntent,
        personaOverride,
        scores,
        confidence,
        matchedPatterns,
        rawText,
    };
}

/**
 * Score arbitrary text (search query, UTM term, etc.) against keyword rules.
 * Returns a score map per intent and matched pattern labels.
 *
 * @param {string} text
 * @returns {{ scores: Record<string, number>, matchedPatterns: string[] }}
 */
function scoreText(text) {
    const t = String(text || '').toLowerCase();
    const scores = {};
    const matched = [];

    if (!t.trim()) return { scores, matchedPatterns: [] };

    for (const rule of URL_RULES) {
        // Reset lastIndex on global regex before each match
        rule.re.lastIndex = 0;
        const hits = (t.match(rule.re) || []).length;
        if (hits > 0) {
            scores[rule.intent] = (scores[rule.intent] || 0) + rule.weight * hits;
            matched.push(`${rule.id}(${hits})`);
        }
    }

    return { scores, matchedPatterns: matched };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractUTM(query) {
    const utm = {};
    for (const [k, v] of Object.entries(query)) {
        if (k.toLowerCase().startsWith('utm_')) utm[k.toLowerCase()] = v;
    }
    return utm;
}

function extractPathWords(pathname) {
    return (pathname || '')
        .split('/')
        .join(' ')
        .replace(/[-_]/g, ' ')
        .trim();
}

function readFirstMatch(query, keys, transform) {
    const lower = Object.fromEntries(
        Object.entries(query).map(([k, v]) => [k.toLowerCase(), v])
    );
    for (const k of keys) {
        const v = lower[k.toLowerCase()];
        if (v != null && String(v).trim() !== '') {
            const result = transform ? transform(String(v).trim()) : String(v).trim();
            if (result) return result;
        }
    }
    return null;
}

function knownIntent(v) {
    const s = String(v).toLowerCase().trim();
    return Object.values(INTENT_TYPES).includes(s) ? s : null;
}

function getTopTwo(scores) {
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const topIntent = entries[0]?.[0] || null;
    const topScore = entries[0]?.[1] || 0;
    const secondScore = entries[1]?.[1] || 0;
    return { topIntent, topScore, secondScore };
}

function confidenceFromScore(score) {
    return clamp01(ALGORITHM.CONFIDENCE_BASE + Math.min(ALGORITHM.CONFIDENCE_MAX_ADD, score / ALGORITHM.SCORE_SCALE));
}

function separation(top, second) {
    if (top <= 0) return 0;
    return clamp01((top - second) / top);
}

function clamp01(v) {
    return Math.max(0, Math.min(1, Number(v) || 0));
}

function toURL(input) {
    if (input instanceof URL) return input;
    if (typeof input === 'string' && input) {
        try { return new URL(input); } catch { /* fall through */ }
        try { return new URL(input, 'https://example.test'); } catch { /* fall through */ }
    }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.location?.href) {
            return new URL(globalThis.location.href);
        }
    } catch { /* fall through */ }
    return new URL('https://example.test/');
}

/**
 * @typedef {object} URLAnalysis
 * @property {string} href
 * @property {Record<string, string>} query
 * @property {Record<string, string>} utm
 * @property {string|null} explicitIntent
 * @property {string|null} inferredIntent
 * @property {string|null} personaOverride
 * @property {Record<string, number>} scores
 * @property {number} confidence
 * @property {string[]} matchedPatterns
 * @property {string} rawText
 */

module.exports = { analyzeUrl, scoreText };
