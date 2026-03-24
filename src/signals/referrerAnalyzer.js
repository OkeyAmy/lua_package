/**
 * @file referrerAnalyzer.js
 * Categorizes the HTTP referrer into a traffic source and maps it to an intent.
 *
 * Categories: search | social | email | paid | direct | other
 * Each category maps to an intent with a base confidence score.
 */

'use strict';

const { REFERRER_SOURCES, REFERRER_INTENT_MAP } = require('../config/constants');

/**
 * Analyze the HTTP referrer string.
 *
 * @param {string} [referrerHref] - Defaults to document.referrer
 * @returns {ReferrerAnalysis}
 */
function analyzeReferrer(referrerHref) {
    const href = referrerHref !== undefined
        ? referrerHref
        : safeDocumentReferrer();

    if (!href || !href.trim()) {
        return buildResult(href || '', 'direct');
    }

    const lower = href.toLowerCase();

    // Check paid first (usually contains known ad-network patterns)
    if (matchesAny(lower, REFERRER_SOURCES.paid)) {
        return buildResult(href, 'paid');
    }

    // Check UTM medium for paid indicator even if referrer doesn't match
    // (This is checked upstream in signalsCollector, but catches utm_medium=cpc here)
    if (/utm_medium=(cpc|ppc|paid|display|cpm)/i.test(href)) {
        return buildResult(href, 'paid');
    }

    // Email
    if (matchesAny(lower, REFERRER_SOURCES.email)) {
        return buildResult(href, 'email');
    }

    // Search engines
    if (matchesAny(lower, REFERRER_SOURCES.search)) {
        return buildResult(href, 'search');
    }

    // Social platforms
    if (matchesAny(lower, REFERRER_SOURCES.social)) {
        return buildResult(href, 'social');
    }

    // Something came from somewhere external, just not categorized
    return buildResult(href, 'other');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildResult(href, category) {
    const mapping = REFERRER_INTENT_MAP[category] || REFERRER_INTENT_MAP.other;
    return {
        href,
        category,
        inferredIntent: mapping.intent,
        confidence: mapping.confidence,
        coeff: mapping.coeff,
    };
}

function matchesAny(lower, patterns) {
    return patterns.some(p => lower.includes(p));
}

function safeDocumentReferrer() {
    try {
        return (typeof document !== 'undefined' && document.referrer) || '';
    } catch {
        return '';
    }
}

/**
 * @typedef {object} ReferrerAnalysis
 * @property {string} href
 * @property {'search'|'social'|'email'|'paid'|'direct'|'other'} category
 * @property {string} inferredIntent
 * @property {number} confidence  (0–1)
 * @property {number} coeff       (signal reliability coefficient)
 */

module.exports = { analyzeReferrer };
