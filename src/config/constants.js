/**
 * @file constants.js
 * Central definitions: intent types, keyword weights, signal coefficients,
 * referrer mappings, and algorithm constants.
 */

'use strict';

// ─── Intent Types ────────────────────────────────────────────────────────────

const INTENT_TYPES = {
    BUY_NOW: 'buy_now',   // Ready to purchase
    COMPARE: 'compare',   // Evaluating options side by side
    RESEARCH: 'research',  // Learning / early journey
    BUDGET: 'budget',    // Price-sensitive
    IMPULSE: 'impulse',   // Urgency / FOMO-driven
    USE_CASE: 'use_case',  // Context-specific (gaming, coding, etc.)
    BRAND: 'brand',     // Brand awareness / story
    RETURN: 'return',    // Returning / loyal user
};

// ─── URL Keyword Scoring Rules ────────────────────────────────────────────────
// Each rule matches text from: ?q=, utm_campaign, utm_term, path segments.
// score[intent] += weight × matchCount

const URL_RULES = [
    {
        id: 'buy_now',
        intent: INTENT_TYPES.BUY_NOW,
        re: /\b(buy|purchase|order|checkout|pricing|subscribe|book now|in stock|add to cart|get started|sign up|start free|free trial)\b/g,
        weight: 3.0,
    },
    {
        id: 'compare',
        intent: INTENT_TYPES.COMPARE,
        re: /\b(compare|vs|versus|alternative|alternatives|best|benchmark|ranked|top|review|reviews|top \d+)\b/g,
        weight: 2.5,
    },
    {
        id: 'budget',
        intent: INTENT_TYPES.BUDGET,
        re: /\b(cheap|budget|affordable|discount|deal|coupon|promo|low price|under \$?\d+|save|clearance|bargain)\b/g,
        weight: 2.5,
    },
    {
        id: 'use_case',
        intent: INTENT_TYPES.USE_CASE,
        re: /\b(gaming|game|esports|coding|programming|developer|design|creative|office|work|productivity|streaming|editing|creator|studio|startup)\b/g,
        weight: 2.2,
    },
    {
        id: 'impulse',
        intent: INTENT_TYPES.IMPULSE,
        re: /\b(limited time|today only|last chance|flash sale|ends soon|only \d+ left|exclusive|drop|hurry|urgent)\b/g,
        weight: 2.1,
    },
    {
        id: 'research',
        intent: INTENT_TYPES.RESEARCH,
        re: /\b(how to|guide|what is|features|specs|documentation|tutorial|learn|overview|explained|introduction)\b/g,
        weight: 2.0,
    },
    {
        id: 'brand',
        intent: INTENT_TYPES.BRAND,
        re: /\b(about|our story|mission|values|team|founded|history|who we are|culture|blog)\b/g,
        weight: 1.8,
    },
];

// ─── Signal Coefficients (α weights) ──────────────────────────────────────────
// These control how much each signal layer contributes to the final score.
// Must sum to approximately 1.0.

const SIGNAL_COEFFICIENTS = {
    url: 0.45,  // Explicit user intent (strongest signal)
    referrer: 0.20,  // Traffic source tells us a lot
    behavior: 0.15,  // How they act once on the page
    history: 0.12,  // Returning visitor patterns
    time: 0.05,  // Time-of-day heuristic (weakest)
    device: 0.03,  // Device type alone is very weak
};

// ─── Referrer → Intent Mapping ────────────────────────────────────────────────

const REFERRER_SOURCES = {
    search: ['google.', 'bing.', 'yahoo.', 'duckduckgo.', 'baidu.', 'yandex.', 'ecosia.'],
    social: ['facebook.com', 'fb.com', 'twitter.com', 't.co', 'x.com', 'instagram.com',
        'linkedin.com', 'pinterest.', 'tiktok.com', 'youtube.com', 'youtu.be',
        'reddit.com', 'snapchat.com', 'threads.net'],
    email: ['mail.', 'gmail.', 'mailchi.mp', 'mailchimp.', 'sendgrid.', 'klaviyo.',
        'hubspot.', 'marketo.', 'campaign-', 'newsletter'],
    paid: ['googleadservices', 'googlesyndication', 'doubleclick', 'bing.com/click',
        'facebook.com/ads', 'fbclickid'],
};

const REFERRER_INTENT_MAP = {
    search: { intent: INTENT_TYPES.RESEARCH, confidence: 0.45, coeff: 0.80 },
    social: { intent: INTENT_TYPES.IMPULSE, confidence: 0.40, coeff: 0.70 },
    email: { intent: INTENT_TYPES.BUY_NOW, confidence: 0.50, coeff: 0.85 },
    paid: { intent: INTENT_TYPES.BUY_NOW, confidence: 0.55, coeff: 0.90 },
    direct: { intent: INTENT_TYPES.RETURN, confidence: 0.40, coeff: 0.75 },
    other: { intent: INTENT_TYPES.RESEARCH, confidence: 0.25, coeff: 0.50 },
};

// ─── Behavior Scoring Biases ──────────────────────────────────────────────────
// High engagement → compare/research. Low engagement → impulse (bounce risk).

const BEHAVIOR_INTENT_BIAS = {
    // multiplier applied to behaviorScore per intent when engagement is high
    high: {
        [INTENT_TYPES.COMPARE]: 1.4,
        [INTENT_TYPES.RESEARCH]: 1.3,
        [INTENT_TYPES.BUY_NOW]: 1.1,
        [INTENT_TYPES.BUDGET]: 1.0,
        [INTENT_TYPES.USE_CASE]: 1.0,
        [INTENT_TYPES.BRAND]: 1.2,
        [INTENT_TYPES.IMPULSE]: 0.6,
        [INTENT_TYPES.RETURN]: 1.1,
    },
    low: {
        [INTENT_TYPES.IMPULSE]: 1.5,
        [INTENT_TYPES.BUY_NOW]: 0.8,
        [INTENT_TYPES.COMPARE]: 0.6,
        [INTENT_TYPES.RESEARCH]: 0.5,
        [INTENT_TYPES.BUDGET]: 1.0,
        [INTENT_TYPES.USE_CASE]: 0.8,
        [INTENT_TYPES.BRAND]: 0.7,
        [INTENT_TYPES.RETURN]: 0.9,
    },
};

// ─── Time-of-Day Heuristics ───────────────────────────────────────────────────

const TIME_PATTERNS = [
    // Weekday business hours → research / compare
    {
        test: (h, d) => ![0, 6].includes(d) && h >= 9 && h <= 17,
        intent: INTENT_TYPES.RESEARCH,
        confidence: 0.35,
    },
    // Late evening → impulse (tired, scrolling)
    {
        test: (h) => h >= 20 || h <= 1,
        intent: INTENT_TYPES.IMPULSE,
        confidence: 0.33,
    },
    // Weekend midday → buy_now (leisurely shopping)
    {
        test: (h, d) => [0, 6].includes(d) && h >= 11 && h <= 16,
        intent: INTENT_TYPES.BUY_NOW,
        confidence: 0.32,
    },
];

// ─── Device Heuristics ────────────────────────────────────────────────────────

const DEVICE_INTENT_MAP = {
    mobile: { intent: INTENT_TYPES.IMPULSE, confidence: 0.31 },
    tablet: { intent: INTENT_TYPES.RESEARCH, confidence: 0.28 },
    desktop: { intent: INTENT_TYPES.COMPARE, confidence: 0.30 },
};

// ─── Algorithm Constants ──────────────────────────────────────────────────────

const ALGORITHM = {
    // Confidence formula: clamp(0.4 + min(0.55, score / SCORE_SCALE), 0, 1)
    CONFIDENCE_BASE: 0.40,
    CONFIDENCE_MAX_ADD: 0.55,
    SCORE_SCALE: 10,

    // Separation: how much the #1 and #2 intent differ
    // finalConf = confidence × (SEP_BASE + SEP_WEIGHT × separation)
    SEP_BASE: 0.70,
    SEP_WEIGHT: 0.30,

    // AI layer: only invoked when finalConf < this threshold
    AI_THRESHOLD: 0.50,

    // AI wins over algorithm only if it improves confidence by this margin
    AI_WIN_MARGIN: 0.15,

    // Default intent when nothing matches
    DEFAULT_INTENT: INTENT_TYPES.RESEARCH,
    DEFAULT_CONFIDENCE: 0.30,

    // History decay: recency-weighted (1/(position+1))
    HISTORY_MAX_VISITS: 10,
};

// ─── Priority Waterfall Levels ────────────────────────────────────────────────

const PRIORITY = {
    PERSONA_OVERRIDE: 0,   // Explicit ?persona= URL param
    URL_EXPLICIT: 1,   // ?intent= or high-confidence URL scoring (>= 0.80)
    URL_INFERRED: 2,   // URL scoring + referrer combined
    BEHAVIOR_HEAVY: 3,   // Engagement score is high enough to be decisive
    TIME_DEVICE: 4,   // Time-of-day + device type heuristics
    HISTORY_PATTERN: 5,   // Returning visitor pattern from localStorage
    AI_AUGMENT: 6,   // AI layer (only when conf < AI_THRESHOLD)
    DEFAULT_FALLBACK: 7,   // research @ 0.30
};

// ─── URL Param Keys ───────────────────────────────────────────────────────────

const INTENT_PARAM_KEYS = ['intent', 'lua_intent', 'aura_intent', 'utm_intent'];
const SEARCH_QUERY_KEYS = ['q', 'query', 's', 'search', 'term', 'utm_term', 'keyword'];
const PERSONA_PARAM_KEYS = ['persona', 'lua_persona'];

module.exports = {
    INTENT_TYPES,
    URL_RULES,
    SIGNAL_COEFFICIENTS,
    REFERRER_SOURCES,
    REFERRER_INTENT_MAP,
    BEHAVIOR_INTENT_BIAS,
    TIME_PATTERNS,
    DEVICE_INTENT_MAP,
    ALGORITHM,
    PRIORITY,
    INTENT_PARAM_KEYS,
    SEARCH_QUERY_KEYS,
    PERSONA_PARAM_KEYS,
};
