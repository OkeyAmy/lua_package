/**
  @okeyamy/lua - A client side A/B tester
  @version v5.0.4
  @link https://github.com/OkeyAmy/lua_package/
  @author Okey Amy <amaobiokeoma@gmail.com>
  @license MIT
**/
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.Lua = factory());
}(this, (function () { 'use strict';

  var rand = function rand(min, max) {
    return Math.random() * (max - min) + min;
  };

  // choose a random value with the specified weights
  var chooseWeightedItem = function chooseWeightedItem(names, weights) {
    if (names.length !== weights.length) throw new Error('names and weights must have equal length!');
    var sum = weights.reduce(function (a, b) {
      return a + b;
    }, 0);
    var limit = 0;
    var n = rand(0, sum);
    for (var i = 0; i < names.length; i++) {
      limit += weights[i];
      if (n <= limit) return names[i];
    }
    // by default, return the last weight
    return names[names.length - 1];
  };

  // get the default bucket,
  // which is either the default/winner,
  // otherwise whichever is returned first
  var getDefaultBucket = function getDefaultBucket(buckets) {
    var defaultBuckets = Object.keys(buckets).filter(function (name) {
      var x = buckets[name];
      return x["default"] || x.winner;
    });
    return defaultBuckets[0] || Object.keys(buckets)[0];
  };
  var validateStore = function validateStore(store) {
    if (!store) throw new Error('You must supply a store!');
    if (typeof store.get !== 'function') throw new Error('The store must implement .get()');
    if (typeof store.set !== 'function') throw new Error('The store must implement .set()');
    if (typeof store.isSupported !== 'function') throw new Error('The store must implement .isSupported()');
    if (!store.isSupported()) throw new Error('The store is not supported.');
  };
  var getRandomAssignment = function getRandomAssignment(test) {
    var names = Object.keys(test.buckets);
    var weights = [];
    names.forEach(function (innerBucketName) {
      var weight = test.buckets[innerBucketName].weight;
      if (weight == null) weight = 1;
      weights.push(weight);
    });
    return chooseWeightedItem(names, weights);
  };

  // UTM functions are now on window.LuaUTM (IIFE pattern, no import needed)
  // utm.js must be loaded before lua.js to populate window.LuaUTM
  var Lua = /*#__PURE__*/function () {
    function Lua(options) {
      if (options === void 0) {
        options = {};
      }
      Object.assign(this, {
        storageKey: 'ab-tests',
        root: typeof document !== 'undefined' ? document.body : null
      }, options);
      validateStore(this.store);
      this.previousAssignments = {};
      try {
        // assert that the data is a JSON string
        // that represents a JSON object
        // saw a bug where it was, for some reason, stored as `null`
        var data = this.store.get(this.storageKey);
        if (typeof data === 'string' && data[0] === '{') {
          this.previousAssignments = JSON.parse(data);
        }
      } catch (_) {
        // ignore
      }
      this.userAssignments = {};
      this.persistedUserAssignments = {};
      this.providedTests = [];
    }
    var _proto = Lua.prototype;
    _proto.define = function define(tests) {
      var _this = this;
      var normalizedData = tests;
      if (!Array.isArray(tests)) normalizedData = [tests];
      normalizedData.forEach(function (test) {
        if (!test.name) throw new Error('Tests must have a name');
        if (!test.buckets) throw new Error('Tests must have buckets');
        if (!Object.keys(test.buckets)) throw new Error('Tests must have buckets');
        _this.providedTests.push(test);
      });
    };
    _proto.definitions = function definitions() {
      return this.providedTests;
    };
    _proto.removeClasses = function removeClasses(testName, exceptClassName) {
      try {
        var root = this.root;
        if (!root) return;

        // classList does not support returning all classes
        var currentClassNames = root.className.split(/\s+/g).map(function (x) {
          return x.trim();
        }).filter(Boolean);
        currentClassNames.filter(function (x) {
          return x.indexOf(testName + "--") === 0;
        }).filter(function (className) {
          return className !== exceptClassName;
        }).forEach(function (className) {
          return root.classList.remove(className);
        });
      } catch (_) {
        // Ignore
      }
    };
    _proto.applyClasses = function applyClasses() {
      var _this2 = this;
      try {
        var userAssignments = this.userAssignments,
          root = this.root;
        if (!root) return;
        Object.keys(userAssignments).forEach(function (testName) {
          var bucket = userAssignments[testName];
          var className = bucket ? testName + "--" + bucket : null;
          // remove all classes related to this bucket
          _this2.removeClasses(testName, className);

          // only assign a class is the test is assigned to a bucket
          // this removes then adds a class, which is not ideal but is clean
          if (className) root.classList.add(className);
        });
      } catch (_) {
        // Ignore
      }
    };
    _proto.assignAll = function assignAll() {
      var previousAssignments = this.previousAssignments,
        userAssignments = this.userAssignments,
        persistedUserAssignments = this.persistedUserAssignments;
      this.providedTests.forEach(function (test) {
        // winners take precedence
        {
          var winner = Object.keys(test.buckets).filter(function (name) {
            return test.buckets[name].winner;
          })[0];
          if (winner) {
            userAssignments[test.name] = winner;
            return;
          }
        }

        // already assigned, probably because someone
        // called `.assignAll()` twice.
        if (userAssignments[test.name]) return;
        {
          // previously assigned, so we continue to persist it
          var bucket = previousAssignments[test.name];
          if (bucket && test.buckets[bucket]) {
            var assignment = previousAssignments[test.name];
            persistedUserAssignments[test.name] = assignment;
            userAssignments[test.name] = assignment;
            test.active = true;
            return;
          }
        }

        // inactive tests should be set to default
        if (test.active === false) {
          userAssignments[test.name] = getDefaultBucket(test.buckets);
          return;
        }

        // randomly assign
        {
          var _assignment = getRandomAssignment(test);
          persistedUserAssignments[test.name] = _assignment;
          userAssignments[test.name] = _assignment;
        }
      });
      this.persist();
      this.applyClasses();
    };
    _proto.assign = function assign(testName, bucketName) {
      if (!testName) return this.assignAll();
      var test = this.providedTests.filter(function (x) {
        return x.name === testName;
      })[0];
      if (bucketName === null || !test) {
        delete this.userAssignments[testName];
        delete this.persistedUserAssignments[testName];
        this.persist();
        this.removeClasses(testName);
        return;
      }
      var assignment = bucketName || getRandomAssignment(test);
      this.userAssignments[testName] = assignment;
      this.persistedUserAssignments[testName] = assignment;
      test.active = true;
      this.persist();
      this.applyClasses();
    };
    _proto.extendAssignments = function extendAssignments(assignments) {
      return assignments;
    };
    _proto.assignments = function assignments() {
      return this.extendAssignments(this.userAssignments);
    };
    _proto.persist = function persist() {
      this.store.set(this.storageKey, JSON.stringify(this.persistedUserAssignments));
    }

    /**
     * Get UTM context for the current page
     * Uses window.LuaUTM global (populated by utm.js IIFE)
     * @returns {Object} - Context object with UTM params, referrer, user agent, and intent
     */;
    _proto.getUTMContext = function getUTMContext() {
      try {
        var _root = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : {};
        if (_root.LuaUTM && typeof _root.LuaUTM.getContext === 'function') {
          return _root.LuaUTM.getContext();
        }
        return {
          utm: {},
          referrer: {},
          userAgent: {},
          primaryIntent: 'default',
          hasUTM: false
        };
      } catch (_) {
        return {
          utm: {},
          referrer: {},
          userAgent: {},
          primaryIntent: 'default',
          hasUTM: false
        };
      }
    }

    /**
     * Get bucket based on UTM context
     * Maps UTM intent to test buckets
     * @param {Object} test - Test definition with buckets
     * @param {Object} context - UTM context
     * @returns {string|null} - Bucket name or null if no match
     */;
    _proto.getUTMBasedBucket = function getUTMBasedBucket(test, context) {
      if (!context || !context.hasUTM) return null;

      // Check if test has UTM rules defined
      var utmRules = test.utmRules || {};

      // Priority 1: Match by utm_campaign
      if (context.utm.utm_campaign) {
        var campaignRule = utmRules[context.utm.utm_campaign];
        if (campaignRule && test.buckets[campaignRule]) {
          return campaignRule;
        }
      }

      // Priority 2: Match by utm_source
      if (context.utm.utm_source) {
        var sourceRule = utmRules[context.utm.utm_source];
        if (sourceRule && test.buckets[sourceRule]) {
          return sourceRule;
        }
      }

      // Priority 3: Match by inferred intent
      var intent = context.primaryIntent;
      if (intent && test.buckets[intent]) {
        return intent;
      }

      // Priority 4: Check for intent-mapped buckets
      var intentMapping = test.intentMapping || {};
      if (intent && intentMapping[intent] && test.buckets[intentMapping[intent]]) {
        return intentMapping[intent];
      }
      return null;
    }

    /**
     * Assign with UTM-aware personalization
     * Falls back to random A/B if no UTM match
     * @param {string} [testName] - Optional specific test name
     * @param {Object} [options] - Options including forceUTM, context
     * @returns {Object} - { assignment, source: 'utm'|'random'|'persisted' }
     */;
    _proto.assignWithUTM = function assignWithUTM(testName, options) {
      if (options === void 0) {
        options = {};
      }
      var context = options.context || this.getUTMContext();

      // If no test name, assign all with UTM awareness
      if (!testName) {
        return this.assignAllWithUTM(context);
      }
      var test = this.providedTests.filter(function (x) {
        return x.name === testName;
      })[0];
      if (!test) {
        return {
          assignment: null,
          source: 'none'
        };
      }

      // Check for winner first (takes precedence)
      var winner = Object.keys(test.buckets).filter(function (name) {
        return test.buckets[name].winner;
      })[0];
      if (winner) {
        this.userAssignments[testName] = winner;
        this.persist();
        this.applyClasses();
        return {
          assignment: winner,
          source: 'winner'
        };
      }

      // Check previous assignment
      var previousBucket = this.previousAssignments[testName];
      if (previousBucket && test.buckets[previousBucket]) {
        this.userAssignments[testName] = previousBucket;
        this.persistedUserAssignments[testName] = previousBucket;
        test.active = true;
        this.persist();
        this.applyClasses();
        return {
          assignment: previousBucket,
          source: 'persisted'
        };
      }

      // Try UTM-based assignment
      var utmBucket = this.getUTMBasedBucket(test, context);
      if (utmBucket) {
        this.userAssignments[testName] = utmBucket;
        this.persistedUserAssignments[testName] = utmBucket;
        test.active = true;
        this.persist();
        this.applyClasses();
        return {
          assignment: utmBucket,
          source: 'utm',
          intent: context.primaryIntent
        };
      }

      // Fallback to random assignment
      var assignment = getRandomAssignment(test);
      this.userAssignments[testName] = assignment;
      this.persistedUserAssignments[testName] = assignment;
      test.active = true;
      this.persist();
      this.applyClasses();
      return {
        assignment: assignment,
        source: 'random'
      };
    }

    /**
     * Assign all tests with UTM awareness
     * @param {Object} context - UTM context
     * @returns {Object} - Map of test names to assignment results
     */;
    _proto.assignAllWithUTM = function assignAllWithUTM(context) {
      var _this3 = this;
      context = context || this.getUTMContext();
      var results = {};
      this.providedTests.forEach(function (test) {
        var result = _this3.assignWithUTM(test.name, {
          context: context
        });
        results[test.name] = result;
      });
      return results;
    };
    return Lua;
  }();

  // NOTE: use a module
  var browserCookie = (function () {
    return {
      type: 'browserCookie',
      /*eslint-disable */
      get: function get(key) {
        return decodeURIComponent(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + encodeURIComponent(key).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null;
      },
      set: function set(key, val) {
        var expirationDate = new Date('12/31/9999').toUTCString();
        document.cookie = encodeURIComponent(key) + "=" + encodeURIComponent(val) + "; expires=" + expirationDate + "; path=/";
      },
      /* eslint-enable */
      isSupported: function isSupported() {
        return typeof document !== 'undefined';
      }
    };
  });

  var local = (function () {
    return {
      type: 'local',
      get: function get(key) {
        return localStorage.getItem(key);
      },
      set: function set(key, val) {
        return localStorage.setItem(key, val);
      },
      isSupported: function isSupported() {
        if (typeof localStorage !== 'undefined') return true;
        var uid = new Date();
        try {
          localStorage.setItem(uid, uid);
          localStorage.removeItem(uid);
          return true;
        } catch (e) {
          return false;
        }
      }
    };
  });

  var memory = (function () {
    var store = Object.create(null);
    return {
      type: 'memory',
      get: function get(key) {
        return store[key];
      },
      set: function set(key, val) {
        store[key] = val;
      },
      isSupported: function isSupported() {
        return true;
      }
    };
  });

  /**
   * UTM Parameter Extraction & Context Detection
   * Uses native URLSearchParams API for extracting UTM parameters
   * and document.referrer/navigator.userAgent for context inference
   *
   * No ES6 imports - self-contained IIFE that registers on window.LuaUTM
   * Can be loaded standalone via <script> tag or bundled by Rollup
   */
  (function (root) {

    // Default timeout for async operations (1 second max as recommended)
    var UTM_TIMEOUT_MS = 1000;

    // Allowed UTM parameter names
    var UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

    // Referrer type patterns
    var REFERRER_PATTERNS = {
      google: /google\./i,
      bing: /bing\./i,
      yahoo: /yahoo\./i,
      duckduckgo: /duckduckgo\./i,
      facebook: /facebook\.com|fb\.com/i,
      twitter: /twitter\.com|t\.co|x\.com/i,
      instagram: /instagram\.com/i,
      linkedin: /linkedin\.com/i,
      pinterest: /pinterest\./i,
      tiktok: /tiktok\.com/i,
      youtube: /youtube\.com|youtu\.be/i,
      reddit: /reddit\.com/i
    };

    // Referrer category mapping
    var REFERRER_CATEGORIES = {
      search: ['google', 'bing', 'yahoo', 'duckduckgo'],
      social: ['facebook', 'twitter', 'instagram', 'linkedin', 'pinterest', 'tiktok', 'youtube', 'reddit']
    };

    /**
     * Safely extracts UTM parameters from URL using native URLSearchParams API
     * @param {string} [url] - URL to parse (defaults to window.location.search)
     * @returns {Object} - Object containing UTM parameters
     */
    function extractUTMParams(url) {
      var result = {};
      try {
        var searchString = url || (typeof window !== 'undefined' ? window.location.search : '');
        if (!searchString) {
          return result;
        }

        // Use native URLSearchParams API
        var params = new URLSearchParams(searchString);
        UTM_PARAMS.forEach(function (param) {
          var value = params.get(param);
          if (value) {
            // Sanitize: only allow alphanumeric, dashes, underscores
            result[param] = sanitizeParam(value);
          }
        });
      } catch (e) {
        // Fallback: return empty object on any error
        console.warn('[Lua UTM] Error extracting UTM params:', e);
      }
      return result;
    }

    /**
     * Sanitize parameter value to prevent XSS
     * Only allows alphanumeric, dashes, underscores, and spaces
     * @param {string} value - Raw parameter value
     * @returns {string} - Sanitized value
     */
    function sanitizeParam(value) {
      if (typeof value !== 'string') return '';
      // Remove any HTML tags and special characters
      return value.replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[^\w\s\-_.]/g, '') // Only allow safe characters
      .substring(0, 100) // Limit length
      .trim();
    }

    /**
     * Detect referrer type from document.referrer
     * @returns {Object} - { source: string, category: 'search'|'social'|'email'|'direct'|'other' }
     */
    function detectReferrer() {
      var result = {
        source: 'direct',
        category: 'direct',
        url: ''
      };
      try {
        if (typeof document === 'undefined' || !document.referrer) {
          return result;
        }
        result.url = document.referrer;

        // Check for email patterns in referrer
        if (/mail\.|email\.|newsletter/i.test(document.referrer)) {
          result.source = 'email';
          result.category = 'email';
          return result;
        }

        // Check against known patterns
        for (var source in REFERRER_PATTERNS) {
          if (REFERRER_PATTERNS[source].test(document.referrer)) {
            result.source = source;

            // Determine category
            for (var category in REFERRER_CATEGORIES) {
              if (REFERRER_CATEGORIES[category].indexOf(source) !== -1) {
                result.category = category;
                break;
              }
            }
            return result;
          }
        }

        // Unknown external referrer
        result.source = 'external';
        result.category = 'other';
      } catch (e) {
        console.warn('[Lua UTM] Error detecting referrer:', e);
      }
      return result;
    }

    /**
     * Get user agent info (for device/browser detection)
     * @returns {Object} - User agent metadata
     */
    function getUserAgentInfo() {
      var result = {
        raw: '',
        isMobile: false,
        isTablet: false,
        isDesktop: true
      };
      try {
        if (typeof navigator === 'undefined' || !navigator.userAgent) {
          return result;
        }
        result.raw = navigator.userAgent;

        // Mobile detection
        result.isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        result.isTablet = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
        result.isDesktop = !result.isMobile && !result.isTablet;
      } catch (e) {
        console.warn('[Lua UTM] Error getting user agent:', e);
      }
      return result;
    }

    /**
     * Get full personalization context
     * Combines UTM params, referrer info, and user agent
     * @param {Object} [options] - Configuration options
     * @param {string} [options.url] - Custom URL to parse
     * @returns {Object} - Complete context object
     */
    function getContext(options) {
      options = options || {};
      var context = {
        utm: extractUTMParams(options.url),
        referrer: detectReferrer(),
        userAgent: getUserAgentInfo(),
        timestamp: Date.now(),
        hasUTM: false,
        primaryIntent: 'unknown'
      };

      // Determine if we have UTM data
      context.hasUTM = Object.keys(context.utm).length > 0;

      // Infer primary intent
      context.primaryIntent = inferIntent(context);
      return context;
    }

    /**
     * Infer user intent from context
     * Priority: UTM campaign > UTM source > Referrer category
     * @param {Object} context - Full context object
     * @returns {string} - Inferred intent key
     */
    function inferIntent(context) {
      // Priority 1: UTM campaign tells us the specific intent
      if (context.utm.utm_campaign) {
        var campaign = context.utm.utm_campaign.toLowerCase();
        if (/sale|discount|offer|promo/i.test(campaign)) return 'price-focused';
        if (/gaming|game|esport/i.test(campaign)) return 'gaming';
        if (/work|office|professional|productivity/i.test(campaign)) return 'professional';
        if (/creative|design|art|studio/i.test(campaign)) return 'creative';
        if (/brand|story|about/i.test(campaign)) return 'brand-story';
      }

      // Priority 2: UTM source can indicate intent
      if (context.utm.utm_source) {
        var source = context.utm.utm_source.toLowerCase();
        if (/google|bing|yahoo/i.test(source)) return 'search-optimized';
        if (/facebook|instagram|tiktok/i.test(source)) return 'social-visual';
        if (/twitter|x$/i.test(source)) return 'social-brief';
        if (/email|newsletter/i.test(source)) return 'returning-user';
        if (/youtube/i.test(source)) return 'video-engaged';
      }

      // Priority 3: Referrer category
      if (context.referrer.category === 'search') return 'search-optimized';
      if (context.referrer.category === 'social') return 'social-visual';
      if (context.referrer.category === 'email') return 'returning-user';

      // Default
      return 'default';
    }

    /**
     * Get context with timeout fallback
     * Returns default context if operation takes too long
     * @param {Object} [options] - Configuration options
     * @param {number} [options.timeout] - Timeout in ms (default: 1000)
     * @returns {Promise<Object>} - Context object
     */
    function getContextAsync(options) {
      options = options || {};
      var timeout = options.timeout || UTM_TIMEOUT_MS;
      return new Promise(function (resolve) {
        var timer = setTimeout(function () {
          // Timeout: return default context
          resolve({
            utm: {},
            referrer: {
              source: 'direct',
              category: 'direct',
              url: ''
            },
            userAgent: {
              raw: '',
              isMobile: false,
              isTablet: false,
              isDesktop: true
            },
            timestamp: Date.now(),
            hasUTM: false,
            primaryIntent: 'default',
            timedOut: true
          });
        }, timeout);
        try {
          var context = getContext(options);
          clearTimeout(timer);
          context.timedOut = false;
          resolve(context);
        } catch (e) {
          clearTimeout(timer);
          resolve({
            utm: {},
            referrer: {
              source: 'direct',
              category: 'direct',
              url: ''
            },
            userAgent: {
              raw: '',
              isMobile: false,
              isTablet: false,
              isDesktop: true
            },
            timestamp: Date.now(),
            hasUTM: false,
            primaryIntent: 'default',
            error: e.message
          });
        }
      });
    }

    // --- Public API ---
    // Register on the global root (window in browser)
    var LuaUTM = {
      extractUTMParams: extractUTMParams,
      sanitizeParam: sanitizeParam,
      detectReferrer: detectReferrer,
      getUserAgentInfo: getUserAgentInfo,
      getContext: getContext,
      getContextAsync: getContextAsync,
      inferIntent: inferIntent,
      UTM_PARAMS: UTM_PARAMS,
      UTM_TIMEOUT_MS: UTM_TIMEOUT_MS,
      REFERRER_PATTERNS: REFERRER_PATTERNS,
      REFERRER_CATEGORIES: REFERRER_CATEGORIES
    };

    // Expose globally
    root.LuaUTM = LuaUTM;
  })(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : undefined);

  /**
   * DOM Personalization Engine
   * Handles content injection with data-personalize attributes
   * Uses textContent for text, DOMPurify-style sanitized HTML for rich content
   *
   * No ES6 imports - self-contained IIFE that registers on window.LuaPersonalize
   * Depends on window.LuaUTM (from utm.js) for context extraction
   * Falls back to random A/B test when no UTM params are present
   */
  (function (root) {

    // ===================================================================
    // DOMPurify-style HTML Sanitizer (inline, OWASP-recommended approach)
    // Provides safe HTML injection without external dependencies
    // ===================================================================

    /**
     * Inline DOMPurify-style sanitizer
     * Uses the browser's DOMParser to safely parse and sanitize HTML
     * Falls back to regex-based sanitization if DOMParser unavailable
     */
    var Sanitizer = function () {
      // Allowed HTML tags (safe for content injection)
      var ALLOWED_TAGS = {
        'p': true,
        'span': true,
        'strong': true,
        'em': true,
        'b': true,
        'i': true,
        'br': true,
        'a': true,
        'img': true,
        'h1': true,
        'h2': true,
        'h3': true,
        'h4': true,
        'h5': true,
        'h6': true,
        'div': true,
        'section': true,
        'ul': true,
        'ol': true,
        'li': true,
        'blockquote': true,
        'figure': true,
        'figcaption': true
      };

      // Allowed HTML attributes (safe subset)
      var ALLOWED_ATTRS = {
        'href': true,
        'src': true,
        'alt': true,
        'class': true,
        'id': true,
        'title': true,
        'target': true,
        'rel': true,
        'width': true,
        'height': true,
        'loading': true
      };

      // Dangerous URI schemes
      var DANGEROUS_URI = /^(javascript|vbscript|data):/i;

      // Event handler pattern (onclick, onerror, onload, etc.)
      var EVENT_HANDLER = /^on/i;

      /**
       * Check if DOMParser is available (modern browsers)
       * @returns {boolean}
       */
      function hasDOMParser() {
        try {
          return typeof DOMParser !== 'undefined' && new DOMParser();
        } catch (e) {
          return false;
        }
      }

      /**
       * Sanitize HTML using DOMParser (preferred, secure method)
       * Parses HTML into a DOM tree, walks nodes, and rebuilds safe HTML
       * @param {string} dirty - Untrusted HTML string
       * @returns {string} - Sanitized HTML string
       */
      function sanitizeWithDOMParser(dirty) {
        if (typeof dirty !== 'string' || !dirty.trim()) return '';
        try {
          var parser = new DOMParser();
          var doc = parser.parseFromString(dirty, 'text/html');
          var body = doc.body;
          if (!body) return '';
          return walkAndClean(body);
        } catch (e) {
          console.warn('[Lua Sanitizer] DOMParser failed, using fallback:', e);
          return sanitizeWithRegex(dirty);
        }
      }

      /**
       * Recursively walk DOM nodes and build clean HTML
       * @param {Node} node - DOM node to process
       * @returns {string} - Cleaned HTML string
       */
      function walkAndClean(node) {
        var output = '';
        for (var i = 0; i < node.childNodes.length; i++) {
          var child = node.childNodes[i];

          // Text node - safe to include
          if (child.nodeType === 3) {
            output += escapeText(child.textContent);
            continue;
          }

          // Element node
          if (child.nodeType === 1) {
            var tagName = child.tagName.toLowerCase();

            // Skip disallowed tags entirely (including children)
            if (tagName === 'script' || tagName === 'style' || tagName === 'iframe' || tagName === 'object' || tagName === 'embed' || tagName === 'form' || tagName === 'input' || tagName === 'textarea') {
              continue;
            }

            // If tag is allowed, include it with filtered attributes
            if (ALLOWED_TAGS[tagName]) {
              output += '<' + tagName;
              output += cleanAttributes(child);
              output += '>';

              // Self-closing tags
              if (tagName === 'br' || tagName === 'img') {
                continue;
              }

              // Recurse into children
              output += walkAndClean(child);
              output += '</' + tagName + '>';
            } else {
              // Tag not allowed - include children only (strip the tag)
              output += walkAndClean(child);
            }
          }
        }
        return output;
      }

      /**
       * Filter element attributes to only allowed ones
       * @param {Element} element - DOM element
       * @returns {string} - Attribute string
       */
      function cleanAttributes(element) {
        var attrStr = '';
        var attrs = element.attributes;
        for (var i = 0; i < attrs.length; i++) {
          var attr = attrs[i];
          var name = attr.name.toLowerCase();
          var value = attr.value;

          // Skip event handlers (onclick, onerror, etc.)
          if (EVENT_HANDLER.test(name)) continue;

          // Skip disallowed attributes
          if (!ALLOWED_ATTRS[name]) continue;

          // Check URI safety for href/src
          if ((name === 'href' || name === 'src') && DANGEROUS_URI.test(value.trim())) {
            continue;
          }

          // Add rel="noopener noreferrer" for external links
          if (name === 'target' && value === '_blank') {
            attrStr += ' target="_blank" rel="noopener noreferrer"';
            continue;
          }
          attrStr += ' ' + name + '="' + escapeAttr(value) + '"';
        }
        return attrStr;
      }

      /**
       * Escape text content for safe HTML inclusion
       * @param {string} text - Raw text
       * @returns {string} - Escaped text
       */
      function escapeText(text) {
        if (!text) return '';
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      /**
       * Escape attribute value for safe HTML inclusion
       * @param {string} value - Raw attribute value
       * @returns {string} - Escaped attribute value
       */
      function escapeAttr(value) {
        if (!value) return '';
        return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      /**
       * Fallback regex-based sanitizer for environments without DOMParser
       * @param {string} html - Raw HTML string
       * @returns {string} - Sanitized HTML
       */
      function sanitizeWithRegex(html) {
        if (typeof html !== 'string') return '';
        var DANGEROUS_PATTERNS = [/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, /<embed\b[^>]*>/gi, /<link\b[^>]*>/gi, /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, /javascript:/gi, /vbscript:/gi, /data:/gi, /on\w+\s*=/gi];
        var sanitized = html;
        DANGEROUS_PATTERNS.forEach(function (pattern) {
          sanitized = sanitized.replace(pattern, '');
        });

        // Remove disallowed tags but keep their text content
        sanitized = sanitized.replace(/<\/?(\w+)([^>]*)>/g, function (match, tagName, attrs) {
          var tag = tagName.toLowerCase();
          if (!ALLOWED_TAGS[tag]) return '';

          // For closing tags, just return the closing tag
          if (match.charAt(1) === '/') return '</' + tag + '>';

          // Filter attributes
          var cleanAttrs = '';
          var attrRegex = /(\w+)=['"]([^'"]*)['"]/g;
          var attrMatch;
          while ((attrMatch = attrRegex.exec(attrs)) !== null) {
            var attrName = attrMatch[1].toLowerCase();
            if (ALLOWED_ATTRS[attrName] && !EVENT_HANDLER.test(attrName)) {
              var val = attrMatch[2];
              if ((attrName === 'href' || attrName === 'src') && DANGEROUS_URI.test(val)) {
                continue;
              }
              cleanAttrs += ' ' + attrName + '="' + val + '"';
            }
          }
          return '<' + tag + cleanAttrs + '>';
        });
        return sanitized;
      }

      // Public sanitizer API
      return {
        /**
         * Sanitize HTML string (main entry point)
         * Uses DOMParser when available, regex fallback otherwise
         * @param {string} dirty - Untrusted HTML
         * @returns {string} - Sanitized HTML
         */
        sanitize: function sanitize(dirty) {
          if (typeof dirty !== 'string') return '';
          if (!dirty.trim()) return '';
          if (hasDOMParser()) {
            return sanitizeWithDOMParser(dirty);
          }
          return sanitizeWithRegex(dirty);
        },
        escapeText: escapeText,
        escapeAttr: escapeAttr
      };
    }();

    // ===================================================================
    // Templates & Assets
    // ===================================================================
    // NOTE: Templates are NOT provided by this package.
    // Users must provide their own templates via options.templates
    // This keeps the package modular and allows users full control
    // over their content, assets, and personalization strategy.

    // ===================================================================
    // DOM Interaction (safe methods - never raw innerHTML)
    // ===================================================================

    /**
     * Safely set text content on an element (no HTML parsing)
     * @param {Element} element - DOM element
     * @param {string} text - Text to set
     */
    function safeSetText(element, text) {
      if (!element) return;
      element.textContent = text;
    }

    /**
     * Safely set HTML content on an element (DOMPurify-sanitized)
     * @param {Element} element - DOM element
     * @param {string} html - HTML to set (will be sanitized)
     */
    function safeSetHTML(element, html) {
      if (!element) return;
      element.innerHTML = Sanitizer.sanitize(html);
    }

    /**
     * Find all elements with data-personalize attribute
     * @param {string} [key] - Optional specific key to find
     * @param {Element} [searchRoot] - Root element to search from (default: document)
     * @returns {NodeList|Array} - Matching elements
     */
    function findPersonalizeElements(key, searchRoot) {
      searchRoot = searchRoot || (typeof document !== 'undefined' ? document : null);
      if (!searchRoot) return [];
      var selector = key ? '[data-personalize="' + key + '"]' : '[data-personalize]';
      return searchRoot.querySelectorAll(selector);
    }

    /**
     * Get template for a given intent
     * Templates must be provided by the user via options.templates
     * Falls back to 'default' template if intent not found
     * @param {string} intent - Intent key
     * @param {Object} userTemplates - User-provided templates (required)
     * @returns {Object|null} - Template data or null if no templates provided
     */
    function getTemplate(intent, userTemplates) {
      if (!userTemplates || typeof userTemplates !== 'object') {
        console.warn('[Lua Personalize] No templates provided. Templates must be passed via options.templates');
        return null;
      }

      // Try to get the intent template
      if (userTemplates[intent]) {
        return userTemplates[intent];
      }

      // Fall back to 'default' template if available
      if (userTemplates['default']) {
        return userTemplates['default'];
      }

      // If no default, return the first available template
      var firstKey = Object.keys(userTemplates)[0];
      if (firstKey) {
        console.warn('[Lua Personalize] Intent "' + intent + '" not found, using first available template:', firstKey);
        return userTemplates[firstKey];
      }
      return null;
    }

    // ===================================================================
    // Random A/B Fallback (used when no UTM params are present)
    // ===================================================================

    /**
     * Simple weighted random selection for A/B fallback
     * @param {Array} names - Array of bucket/template names
     * @param {Array} weights - Corresponding weights
     * @returns {string} - Selected name
     */
    function chooseWeightedRandom(names, weights) {
      if (names.length !== weights.length) return names[0];
      var sum = 0;
      var i;
      for (i = 0; i < weights.length; i++) {
        sum += weights[i];
      }
      var n = Math.random() * sum;
      var limit = 0;
      for (i = 0; i < names.length; i++) {
        limit += weights[i];
        if (n <= limit) return names[i];
      }
      return names[names.length - 1];
    }

    /**
     * Get a random template key from user-provided templates
     * Used as fallback when no UTM/referrer context is available
     * @param {Object} userTemplates - User-provided templates (required)
     * @returns {string|null} - Random template intent key or null if no templates
     */
    function getRandomFallbackIntent(userTemplates) {
      if (!userTemplates || typeof userTemplates !== 'object') {
        return null;
      }
      var names = Object.keys(userTemplates);
      if (names.length === 0) {
        return null;
      }
      var weights = [];
      for (var i = 0; i < names.length; i++) {
        weights.push(1); // Equal weight by default
      }
      return chooseWeightedRandom(names, weights);
    }

    // ===================================================================
    // Decision Engine
    // ===================================================================

    /**
     * Personalization Decision Engine
     * Determines which content to show based on context
     * Priority: AI (if enabled) -> UTM params -> Referrer -> Random A/B fallback
     */
    var DecisionEngine = {
      /**
       * Standard (non-AI) decision logic
       * @param {Object} context - Context from LuaUTM.getContext()
       * @param {Object} [options] - Configuration options
       * @param {Object} [options.rules] - Custom matching rules
       * @param {Object} options.templates - User-provided templates (REQUIRED)
       * @param {boolean} [options.randomFallback] - Enable random A/B fallback (default: true)
       * @returns {Object} - { template, intent, source }
       */
      standardDecide: function standardDecide(context, options) {
        options = options || {};
        var customRules = options.rules || {};
        var userTemplates = options.templates;
        var enableRandomFallback = options.randomFallback !== false;

        // Templates are required - warn if not provided
        if (!userTemplates || typeof userTemplates !== 'object' || Object.keys(userTemplates).length === 0) {
          console.warn('[Lua Personalize] No templates provided. Templates must be passed via options.templates');
          return {
            template: null,
            intent: 'default',
            source: 'error',
            context: context,
            error: 'No templates provided'
          };
        }
        var intent = context.primaryIntent;
        var source = 'default';

        // Determine the source of the decision
        if (context.hasUTM) {
          source = 'utm';
        } else if (context.referrer && context.referrer.category !== 'direct') {
          source = 'referrer';
        }

        // Check custom rules first (highest priority)
        for (var ruleKey in customRules) {
          var rule = customRules[ruleKey];
          if (typeof rule.match === 'function' && rule.match(context)) {
            intent = rule.intent || ruleKey;
            source = 'custom-rule';
            break;
          }
        }

        // If intent is still 'default' and random fallback is enabled,
        // pick a random template for A/B testing
        if (intent === 'default' && source === 'default' && enableRandomFallback) {
          var randomIntent = getRandomFallbackIntent(userTemplates);
          if (randomIntent) {
            intent = randomIntent;
            source = 'random-ab';
          }
        }

        // Record visit to history if LuaWeightedHistory is available
        if (root.LuaWeightedHistory && typeof root.LuaWeightedHistory.recordVisit === 'function') {
          root.LuaWeightedHistory.recordVisit({
            context: context,
            intent: intent,
            selectedVariant: intent,
            source: source,
            aiDecision: false
          });
        }
        return {
          template: getTemplate(intent, userTemplates),
          intent: intent,
          source: source,
          context: context
        };
      },
      /**
       * Main decide function - routes to AI or standard engine
       * @param {Object} context - Context from LuaUTM.getContext()
       * @param {Object} [options] - Configuration options
       * @param {boolean} [options.enableAI] - Enable AI-powered decisions
       * @param {Object} [options.aiConfig] - AI configuration
       * @returns {Object|Promise<Object>} - Decision result (Promise if AI enabled)
       */
      decide: function decide(context, options) {
        options = options || {};

        // If AI is enabled and configured, try AI decision first
        if (options.enableAI && options.aiConfig && root.LuaAIPersonalize) {
          var self = this;
          var aiModule = root.LuaAIPersonalize;
          var readiness = aiModule.isReady(options.aiConfig);
          if (readiness.ready) {
            return aiModule.decide(context, options)["catch"](function (error) {
              // AI failed - fall back to standard engine
              var fallback = options.aiConfig.fallbackToStandard !== false;
              if (fallback) {
                console.warn('[Lua Personalize] AI failed, using standard engine:', error.message);
                return self.standardDecide(context, options);
              }
              throw error;
            });
          } else {
            console.warn('[Lua Personalize] AI not ready:', readiness.error, '- using standard engine');
          }
        }

        // Standard decision (synchronous)
        return this.standardDecide(context, options);
      }
    };

    // ===================================================================
    // Personalization Application
    // ===================================================================

    // ===================================================================
    // DOM Application (extracted for reuse by both sync and async paths)
    // ===================================================================

    /**
     * Apply a decision to the DOM
     * Injects content into elements with data-personalize attributes
     *
     * @param {Object} decision - Decision object { template, intent, source, context }
     * @param {Object} [options] - Configuration options
     * @param {boolean} [options.log] - Enable console logging
     * @returns {Object} - The decision (pass-through)
     */
    function applyDecisionToDOM(decision, options) {
      options = options || {};
      var template = decision.template;
      var context = decision.context || {};
      var log = options.log !== false;
      if (!template) {
        console.warn('[Lua Personalize] No template in decision, skipping DOM update');
        return decision;
      }

      // Find and update each personalize slot in the DOM
      var slots = ['image', 'headline', 'subheadline', 'ctaLabel', 'ctaLink'];
      slots.forEach(function (slot) {
        var elements = findPersonalizeElements(slot);
        for (var i = 0; i < elements.length; i++) {
          var element = elements[i];
          var value = template[slot];
          if (!value) continue;
          if (slot === 'image') {
            // For images, set background-image or src attribute
            if (element.tagName === 'IMG') {
              element.src = value;
              element.alt = template.headline || 'Personalized image';
            } else {
              element.style.backgroundImage = 'url(' + value + ')';
            }
          } else if (slot === 'ctaLink') {
            // For links, set href attribute
            element.href = value;
          } else {
            // For text content, use textContent (safe, no HTML parsing)
            safeSetText(element, value);
          }
        }
      });

      // Apply to generic 'hero' sections with data-personalize="hero"
      var heroElements = findPersonalizeElements('hero');
      for (var h = 0; h < heroElements.length; h++) {
        var heroEl = heroElements[h];
        heroEl.setAttribute('data-intent', decision.intent);
        heroEl.setAttribute('data-source', decision.source);

        // If hero has a background image slot, apply it
        if (template.image && !heroEl.querySelector('[data-personalize="image"]')) {
          heroEl.style.backgroundImage = 'url(' + template.image + ')';
        }
      }

      // Log the personalization decision (for debugging/demo)
      if (log && typeof console !== 'undefined') {
        console.log('[Lua Personalize] Applied:', {
          intent: decision.intent,
          source: decision.source,
          headline: template.headline,
          hasUTM: context.hasUTM,
          utmParams: context.utm || {},
          aiPowered: decision.source === 'ai' || decision.source === 'ai-cached'
        });
      }
      return decision;
    }

    // ===================================================================
    // Context Resolution
    // ===================================================================

    /**
     * Resolve context from available sources
     * @param {Object} [options] - Options with optional context
     * @returns {Object} - Resolved context
     */
    function resolveContext(options) {
      if (options && options.context) {
        return options.context;
      }
      if (root.LuaUTM && typeof root.LuaUTM.getContext === 'function') {
        return root.LuaUTM.getContext();
      }

      // No UTM module available - create minimal default context
      return {
        utm: {},
        referrer: {
          source: 'direct',
          category: 'direct',
          url: ''
        },
        userAgent: {
          raw: '',
          isMobile: false,
          isTablet: false,
          isDesktop: true
        },
        timestamp: Date.now(),
        hasUTM: false,
        primaryIntent: 'default'
      };
    }

    // ===================================================================
    // Main Personalization Functions
    // ===================================================================

    /**
     * Apply personalization to the page via data-personalize attributes
     * Main entry point for personalization
     *
     * Supported data-personalize values:
     *   - "hero"        : Generic hero section (sets data-intent, data-source)
     *   - "image"       : Image slot (sets src or background-image)
     *   - "headline"    : Headline text
     *   - "subheadline" : Subheadline text
     *   - "ctaLabel"    : CTA button text
     *   - "ctaLink"     : CTA link href
     *
     * @param {Object} [options] - Configuration options
     * @param {Object} [options.context] - Pre-computed UTM context
     * @param {Object} [options.rules] - Custom matching rules
     * @param {Object} options.templates - User-provided templates (REQUIRED)
     * @param {boolean} [options.enableAI] - Enable AI-powered decisions
     * @param {Object} [options.aiConfig] - AI configuration (required if enableAI is true)
     * @param {boolean} [options.randomFallback] - Enable random A/B fallback (default: true)
     * @param {boolean} [options.log] - Enable console logging (default: true)
     * @returns {Object|Promise<Object>} - Result with applied decision (Promise if AI enabled)
     */
    function personalize(options) {
      options = options || {};

      // Templates are required
      if (!options.templates || typeof options.templates !== 'object' || Object.keys(options.templates).length === 0) {
        console.error('[Lua Personalize] Templates are required. Provide templates via options.templates');
        return {
          template: null,
          intent: 'default',
          source: 'error',
          context: {},
          error: 'No templates provided'
        };
      }
      var context = resolveContext(options);
      var decision = DecisionEngine.decide(context, options);

      // If decision is a Promise (AI path), handle async flow
      if (decision && typeof decision.then === 'function') {
        return decision.then(function (aiDecision) {
          return applyDecisionToDOM(aiDecision, options);
        })["catch"](function (err) {
          console.warn('[Lua Personalize] AI decision failed, using standard:', err.message);
          // Fallback to standard decision + DOM application
          var fallbackDecision = DecisionEngine.standardDecide(context, options);
          return applyDecisionToDOM(fallbackDecision, options);
        });
      }

      // Synchronous path (standard engine)
      return applyDecisionToDOM(decision, options);
    }

    /**
     * Async personalization with timeout fallback
     * Uses LuaUTM.getContextAsync for non-blocking UTM extraction
     * Automatically handles AI decisions (which are always async)
     *
     * @param {Object} [options] - Configuration options
     * @returns {Promise<Object>} - Result with applied decision
     */
    function personalizeAsync(options) {
      options = options || {};

      // Use async context getter if available
      if (root.LuaUTM && typeof root.LuaUTM.getContextAsync === 'function') {
        return root.LuaUTM.getContextAsync(options).then(function (context) {
          options.context = context;
          return personalize(options);
        }).then(function (decision) {
          // Ensure we always return a resolved promise
          return decision;
        })["catch"](function (err) {
          console.warn('[Lua Personalize] Async error, using default:', err);
          // Force standard engine fallback
          var fallbackOptions = {
            templates: options.templates,
            context: resolveContext(options),
            log: options.log
          };
          var fallbackDecision = DecisionEngine.standardDecide(fallbackOptions.context, fallbackOptions);
          return applyDecisionToDOM(fallbackDecision, fallbackOptions);
        });
      }

      // Wrap synchronous/AI personalization in a promise
      try {
        var result = personalize(options);
        // If result is a promise (AI path), return it directly
        if (result && typeof result.then === 'function') {
          return result;
        }
        return Promise.resolve(result);
      } catch (err) {
        console.warn('[Lua Personalize] Error, using default:', err);
        var defaultContext = {
          utm: {},
          referrer: {
            source: 'direct',
            category: 'direct',
            url: ''
          },
          userAgent: {
            raw: '',
            isMobile: false,
            isTablet: false,
            isDesktop: true
          },
          timestamp: Date.now(),
          hasUTM: false,
          primaryIntent: 'default'
        };
        var fallback = DecisionEngine.standardDecide(defaultContext, {
          templates: options.templates
        });
        return Promise.resolve(applyDecisionToDOM(fallback, options));
      }
    }

    /**
     * Auto-initialize personalization when DOM is ready
     * Scans for data-personalize attributes and applies content
     * @param {Object} [options] - Configuration options
     */
    function autoInit(options) {
      options = options || {};
      function run() {
        // Check if there are any data-personalize elements on the page
        var elements = findPersonalizeElements();
        if (elements.length > 0) {
          personalize(options);
        }
      }

      // Wait for DOM ready
      if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', run);
        } else {
          run();
        }
      }
    }

    // ===================================================================
    // Public API - Register on window.LuaPersonalize
    // ===================================================================

    var LuaPersonalize = {
      // Note: Templates are NOT provided by this package
      // Users must provide their own templates via options.templates
      sanitizer: Sanitizer,
      sanitizeHTML: function sanitizeHTML(html) {
        return Sanitizer.sanitize(html);
      },
      safeSetText: safeSetText,
      safeSetHTML: safeSetHTML,
      findElements: findPersonalizeElements,
      getTemplate: getTemplate,
      engine: DecisionEngine,
      personalize: personalize,
      personalizeAsync: personalizeAsync,
      autoInit: autoInit,
      chooseWeightedRandom: chooseWeightedRandom,
      getRandomFallbackIntent: getRandomFallbackIntent,
      applyDecisionToDOM: applyDecisionToDOM,
      resolveContext: resolveContext
    };

    // Expose globally
    root.LuaPersonalize = LuaPersonalize;
  })(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : undefined);

  // this is the build for webpack and UMD builds
  var stores = {
    browserCookie: browserCookie(),
    local: local(),
    memory: memory()
  };
  window.Lua = Lua;
  Lua.stores = stores;

  // Attach UTM and Personalization from window globals (populated by IIFEs)
  Lua.utm = window.LuaUTM || {};
  Lua.personalization = window.LuaPersonalize || {};

  return Lua;

})));
