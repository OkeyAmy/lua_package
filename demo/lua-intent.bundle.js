(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/config/constants.js
  var require_constants = __commonJS({
    "src/config/constants.js"(exports, module) {
      "use strict";
      var INTENT_TYPES = {
        BUY_NOW: "buy_now",
        // Ready to purchase
        COMPARE: "compare",
        // Evaluating options side by side
        RESEARCH: "research",
        // Learning / early journey
        BUDGET: "budget",
        // Price-sensitive
        IMPULSE: "impulse",
        // Urgency / FOMO-driven
        USE_CASE: "use_case",
        // Context-specific (gaming, coding, etc.)
        BRAND: "brand",
        // Brand awareness / story
        RETURN: "return"
        // Returning / loyal user
      };
      var URL_RULES = [
        {
          id: "buy_now",
          intent: INTENT_TYPES.BUY_NOW,
          re: /\b(buy|purchase|order|checkout|pricing|subscribe|book now|in stock|add to cart|get started|sign up|start free|free trial)\b/g,
          weight: 3
        },
        {
          id: "compare",
          intent: INTENT_TYPES.COMPARE,
          re: /\b(compare|vs|versus|alternative|alternatives|best|benchmark|ranked|top|review|reviews|top \d+)\b/g,
          weight: 2.5
        },
        {
          id: "budget",
          intent: INTENT_TYPES.BUDGET,
          re: /\b(cheap|budget|affordable|discount|deal|coupon|promo|low price|under \$?\d+|save|clearance|bargain)\b/g,
          weight: 2.5
        },
        {
          id: "use_case",
          intent: INTENT_TYPES.USE_CASE,
          re: /\b(gaming|game|esports|coding|programming|developer|design|creative|office|work|productivity|streaming|editing|creator|studio|startup)\b/g,
          weight: 2.2
        },
        {
          id: "impulse",
          intent: INTENT_TYPES.IMPULSE,
          re: /\b(limited time|today only|last chance|flash sale|ends soon|only \d+ left|exclusive|drop|hurry|urgent)\b/g,
          weight: 2.1
        },
        {
          id: "research",
          intent: INTENT_TYPES.RESEARCH,
          re: /\b(how to|guide|what is|features|specs|documentation|tutorial|learn|overview|explained|introduction)\b/g,
          weight: 2
        },
        {
          id: "brand",
          intent: INTENT_TYPES.BRAND,
          re: /\b(about|our story|mission|values|team|founded|history|who we are|culture|blog)\b/g,
          weight: 1.8
        }
      ];
      var SIGNAL_COEFFICIENTS = {
        url: 0.45,
        // Explicit user intent (strongest signal)
        referrer: 0.2,
        // Traffic source tells us a lot
        behavior: 0.15,
        // How they act once on the page
        history: 0.12,
        // Returning visitor patterns
        time: 0.05,
        // Time-of-day heuristic (weakest)
        device: 0.03
        // Device type alone is very weak
      };
      var REFERRER_SOURCES = {
        search: ["google.", "bing.", "yahoo.", "duckduckgo.", "baidu.", "yandex.", "ecosia."],
        social: [
          "facebook.com",
          "fb.com",
          "twitter.com",
          "t.co",
          "x.com",
          "instagram.com",
          "linkedin.com",
          "pinterest.",
          "tiktok.com",
          "youtube.com",
          "youtu.be",
          "reddit.com",
          "snapchat.com",
          "threads.net"
        ],
        email: [
          "mail.",
          "gmail.",
          "mailchi.mp",
          "mailchimp.",
          "sendgrid.",
          "klaviyo.",
          "hubspot.",
          "marketo.",
          "campaign-",
          "newsletter"
        ],
        paid: [
          "googleadservices",
          "googlesyndication",
          "doubleclick",
          "bing.com/click",
          "facebook.com/ads",
          "fbclickid"
        ]
      };
      var REFERRER_INTENT_MAP = {
        search: { intent: INTENT_TYPES.RESEARCH, confidence: 0.45, coeff: 0.8 },
        social: { intent: INTENT_TYPES.IMPULSE, confidence: 0.4, coeff: 0.7 },
        email: { intent: INTENT_TYPES.BUY_NOW, confidence: 0.5, coeff: 0.85 },
        paid: { intent: INTENT_TYPES.BUY_NOW, confidence: 0.55, coeff: 0.9 },
        direct: { intent: INTENT_TYPES.RETURN, confidence: 0.4, coeff: 0.75 },
        other: { intent: INTENT_TYPES.RESEARCH, confidence: 0.25, coeff: 0.5 }
      };
      var BEHAVIOR_INTENT_BIAS = {
        // multiplier applied to behaviorScore per intent when engagement is high
        high: {
          [INTENT_TYPES.COMPARE]: 1.4,
          [INTENT_TYPES.RESEARCH]: 1.3,
          [INTENT_TYPES.BUY_NOW]: 1.1,
          [INTENT_TYPES.BUDGET]: 1,
          [INTENT_TYPES.USE_CASE]: 1,
          [INTENT_TYPES.BRAND]: 1.2,
          [INTENT_TYPES.IMPULSE]: 0.6,
          [INTENT_TYPES.RETURN]: 1.1
        },
        low: {
          [INTENT_TYPES.IMPULSE]: 1.5,
          [INTENT_TYPES.BUY_NOW]: 0.8,
          [INTENT_TYPES.COMPARE]: 0.6,
          [INTENT_TYPES.RESEARCH]: 0.5,
          [INTENT_TYPES.BUDGET]: 1,
          [INTENT_TYPES.USE_CASE]: 0.8,
          [INTENT_TYPES.BRAND]: 0.7,
          [INTENT_TYPES.RETURN]: 0.9
        }
      };
      var TIME_PATTERNS = [
        // Weekday business hours → research / compare
        {
          test: (h, d) => ![0, 6].includes(d) && h >= 9 && h <= 17,
          intent: INTENT_TYPES.RESEARCH,
          confidence: 0.35
        },
        // Late evening → impulse (tired, scrolling)
        {
          test: (h) => h >= 20 || h <= 1,
          intent: INTENT_TYPES.IMPULSE,
          confidence: 0.33
        },
        // Weekend midday → buy_now (leisurely shopping)
        {
          test: (h, d) => [0, 6].includes(d) && h >= 11 && h <= 16,
          intent: INTENT_TYPES.BUY_NOW,
          confidence: 0.32
        }
      ];
      var DEVICE_INTENT_MAP = {
        mobile: { intent: INTENT_TYPES.IMPULSE, confidence: 0.31 },
        tablet: { intent: INTENT_TYPES.RESEARCH, confidence: 0.28 },
        desktop: { intent: INTENT_TYPES.COMPARE, confidence: 0.3 }
      };
      var ALGORITHM = {
        // Confidence formula: clamp(0.4 + min(0.55, score / SCORE_SCALE), 0, 1)
        CONFIDENCE_BASE: 0.4,
        CONFIDENCE_MAX_ADD: 0.55,
        SCORE_SCALE: 10,
        // Separation: how much the #1 and #2 intent differ
        // finalConf = confidence × (SEP_BASE + SEP_WEIGHT × separation)
        SEP_BASE: 0.7,
        SEP_WEIGHT: 0.3,
        // AI layer: only invoked when finalConf < this threshold
        AI_THRESHOLD: 0.5,
        // AI wins over algorithm only if it improves confidence by this margin
        AI_WIN_MARGIN: 0.15,
        // Default intent when nothing matches
        DEFAULT_INTENT: INTENT_TYPES.RESEARCH,
        DEFAULT_CONFIDENCE: 0.3,
        // History decay: recency-weighted (1/(position+1))
        HISTORY_MAX_VISITS: 10
      };
      var PRIORITY = {
        PERSONA_OVERRIDE: 0,
        // Explicit ?persona= URL param
        URL_EXPLICIT: 1,
        // ?intent= or high-confidence URL scoring (>= 0.80)
        URL_INFERRED: 2,
        // URL scoring + referrer combined
        BEHAVIOR_HEAVY: 3,
        // Engagement score is high enough to be decisive
        TIME_DEVICE: 4,
        // Time-of-day + device type heuristics
        HISTORY_PATTERN: 5,
        // Returning visitor pattern from localStorage
        AI_AUGMENT: 6,
        // AI layer (only when conf < AI_THRESHOLD)
        DEFAULT_FALLBACK: 7
        // research @ 0.30
      };
      var INTENT_PARAM_KEYS = ["intent", "lua_intent", "aura_intent", "utm_intent"];
      var SEARCH_QUERY_KEYS = ["q", "query", "s", "search", "term", "utm_term", "keyword"];
      var PERSONA_PARAM_KEYS = ["persona", "lua_persona"];
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
        PERSONA_PARAM_KEYS
      };
    }
  });

  // src/signals/urlAnalyzer.js
  var require_urlAnalyzer = __commonJS({
    "src/signals/urlAnalyzer.js"(exports, module) {
      "use strict";
      var {
        INTENT_TYPES,
        URL_RULES,
        ALGORITHM,
        INTENT_PARAM_KEYS,
        SEARCH_QUERY_KEYS,
        PERSONA_PARAM_KEYS
      } = require_constants();
      function analyzeUrl(inputUrl) {
        const url = toURL(inputUrl);
        const query = Object.fromEntries(url.searchParams.entries());
        const utm = extractUTM(query);
        const explicitIntent = readFirstMatch(query, INTENT_PARAM_KEYS, knownIntent);
        const personaOverride = readFirstMatch(query, PERSONA_PARAM_KEYS, (s) => s || null);
        const rawText = [
          readFirstMatch(query, SEARCH_QUERY_KEYS, (s) => s),
          utm.utm_term,
          utm.utm_campaign,
          extractPathWords(url.pathname)
        ].filter(Boolean).join(" ");
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
        if (explicitIntent) {
          return {
            href: url.href,
            query,
            utm,
            explicitIntent,
            inferredIntent: inferredIntent || explicitIntent,
            personaOverride,
            scores,
            confidence: Math.max(0.9, confidence),
            matchedPatterns: matchedPatterns.length ? matchedPatterns : ["explicit_intent_param"],
            rawText
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
          rawText
        };
      }
      function scoreText(text) {
        const t = String(text || "").toLowerCase();
        const scores = {};
        const matched = [];
        if (!t.trim()) return { scores, matchedPatterns: [] };
        for (const rule of URL_RULES) {
          rule.re.lastIndex = 0;
          const hits = (t.match(rule.re) || []).length;
          if (hits > 0) {
            scores[rule.intent] = (scores[rule.intent] || 0) + rule.weight * hits;
            matched.push(`${rule.id}(${hits})`);
          }
        }
        return { scores, matchedPatterns: matched };
      }
      function extractUTM(query) {
        const utm = {};
        for (const [k, v] of Object.entries(query)) {
          if (k.toLowerCase().startsWith("utm_")) utm[k.toLowerCase()] = v;
        }
        return utm;
      }
      function extractPathWords(pathname) {
        return (pathname || "").split("/").join(" ").replace(/[-_]/g, " ").trim();
      }
      function readFirstMatch(query, keys, transform) {
        const lower = Object.fromEntries(
          Object.entries(query).map(([k, v]) => [k.toLowerCase(), v])
        );
        for (const k of keys) {
          const v = lower[k.toLowerCase()];
          if (v != null && String(v).trim() !== "") {
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
        if (typeof input === "string" && input) {
          try {
            return new URL(input);
          } catch {
          }
          try {
            return new URL(input, "https://example.test");
          } catch {
          }
        }
        try {
          if (typeof globalThis !== "undefined" && globalThis.location?.href) {
            return new URL(globalThis.location.href);
          }
        } catch {
        }
        return new URL("https://example.test/");
      }
      module.exports = { analyzeUrl, scoreText };
    }
  });

  // src/signals/referrerAnalyzer.js
  var require_referrerAnalyzer = __commonJS({
    "src/signals/referrerAnalyzer.js"(exports, module) {
      "use strict";
      var { REFERRER_SOURCES, REFERRER_INTENT_MAP } = require_constants();
      function analyzeReferrer(referrerHref) {
        const href = referrerHref !== void 0 ? referrerHref : safeDocumentReferrer();
        if (!href || !href.trim()) {
          return buildResult(href || "", "direct");
        }
        const lower = href.toLowerCase();
        if (matchesAny(lower, REFERRER_SOURCES.paid)) {
          return buildResult(href, "paid");
        }
        if (/utm_medium=(cpc|ppc|paid|display|cpm)/i.test(href)) {
          return buildResult(href, "paid");
        }
        if (matchesAny(lower, REFERRER_SOURCES.email)) {
          return buildResult(href, "email");
        }
        if (matchesAny(lower, REFERRER_SOURCES.search)) {
          return buildResult(href, "search");
        }
        if (matchesAny(lower, REFERRER_SOURCES.social)) {
          return buildResult(href, "social");
        }
        return buildResult(href, "other");
      }
      function buildResult(href, category) {
        const mapping = REFERRER_INTENT_MAP[category] || REFERRER_INTENT_MAP.other;
        return {
          href,
          category,
          inferredIntent: mapping.intent,
          confidence: mapping.confidence,
          coeff: mapping.coeff
        };
      }
      function matchesAny(lower, patterns) {
        return patterns.some((p) => lower.includes(p));
      }
      function safeDocumentReferrer() {
        try {
          return typeof document !== "undefined" && document.referrer || "";
        } catch {
          return "";
        }
      }
      module.exports = { analyzeReferrer };
    }
  });

  // src/signals/behaviorAnalyzer.js
  var require_behaviorAnalyzer = __commonJS({
    "src/signals/behaviorAnalyzer.js"(exports, module) {
      "use strict";
      var FULL_ENGAGED_MS = 8e3;
      var MAX_CLICKS = 5;
      var BehaviorAnalyzer2 = class {
        /**
         * @param {{ enableListeners?: boolean }} [opts]
         */
        constructor(opts) {
          const options = opts || {};
          this._timeStart = Date.now();
          this._scrollDepth = 0;
          this._clickCount = 0;
          this._rageClicks = 0;
          this._mouseActive = false;
          this._mouseMoveCount = 0;
          this._lastClickTime = 0;
          this._listeners = [];
          if (options.enableListeners !== false) {
            this._attach();
          }
        }
        // ── Event Listeners ──────────────────────────────────────────────────────
        _attach() {
          const scrollHandler = () => {
            try {
              const doc = document.documentElement;
              const top = doc.scrollTop || document.body.scrollTop || 0;
              const max = doc.scrollHeight - doc.clientHeight;
              if (max > 0) {
                this._scrollDepth = Math.max(this._scrollDepth, Math.min(1, top / max));
              }
            } catch {
            }
          };
          const clickHandler = (e) => {
            this._clickCount++;
            const now = Date.now();
            if (now - this._lastClickTime < 300) this._rageClicks++;
            this._lastClickTime = now;
            this._mouseActive = true;
          };
          const mouseMoveHandler = () => {
            this._mouseMoveCount++;
            this._mouseActive = true;
          };
          try {
            window.addEventListener("scroll", scrollHandler, { passive: true });
            window.addEventListener("click", clickHandler, { passive: true });
            window.addEventListener("mousemove", mouseMoveHandler, { passive: true });
            this._listeners.push(
              ["scroll", scrollHandler],
              ["click", clickHandler],
              ["mousemove", mouseMoveHandler]
            );
          } catch {
          }
        }
        // ── Simulation (for tests) ────────────────────────────────────────────────
        /**
         * Simulate behavior for unit testing.
         * @param {{ timeOnPageMs?: number, scrollDepth?: number, clickCount?: number }} state
         */
        simulate(state) {
          if (state.timeOnPageMs != null) {
            this._timeStart = Date.now() - state.timeOnPageMs;
          }
          if (state.scrollDepth != null) this._scrollDepth = state.scrollDepth;
          if (state.clickCount != null) this._clickCount = state.clickCount;
        }
        // ── Snapshot ──────────────────────────────────────────────────────────────
        /**
         * Return an immutable snapshot of current behavior.
         * @returns {BehaviorSnapshot}
         */
        snapshot() {
          const timeMs = Date.now() - this._timeStart;
          const scrollDepth = this._scrollDepth;
          const clickCount = this._clickCount;
          const mouseScore = Math.min(1, this._mouseMoveCount / 100);
          const engagementScore = clamp01(
            0.45 * Math.min(1, timeMs / FULL_ENGAGED_MS) + 0.35 * scrollDepth + 0.15 * Math.min(1, clickCount / MAX_CLICKS) + 0.05 * mouseScore
          );
          return {
            timeOnPageMs: timeMs,
            scrollDepth,
            clickCount,
            rageClicks: this._rageClicks,
            mouseMovementScore: mouseScore,
            engagementScore
          };
        }
        // ── Cleanup ───────────────────────────────────────────────────────────────
        destroy() {
          try {
            for (const [event, handler] of this._listeners) {
              window.removeEventListener(event, handler);
            }
          } catch {
          }
          this._listeners = [];
        }
      };
      function clamp01(v) {
        return Math.max(0, Math.min(1, Number(v) || 0));
      }
      module.exports = { BehaviorAnalyzer: BehaviorAnalyzer2 };
    }
  });

  // src/signals/historyAnalyzer.js
  var require_historyAnalyzer = __commonJS({
    "src/signals/historyAnalyzer.js"(exports, module) {
      "use strict";
      var { ALGORITHM } = require_constants();
      var STORAGE_KEY = "lua_intent_history";
      function analyzeHistory(storage) {
        const store = storage || safeLocalStorage();
        const visits = readVisits(store);
        const scores = {};
        const frequency = {};
        const lastIntent = visits.length > 0 ? visits[0].intent : null;
        const maxVisits = Math.min(visits.length, ALGORITHM.HISTORY_MAX_VISITS);
        for (let i = 0; i < maxVisits; i++) {
          const visit = visits[i];
          const intent = visit.intent;
          if (!intent) continue;
          const weight = 1 / (i + 1);
          scores[intent] = (scores[intent] || 0) + weight;
          frequency[intent] = (frequency[intent] || 0) + 1;
        }
        const isReturning = visits.length > 1;
        const firstVisitMs = visits.length > 0 ? visits[visits.length - 1].ts || 0 : 0;
        const daysSinceFirst = firstVisitMs ? Math.floor((Date.now() - firstVisitMs) / 864e5) : 0;
        return {
          visitCount: visits.length,
          lastIntent,
          scores,
          intentFrequency: frequency,
          isReturning,
          daysSinceFirst
        };
      }
      function recordVisit(visit, storage) {
        const store = storage || safeLocalStorage();
        const visits = readVisits(store);
        visits.unshift({ intent: visit.intent, ts: Date.now() });
        if (visits.length > ALGORITHM.HISTORY_MAX_VISITS) {
          visits.length = ALGORITHM.HISTORY_MAX_VISITS;
        }
        try {
          store.setItem(STORAGE_KEY, JSON.stringify(visits));
        } catch {
        }
      }
      function clearHistory(storage) {
        const store = storage || safeLocalStorage();
        try {
          store.removeItem(STORAGE_KEY);
        } catch {
        }
      }
      function readVisits(store) {
        try {
          const raw = store.getItem(STORAGE_KEY);
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      function safeLocalStorage() {
        try {
          return typeof localStorage !== "undefined" ? localStorage : nullStorage();
        } catch {
          return nullStorage();
        }
      }
      function nullStorage() {
        const _store = {};
        return {
          getItem: (k) => _store[k] !== void 0 ? _store[k] : null,
          setItem: (k, v) => {
            _store[k] = v;
          },
          removeItem: (k) => {
            delete _store[k];
          }
        };
      }
      module.exports = { analyzeHistory, recordVisit, clearHistory };
    }
  });

  // src/signals/signalsCollector.js
  var require_signalsCollector = __commonJS({
    "src/signals/signalsCollector.js"(exports, module) {
      "use strict";
      var { analyzeUrl } = require_urlAnalyzer();
      var { analyzeReferrer } = require_referrerAnalyzer();
      var { BehaviorAnalyzer: BehaviorAnalyzer2 } = require_behaviorAnalyzer();
      var { analyzeHistory } = require_historyAnalyzer();
      function collectSignals(ctx) {
        ctx = ctx || {};
        const url = analyzeUrl(ctx.url);
        const referrer = analyzeReferrer(ctx.referrer);
        let behavior;
        if (ctx.behavior) {
          behavior = ctx.behavior;
        } else {
          const ba = new BehaviorAnalyzer2({ enableListeners: false });
          if (ctx.simulateBehavior) ba.simulate(ctx.simulateBehavior);
          behavior = ba.snapshot();
        }
        const ua = ctx.userAgent || safeUA();
        const device = detectDevice(ua);
        const now = toDate(ctx.now);
        const hour = now.getHours();
        const day = now.getDay();
        const time = {
          iso: now.toISOString(),
          hour,
          day,
          isWeekend: day === 0 || day === 6,
          isBusinessHours: ![0, 6].includes(day) && hour >= 9 && hour <= 17
        };
        const history = analyzeHistory(ctx.storage);
        const persona = { override: url.personaOverride || null };
        return { url, referrer, behavior, device: { userAgent: ua, device }, time, history, persona };
      }
      function detectDevice(ua) {
        if (!ua) return "unknown";
        const u = ua.toLowerCase();
        if (/\b(ipad|tablet|android(?!.*mobile))\b/.test(u)) return "tablet";
        if (/\b(mobile|android|iphone|ipod|blackberry|windows phone)\b/.test(u)) return "mobile";
        if (/\b(macintosh|windows nt|linux(?!.*android)|x11)\b/.test(u)) return "desktop";
        return "unknown";
      }
      function safeUA() {
        try {
          return typeof navigator !== "undefined" ? navigator.userAgent || null : null;
        } catch {
          return null;
        }
      }
      function toDate(v) {
        if (v instanceof Date) return v;
        if (typeof v === "number") return new Date(v);
        return /* @__PURE__ */ new Date();
      }
      module.exports = { collectSignals, detectDevice };
    }
  });

  // src/scoring/intentScorer.js
  var require_intentScorer = __commonJS({
    "src/scoring/intentScorer.js"(exports, module) {
      "use strict";
      var {
        INTENT_TYPES,
        BEHAVIOR_INTENT_BIAS,
        TIME_PATTERNS,
        DEVICE_INTENT_MAP,
        REFERRER_INTENT_MAP,
        ALGORITHM
      } = require_constants();
      function scoreURL(urlSignal) {
        return { ...urlSignal.scores || {} };
      }
      function scoreReferrer(refSignal) {
        if (!refSignal || !refSignal.inferredIntent) return {};
        const baseScore = refSignal.confidence * refSignal.coeff * 3;
        return { [refSignal.inferredIntent]: baseScore };
      }
      function scoreBehavior(behaviorSignal) {
        if (!behaviorSignal) return {};
        const eng = behaviorSignal.engagementScore || 0;
        const tier = eng >= 0.5 ? "high" : "low";
        const biases = BEHAVIOR_INTENT_BIAS[tier];
        const scores = {};
        for (const [intent, bias] of Object.entries(biases)) {
          scores[intent] = eng * bias * 2;
        }
        return scores;
      }
      function scoreTime(timeSignal) {
        if (!timeSignal || typeof timeSignal.hour !== "number") return {};
        for (const pattern of TIME_PATTERNS) {
          if (pattern.test(timeSignal.hour, timeSignal.day)) {
            return { [pattern.intent]: pattern.confidence * 2 };
          }
        }
        return {};
      }
      function scoreDevice(device) {
        const mapping = DEVICE_INTENT_MAP[device];
        if (!mapping) return {};
        return { [mapping.intent]: mapping.confidence * 1.5 };
      }
      function scoreHistory(historySignal) {
        if (!historySignal || !historySignal.scores) return {};
        return { ...historySignal.scores };
      }
      module.exports = { scoreURL, scoreReferrer, scoreBehavior, scoreTime, scoreDevice, scoreHistory };
    }
  });

  // src/scoring/scoreFuser.js
  var require_scoreFuser = __commonJS({
    "src/scoring/scoreFuser.js"(exports, module) {
      "use strict";
      var { SIGNAL_COEFFICIENTS, ALGORITHM } = require_constants();
      function fuse(layerScores) {
        const combined = {};
        for (const [layer, scores] of Object.entries(layerScores)) {
          const alpha = SIGNAL_COEFFICIENTS[layer] || 0;
          if (alpha === 0 || !scores) continue;
          for (const [intent, score] of Object.entries(scores)) {
            combined[intent] = (combined[intent] || 0) + alpha * score;
          }
        }
        const totalMax = Math.max(...Object.values(combined), 1e-3);
        const normalized = {};
        for (const [intent, score] of Object.entries(combined)) {
          normalized[intent] = score / totalMax;
        }
        const entries = Object.entries(combined).sort((a, b) => b[1] - a[1]);
        const topIntent = entries[0]?.[0] || null;
        const topScore = entries[0]?.[1] || 0;
        const secondIntent = entries[1]?.[0] || null;
        const secondScore = entries[1]?.[1] || 0;
        const sep = topScore > 0 ? clamp01((topScore - secondScore) / topScore) : 0;
        return {
          raw: combined,
          weighted: combined,
          // already α-weighted
          normalized,
          topIntent,
          topScore,
          secondIntent,
          secondScore,
          separation: sep
        };
      }
      function clamp01(v) {
        return Math.max(0, Math.min(1, Number(v) || 0));
      }
      module.exports = { fuse };
    }
  });

  // src/scoring/confidenceCalc.js
  var require_confidenceCalc = __commonJS({
    "src/scoring/confidenceCalc.js"(exports, module) {
      "use strict";
      var { ALGORITHM } = require_constants();
      function computeConfidence(matrix) {
        if (!matrix || !matrix.topIntent) return ALGORITHM.DEFAULT_CONFIDENCE;
        const rawConf = clamp01(
          ALGORITHM.CONFIDENCE_BASE + Math.min(ALGORITHM.CONFIDENCE_MAX_ADD, matrix.topScore / ALGORITHM.SCORE_SCALE)
        );
        const finalConf = rawConf * (ALGORITHM.SEP_BASE + ALGORITHM.SEP_WEIGHT * matrix.separation);
        return clamp01(finalConf);
      }
      function shouldInvokeAI(confidence, aiEnabled) {
        return aiEnabled === true && confidence < ALGORITHM.AI_THRESHOLD;
      }
      function clamp01(v) {
        return Math.max(0, Math.min(1, Number(v) || 0));
      }
      module.exports = { computeConfidence, shouldInvokeAI };
    }
  });

  // src/decision/priorityWaterfall.js
  var require_priorityWaterfall = __commonJS({
    "src/decision/priorityWaterfall.js"(exports, module) {
      "use strict";
      var {
        INTENT_TYPES,
        PRIORITY,
        ALGORITHM,
        DEVICE_INTENT_MAP,
        TIME_PATTERNS
      } = require_constants();
      function runWaterfall(signals, matrix, confidence) {
        const persona = signals?.persona?.override;
        if (persona) {
          const intent = mapPersonaToIntent(persona);
          if (intent) {
            return result(intent, 0.75, PRIORITY.PERSONA_OVERRIDE, "persona_override", signals);
          }
        }
        const explicitIntent = signals?.url?.explicitIntent;
        if (explicitIntent) {
          const conf = Math.max(0.9, signals?.url?.confidence || 0.9);
          return result(explicitIntent, conf, PRIORITY.URL_EXPLICIT, "url_explicit", signals);
        }
        if (matrix.topIntent && confidence >= 0.65) {
          return result(matrix.topIntent, confidence, PRIORITY.URL_INFERRED, "url_inferred", signals);
        }
        const urlIntent = signals?.url?.inferredIntent;
        const refIntent = signals?.referrer?.inferredIntent;
        if (urlIntent && refIntent && urlIntent === refIntent) {
          const boosted = Math.min(1, confidence + 0.1);
          return result(urlIntent, boosted, PRIORITY.URL_INFERRED, "url_referrer_agree", signals);
        }
        const eng = signals?.behavior?.engagementScore || 0;
        if (eng >= 0.75 && matrix.topIntent) {
          return result(matrix.topIntent, confidence, PRIORITY.BEHAVIOR_HEAVY, "behavior_heavy", signals);
        }
        const timeResult = inferFromTime(signals?.time);
        if (timeResult) {
          return result(timeResult.intent, timeResult.confidence, PRIORITY.TIME_DEVICE, "time_pattern", signals);
        }
        const deviceResult = inferFromDevice(signals?.device?.device);
        if (deviceResult) {
          return result(deviceResult.intent, deviceResult.confidence, PRIORITY.TIME_DEVICE, "device_pattern", signals);
        }
        const historyIntent = getHistoryIntent(signals?.history);
        if (historyIntent) {
          return result(historyIntent, 0.45, PRIORITY.HISTORY_PATTERN, "history_pattern", signals);
        }
        return result(ALGORITHM.DEFAULT_INTENT, ALGORITHM.DEFAULT_CONFIDENCE, PRIORITY.DEFAULT_FALLBACK, "default_fallback", signals);
      }
      function result(intent, confidence, priority, reasonKey, signals) {
        return {
          intent,
          confidence,
          priority,
          reasonKey,
          reason: buildReason(reasonKey, intent, signals)
        };
      }
      function buildReason(key, intent, signals) {
        switch (key) {
          case "persona_override": {
            const p = signals?.persona?.override || intent;
            return `Persona override "${p}" mapped to intent "${intent}".`;
          }
          case "url_explicit":
            return `Explicit ?intent=${intent} URL parameter detected.`;
          case "url_inferred": {
            const patterns = (signals?.url?.matchedPatterns || []).join(", ");
            return patterns ? `URL/UTM signals matched patterns: ${patterns}.` : "URL/UTM signals indicate intent.";
          }
          case "url_referrer_agree":
            return `URL intent and referrer source both indicate "${intent}" \u2014 combined signal.`;
          case "behavior_heavy":
            return `High engagement score (${((signals?.behavior?.engagementScore || 0) * 100).toFixed(0)}%) supports this intent.`;
          case "time_pattern":
            return "Time-of-day pattern heuristic indicates intent.";
          case "device_pattern":
            return `Device type "${signals?.device?.device}" heuristically suggests intent.`;
          case "history_pattern": {
            const count = signals?.history?.visitCount || 0;
            return `Returning visitor (${count} visits) \u2014 historical intent pattern used.`;
          }
          case "default_fallback":
          default:
            return "No strong signals detected; using default intent.";
        }
      }
      function mapPersonaToIntent(persona) {
        if (!persona) return null;
        const s = persona.toLowerCase().trim();
        if (Object.values(INTENT_TYPES).includes(s)) return s;
        if (/\b(gaming|game|esport|coding|dev|design|creative|streaming|studio)\b/.test(s)) return INTENT_TYPES.USE_CASE;
        if (/\b(buy|purchase|order)\b/.test(s)) return INTENT_TYPES.BUY_NOW;
        if (/\b(compare|vs|best|alternative)\b/.test(s)) return INTENT_TYPES.COMPARE;
        if (/\b(budget|cheap|deal)\b/.test(s)) return INTENT_TYPES.BUDGET;
        if (/\b(sale|promo|flash|limited)\b/.test(s)) return INTENT_TYPES.IMPULSE;
        return null;
      }
      function inferFromTime(time) {
        if (!time || typeof time.hour !== "number") return null;
        for (const p of TIME_PATTERNS) {
          if (p.test(time.hour, time.day)) return p;
        }
        return null;
      }
      function inferFromDevice(device) {
        return DEVICE_INTENT_MAP[device] || null;
      }
      function getHistoryIntent(history) {
        if (!history || history.visitCount < 2) return null;
        const scores = history.scores || {};
        const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        return entries[0]?.[0] || null;
      }
      module.exports = { runWaterfall };
    }
  });

  // src/LuaIntent.js
  var require_LuaIntent = __commonJS({
    "src/LuaIntent.js"(exports, module) {
      "use strict";
      var { collectSignals } = require_signalsCollector();
      var { scoreURL, scoreReferrer, scoreBehavior, scoreTime, scoreDevice, scoreHistory } = require_intentScorer();
      var { fuse } = require_scoreFuser();
      var { computeConfidence, shouldInvokeAI } = require_confidenceCalc();
      var { runWaterfall } = require_priorityWaterfall();
      var { recordVisit } = require_historyAnalyzer();
      var { ALGORITHM, PRIORITY } = require_constants();
      var LuaIntent2 = class {
        /**
         * @param {{
         *   debug?:        boolean,
         *   ai?:           { enabled: boolean, threshold?: number, adapter?: Function },
         *   storage?:      Storage,
         *   recordHistory?: boolean,
         * }} [config]
         */
        constructor(config) {
          this._config = Object.assign({
            debug: false,
            ai: { enabled: false },
            recordHistory: true
          }, config || {});
          this._version = "1.0.0";
          this._sessionId = generateSessionId();
        }
        /**
         * Collect signals and decide — the primary entry point.
         *
         * @param {{
         *   url?:              string|URL,
         *   referrer?:         string,
         *   userAgent?:        string,
         *   behavior?:         object,
         *   simulateBehavior?: object,
         *   now?:              Date|number,
         * }} [ctx]
         * @returns {IntentDecision}
         */
        decide(ctx) {
          const t0 = Date.now();
          const signals = collectSignals(Object.assign({ storage: this._config.storage }, ctx || {}));
          const layerScores = {
            url: scoreURL(signals.url),
            referrer: scoreReferrer(signals.referrer),
            behavior: scoreBehavior(signals.behavior),
            time: scoreTime(signals.time),
            device: scoreDevice(signals.device.device),
            history: scoreHistory(signals.history)
          };
          const matrix = fuse(layerScores);
          const confidence = computeConfidence(matrix);
          let waterfall = runWaterfall(signals, matrix, confidence);
          if (shouldInvokeAI(waterfall.confidence, this._config.ai?.enabled)) {
            waterfall = Object.assign({}, waterfall, {
              reason: waterfall.reason + " (AI augmentation available via decideAsync)",
              priority: PRIORITY.AI_AUGMENT
            });
          }
          const decisionMs = Date.now() - t0;
          const decision = {
            intent: waterfall.intent,
            confidence: waterfall.confidence,
            reason: waterfall.reason,
            source: waterfall.reasonKey,
            priority: waterfall.priority,
            scores: matrix,
            signals: this._config.debug ? signals : void 0,
            decisionMs,
            sessionId: this._sessionId,
            aiUsed: false,
            version: this._version
          };
          if (this._config.recordHistory) {
            try {
              recordVisit({ intent: decision.intent }, this._config.storage);
            } catch {
            }
          }
          if (this._config.debug) {
            console.log("[LuaIntent]", decision);
          }
          return decision;
        }
        /**
         * Async decide — supports an async AI adapter.
         *
         * @param {object} [ctx]
         * @returns {Promise<IntentDecision>}
         */
        async decideAsync(ctx) {
          const syncDecision = this.decide(ctx);
          const aiCfg = this._config.ai || {};
          if (!shouldInvokeAI(syncDecision.confidence, aiCfg.enabled)) {
            return syncDecision;
          }
          if (typeof aiCfg.adapter !== "function") {
            return syncDecision;
          }
          try {
            const aiResult = await aiCfg.adapter(syncDecision.signals || {}, syncDecision);
            if (aiResult && aiResult.confidence > syncDecision.confidence + ALGORITHM.AI_WIN_MARGIN) {
              return Object.assign({}, syncDecision, {
                intent: aiResult.intent,
                confidence: aiResult.confidence,
                reason: aiResult.reason || syncDecision.reason,
                source: "ai",
                priority: PRIORITY.AI_AUGMENT,
                aiUsed: true
              });
            }
          } catch (err) {
            if (this._config.debug) {
              console.warn("[LuaIntent] AI adapter error:", err.message);
            }
          }
          return syncDecision;
        }
      };
      function generateSessionId() {
        const ts = Date.now().toString(36);
        const rand = Math.random().toString(36).slice(2, 8);
        return `s_${ts}_${rand}`;
      }
      module.exports = { LuaIntent: LuaIntent2 };
    }
  });

  // demo/bundle-entry.js
  var { LuaIntent } = require_LuaIntent();
  var { BehaviorAnalyzer } = require_behaviorAnalyzer();
  window.LuaIntent = LuaIntent;
  window.BehaviorAnalyzer = BehaviorAnalyzer;
})();
