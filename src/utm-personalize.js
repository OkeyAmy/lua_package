
/**
 * Lua UTM Personalization - Standalone Bundle
 * ============================================
 * Self-contained script combining:
 *   - URLSearchParams-based UTM extraction
 *   - Referrer & user agent detection
 *   - Intent inference engine
 *   - DOMPurify-style HTML sanitizer
 *   - DOM personalization via data-personalize attributes
 *   - Random A/B test fallback when no UTM params present
 *
 * Usage:
 *   <script src="utm-personalize.js" defer></script>
 *
 *   <!-- Then in your HTML use data-personalize attributes: -->
 *   <div data-personalize="hero">
 *     <h1 data-personalize="headline">Default Headline</h1>
 *     <p data-personalize="subheadline">Default subheadline</p>
 *     <a href="#" data-personalize="ctaLink">
 *       <span data-personalize="ctaLabel">Default CTA</span>
 *     </a>
 *   </div>
 *
 * The script auto-initializes on DOMContentLoaded.
 * Access the API via window.LuaUTMPersonalize
 *
 * Size target: < 50KB
 * No imports. No dependencies. No build step required.
 */
;(function (root) {
    'use strict'

    // ===================================================================
    // 1. UTM PARAMETER EXTRACTION (URLSearchParams API)
    // ===================================================================

    var UTM_TIMEOUT_MS = 1000

    var UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']

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
    }

    var REFERRER_CATEGORIES = {
        search: ['google', 'bing', 'yahoo', 'duckduckgo'],
        social: ['facebook', 'twitter', 'instagram', 'linkedin', 'pinterest', 'tiktok', 'youtube', 'reddit']
    }

    /**
     * Sanitize a UTM parameter value to prevent XSS
     * @param {string} value - Raw parameter value
     * @returns {string} - Sanitized value
     */
    function sanitizeParam(value) {
        if (typeof value !== 'string') return ''
        return value
            .replace(/<[^>]*>/g, '')
            .replace(/[^\w\s\-_.]/g, '')
            .substring(0, 100)
            .trim()
    }

    /**
     * Extract UTM parameters from URL using native URLSearchParams API
     * @param {string} [url] - URL search string (defaults to window.location.search)
     * @returns {Object} - Object containing UTM parameters
     */
    function extractUTMParams(url) {
        var result = {}
        try {
            var searchString = url || (typeof root.location !== 'undefined' ? root.location.search : '')
            if (!searchString) return result

            var params = new URLSearchParams(searchString)

            UTM_PARAMS.forEach(function (param) {
                var value = params.get(param)
                if (value) {
                    result[param] = sanitizeParam(value)
                }
            })
        } catch (e) {
            console.warn('[Lua UTM] Error extracting UTM params:', e)
        }
        return result
    }

    /**
     * Detect referrer type from document.referrer
     * @returns {Object} - { source, category, url }
     */
    function detectReferrer() {
        var result = { source: 'direct', category: 'direct', url: '' }
        try {
            if (typeof document === 'undefined' || !document.referrer) return result

            result.url = document.referrer

            if (/mail\.|email\.|newsletter/i.test(document.referrer)) {
                result.source = 'email'
                result.category = 'email'
                return result
            }

            for (var source in REFERRER_PATTERNS) {
                if (REFERRER_PATTERNS[source].test(document.referrer)) {
                    result.source = source
                    for (var category in REFERRER_CATEGORIES) {
                        if (REFERRER_CATEGORIES[category].indexOf(source) !== -1) {
                            result.category = category
                            break
                        }
                    }
                    return result
                }
            }

            result.source = 'external'
            result.category = 'other'
        } catch (e) {
            console.warn('[Lua UTM] Error detecting referrer:', e)
        }
        return result
    }

    /**
     * Get user agent info for device detection
     * @returns {Object} - { raw, isMobile, isTablet, isDesktop }
     */
    function getUserAgentInfo() {
        var result = { raw: '', isMobile: false, isTablet: false, isDesktop: true }
        try {
            if (typeof navigator === 'undefined' || !navigator.userAgent) return result
            result.raw = navigator.userAgent
            result.isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            result.isTablet = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent)
            result.isDesktop = !result.isMobile && !result.isTablet
        } catch (e) {
            console.warn('[Lua UTM] Error getting user agent:', e)
        }
        return result
    }

    /**
     * Infer user intent from context
     * Priority: UTM campaign > UTM source > Referrer category
     * @param {Object} context - Full context object
     * @returns {string} - Inferred intent key
     */
    function inferIntent(context) {
        if (context.utm.utm_campaign) {
            var campaign = context.utm.utm_campaign.toLowerCase()
            if (/sale|discount|offer|promo/i.test(campaign)) return 'price-focused'
            if (/gaming|game|esport/i.test(campaign)) return 'gaming'
            if (/work|office|professional|productivity/i.test(campaign)) return 'professional'
            if (/creative|design|art|studio/i.test(campaign)) return 'creative'
            if (/brand|story|about/i.test(campaign)) return 'brand-story'
        }

        if (context.utm.utm_source) {
            var source = context.utm.utm_source.toLowerCase()
            if (/google|bing|yahoo/i.test(source)) return 'search-optimized'
            if (/facebook|instagram|tiktok/i.test(source)) return 'social-visual'
            if (/twitter|x$/i.test(source)) return 'social-brief'
            if (/email|newsletter/i.test(source)) return 'returning-user'
            if (/youtube/i.test(source)) return 'video-engaged'
        }

        if (context.referrer.category === 'search') return 'search-optimized'
        if (context.referrer.category === 'social') return 'social-visual'
        if (context.referrer.category === 'email') return 'returning-user'

        return 'default'
    }

    /**
     * Build full personalization context
     * @param {Object} [options] - { url: string }
     * @returns {Object} - Complete context object
     */
    function getContext(options) {
        options = options || {}
        var context = {
            utm: extractUTMParams(options.url),
            referrer: detectReferrer(),
            userAgent: getUserAgentInfo(),
            timestamp: Date.now(),
            hasUTM: false,
            primaryIntent: 'unknown'
        }
        context.hasUTM = Object.keys(context.utm).length > 0
        context.primaryIntent = inferIntent(context)
        return context
    }

    /**
     * Async context with timeout fallback (1 second max)
     * @param {Object} [options] - { timeout: number, url: string }
     * @returns {Promise<Object>} - Context object
     */
    function getContextAsync(options) {
        options = options || {}
        var timeout = options.timeout || UTM_TIMEOUT_MS

        return new Promise(function (resolve) {
            var timer = setTimeout(function () {
                resolve({
                    utm: {},
                    referrer: { source: 'direct', category: 'direct', url: '' },
                    userAgent: { raw: '', isMobile: false, isTablet: false, isDesktop: true },
                    timestamp: Date.now(),
                    hasUTM: false,
                    primaryIntent: 'default',
                    timedOut: true
                })
            }, timeout)

            try {
                var context = getContext(options)
                clearTimeout(timer)
                context.timedOut = false
                resolve(context)
            } catch (e) {
                clearTimeout(timer)
                resolve({
                    utm: {},
                    referrer: { source: 'direct', category: 'direct', url: '' },
                    userAgent: { raw: '', isMobile: false, isTablet: false, isDesktop: true },
                    timestamp: Date.now(),
                    hasUTM: false,
                    primaryIntent: 'default',
                    error: e.message
                })
            }
        })
    }

    // ===================================================================
    // 2. DOMPURIFY-STYLE HTML SANITIZER
    // ===================================================================

    var Sanitizer = (function () {
        var ALLOWED_TAGS = {
            'p': true, 'span': true, 'strong': true, 'em': true,
            'b': true, 'i': true, 'br': true, 'a': true, 'img': true,
            'h1': true, 'h2': true, 'h3': true, 'h4': true, 'h5': true, 'h6': true,
            'div': true, 'section': true, 'ul': true, 'ol': true, 'li': true,
            'blockquote': true, 'figure': true, 'figcaption': true
        }

        var ALLOWED_ATTRS = {
            'href': true, 'src': true, 'alt': true, 'class': true,
            'id': true, 'title': true, 'target': true, 'rel': true,
            'width': true, 'height': true, 'loading': true
        }

        var DANGEROUS_URI = /^(javascript|vbscript|data):/i
        var EVENT_HANDLER = /^on/i

        function hasDOMParser() {
            try { return typeof DOMParser !== 'undefined' && new DOMParser() }
            catch (e) { return false }
        }

        function escapeText(text) {
            if (!text) return ''
            return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        }

        function escapeAttr(value) {
            if (!value) return ''
            return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        }

        function cleanAttributes(element) {
            var attrStr = ''
            var attrs = element.attributes
            for (var i = 0; i < attrs.length; i++) {
                var name = attrs[i].name.toLowerCase()
                var value = attrs[i].value
                if (EVENT_HANDLER.test(name)) continue
                if (!ALLOWED_ATTRS[name]) continue
                if ((name === 'href' || name === 'src') && DANGEROUS_URI.test(value.trim())) continue
                if (name === 'target' && value === '_blank') {
                    attrStr += ' target="_blank" rel="noopener noreferrer"'
                    continue
                }
                attrStr += ' ' + name + '="' + escapeAttr(value) + '"'
            }
            return attrStr
        }

        function walkAndClean(node) {
            var output = ''
            for (var i = 0; i < node.childNodes.length; i++) {
                var child = node.childNodes[i]
                if (child.nodeType === 3) { output += escapeText(child.textContent); continue }
                if (child.nodeType === 1) {
                    var tag = child.tagName.toLowerCase()
                    if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object' || tag === 'embed' || tag === 'form' || tag === 'input' || tag === 'textarea') continue
                    if (ALLOWED_TAGS[tag]) {
                        output += '<' + tag + cleanAttributes(child) + '>'
                        if (tag !== 'br' && tag !== 'img') {
                            output += walkAndClean(child)
                            output += '</' + tag + '>'
                        }
                    } else {
                        output += walkAndClean(child)
                    }
                }
            }
            return output
        }

        function sanitizeWithDOMParser(dirty) {
            try {
                var doc = new DOMParser().parseFromString(dirty, 'text/html')
                return doc.body ? walkAndClean(doc.body) : ''
            } catch (e) {
                return sanitizeWithRegex(dirty)
            }
        }

        function sanitizeWithRegex(html) {
            var patterns = [
                /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
                /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
                /<embed\b[^>]*>/gi, /<link\b[^>]*>/gi,
                /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
                /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
                /javascript:/gi, /vbscript:/gi, /data:/gi, /on\w+\s*=/gi
            ]
            var sanitized = html
            patterns.forEach(function (p) { sanitized = sanitized.replace(p, '') })
            sanitized = sanitized.replace(/<\/?(\w+)([^>]*)>/g, function (match, tagName, attrs) {
                var tag = tagName.toLowerCase()
                if (!ALLOWED_TAGS[tag]) return ''
                if (match.charAt(1) === '/') return '</' + tag + '>'
                var cleanAttrs = ''
                var re = /(\w+)=['"]([^'"]*)['"]/g
                var m
                while ((m = re.exec(attrs)) !== null) {
                    var n = m[1].toLowerCase()
                    if (ALLOWED_ATTRS[n] && !EVENT_HANDLER.test(n)) {
                        if ((n === 'href' || n === 'src') && DANGEROUS_URI.test(m[2])) continue
                        cleanAttrs += ' ' + n + '="' + m[2] + '"'
                    }
                }
                return '<' + tag + cleanAttrs + '>'
            })
            return sanitized
        }

        return {
            sanitize: function (dirty) {
                if (typeof dirty !== 'string' || !dirty.trim()) return ''
                return hasDOMParser() ? sanitizeWithDOMParser(dirty) : sanitizeWithRegex(dirty)
            },
            escapeText: escapeText,
            escapeAttr: escapeAttr
        }
    })()

    // ===================================================================
    // 3. TEMPLATES & ASSETS
    // ===================================================================
    // NOTE: Templates are NOT provided by this package.
    // Users must provide their own templates via options.templates
    // This keeps the package modular and allows users full control
    // over their content, assets, and personalization strategy.

    // ===================================================================
    // 4. DOM PERSONALIZATION ENGINE
    // ===================================================================

    function safeSetText(element, text) {
        if (!element) return
        element.textContent = text
    }

    function safeSetHTML(element, html) {
        if (!element) return
        element.innerHTML = Sanitizer.sanitize(html)
    }

    function findPersonalizeElements(key, searchRoot) {
        searchRoot = searchRoot || (typeof document !== 'undefined' ? document : null)
        if (!searchRoot) return []
        var selector = key ? '[data-personalize="' + key + '"]' : '[data-personalize]'
        return searchRoot.querySelectorAll(selector)
    }

    function getTemplate(intent, userTemplates) {
        if (!userTemplates || typeof userTemplates !== 'object') {
            console.warn('[Lua Personalize] No templates provided. Templates must be passed via options.templates')
            return null
        }
        if (userTemplates[intent]) return userTemplates[intent]
        if (userTemplates['default']) return userTemplates['default']
        var firstKey = Object.keys(userTemplates)[0]
        if (firstKey) {
            console.warn('[Lua Personalize] Intent "' + intent + '" not found, using first available template:', firstKey)
            return userTemplates[firstKey]
        }
        return null
    }

    // ===================================================================
    // 5. RANDOM A/B FALLBACK
    // ===================================================================

    function chooseWeightedRandom(names, weights) {
        if (names.length !== weights.length) return names[0]
        var sum = 0
        var i
        for (i = 0; i < weights.length; i++) { sum += weights[i] }
        var n = Math.random() * sum
        var limit = 0
        for (i = 0; i < names.length; i++) {
            limit += weights[i]
            if (n <= limit) return names[i]
        }
        return names[names.length - 1]
    }

    function getRandomFallbackIntent(userTemplates) {
        if (!userTemplates || typeof userTemplates !== 'object') return null
        var names = Object.keys(userTemplates)
        if (names.length === 0) return null
        var weights = []
        for (var i = 0; i < names.length; i++) { weights.push(1) }
        return chooseWeightedRandom(names, weights)
    }

    // ===================================================================
    // 6. DECISION ENGINE
    // ===================================================================

    var DecisionEngine = {
        /**
         * Standard (non-AI) decision logic
         * Priority: Custom rules > UTM params > Referrer > Random A/B
         */
        standardDecide: function (context, options) {
            options = options || {}
            var customRules = options.rules || {}
            var userTemplates = options.templates
            var enableRandomFallback = options.randomFallback !== false

            if (!userTemplates || typeof userTemplates !== 'object' || Object.keys(userTemplates).length === 0) {
                console.warn('[Lua Personalize] No templates provided. Templates must be passed via options.templates')
                return {
                    template: null,
                    intent: 'default',
                    source: 'error',
                    context: context,
                    error: 'No templates provided'
                }
            }

            var intent = context.primaryIntent
            var source = 'default'

            if (context.hasUTM) {
                source = 'utm'
            } else if (context.referrer && context.referrer.category !== 'direct') {
                source = 'referrer'
            }

            for (var ruleKey in customRules) {
                var rule = customRules[ruleKey]
                if (typeof rule.match === 'function' && rule.match(context)) {
                    intent = rule.intent || ruleKey
                    source = 'custom-rule'
                    break
                }
            }

            if (intent === 'default' && source === 'default' && enableRandomFallback) {
                var randomIntent = getRandomFallbackIntent(userTemplates)
                if (randomIntent) {
                    intent = randomIntent
                    source = 'random-ab'
                }
            }

            // Record visit to history if available
            if (root.LuaWeightedHistory && typeof root.LuaWeightedHistory.recordVisit === 'function') {
                root.LuaWeightedHistory.recordVisit({
                    context: context,
                    intent: intent,
                    selectedVariant: intent,
                    source: source,
                    aiDecision: false
                })
            }

            return {
                template: getTemplate(intent, userTemplates),
                intent: intent,
                source: source,
                context: context
            }
        },

        /**
         * Main decide function - routes to AI or standard engine
         * @param {Object} context - UTM context
         * @param {Object} [options] - Configuration options
         * @param {boolean} [options.enableAI] - Enable AI-powered decisions
         * @param {Object} [options.aiConfig] - AI configuration
         * @returns {Object|Promise<Object>} - Decision result
         */
        decide: function (context, options) {
            options = options || {}

            // If AI is enabled and configured, try AI decision first
            if (options.enableAI && options.aiConfig && root.LuaAIPersonalize) {
                var self = this
                var aiModule = root.LuaAIPersonalize
                var readiness = aiModule.isReady(options.aiConfig)

                if (readiness.ready) {
                    return aiModule.decide(context, options)
                        .catch(function (error) {
                            var fallback = options.aiConfig.fallbackToStandard !== false
                            if (fallback) {
                                console.warn('[Lua Personalize] AI failed, using standard engine:', error.message)
                                return self.standardDecide(context, options)
                            }
                            throw error
                        })
                } else {
                    console.warn('[Lua Personalize] AI not ready:', readiness.error, '- using standard engine')
                }
            }

            return this.standardDecide(context, options)
        }
    }

    // ===================================================================
    // 7. DOM APPLICATION (extracted for reuse)
    // ===================================================================

    /**
     * Apply a decision to the DOM
     * @param {Object} decision - Decision object { template, intent, source, context }
     * @param {Object} [options] - Configuration options
     * @returns {Object} - The decision (pass-through)
     */
    function applyDecisionToDOM(decision, options) {
        options = options || {}
        var template = decision.template
        var context = decision.context || {}
        var log = options.log !== false

        if (!template) {
            console.warn('[Lua Personalize] No template in decision, skipping DOM update')
            return decision
        }

        var slots = ['image', 'headline', 'subheadline', 'ctaLabel', 'ctaLink']

        slots.forEach(function (slot) {
            var elements = findPersonalizeElements(slot)
            for (var i = 0; i < elements.length; i++) {
                var el = elements[i]
                var value = template[slot]
                if (!value) continue

                if (slot === 'image') {
                    if (el.tagName === 'IMG') {
                        el.src = value
                        el.alt = template.headline || 'Personalized image'
                    } else {
                        el.style.backgroundImage = 'url(' + value + ')'
                    }
                } else if (slot === 'ctaLink') {
                    el.href = value
                } else {
                    safeSetText(el, value)
                }
            }
        })

        // Apply to data-personalize="hero" elements
        var heroElements = findPersonalizeElements('hero')
        for (var h = 0; h < heroElements.length; h++) {
            var heroEl = heroElements[h]
            heroEl.setAttribute('data-intent', decision.intent)
            heroEl.setAttribute('data-source', decision.source)
            if (template.image && !heroEl.querySelector('[data-personalize="image"]')) {
                heroEl.style.backgroundImage = 'url(' + template.image + ')'
            }
        }

        if (log && typeof console !== 'undefined') {
            console.log('[Lua Personalize] Applied:', {
                intent: decision.intent,
                source: decision.source,
                headline: template.headline,
                hasUTM: context.hasUTM,
                utmParams: context.utm || {},
                aiPowered: decision.source === 'ai' || decision.source === 'ai-cached'
            })
        }

        return decision
    }

    // ===================================================================
    // 8. MAIN PERSONALIZATION FUNCTION
    // ===================================================================

    /**
     * Apply personalization to the page
     * Scans for data-personalize attributes and injects content
     * Supports AI-powered decisions when enableAI is true
     *
     * @param {Object} [options] - Configuration
     * @param {Object} [options.context] - Pre-computed context
     * @param {Object} [options.rules] - Custom rules
     * @param {Object} options.templates - User-provided templates (REQUIRED)
     * @param {boolean} [options.enableAI] - Enable AI-powered decisions
     * @param {Object} [options.aiConfig] - AI configuration
     * @param {boolean} [options.randomFallback] - Enable random A/B (default: true)
     * @param {boolean} [options.log] - Enable logging (default: true)
     * @returns {Object|Promise<Object>} - Decision result (Promise if AI enabled)
     */
    function personalize(options) {
        options = options || {}

        // Templates are required
        if (!options.templates || typeof options.templates !== 'object' || Object.keys(options.templates).length === 0) {
            console.error('[Lua Personalize] Templates are required. Provide templates via options.templates')
            return {
                template: null,
                intent: 'default',
                source: 'error',
                context: {},
                error: 'No templates provided'
            }
        }

        var context = options.context || getContext(options)
        var decision = DecisionEngine.decide(context, options)

        // If decision is a Promise (AI path), handle async
        if (decision && typeof decision.then === 'function') {
            return decision.then(function (aiDecision) {
                return applyDecisionToDOM(aiDecision, options)
            }).catch(function (err) {
                console.warn('[Lua Personalize] AI decision failed, using standard:', err.message)
                var fallbackDecision = DecisionEngine.standardDecide(context, options)
                return applyDecisionToDOM(fallbackDecision, options)
            })
        }

        // Synchronous path
        return applyDecisionToDOM(decision, options)
    }

    /**
     * Async personalization with timeout fallback
     * Automatically handles AI decisions (which are always async)
     */
    function personalizeAsync(options) {
        options = options || {}
        return getContextAsync(options).then(function (context) {
            options.context = context
            return personalize(options)
        }).then(function (decision) {
            return decision
        }).catch(function (err) {
            console.warn('[Lua Personalize] Async error, using default:', err)
            var ctx = getContext(options)
            var fallback = DecisionEngine.standardDecide(ctx, { templates: options.templates })
            return applyDecisionToDOM(fallback, options)
        })
    }

    // ===================================================================
    // 9. AUTO-INITIALIZATION
    // ===================================================================

    /**
     * Auto-initialize personalization on DOMContentLoaded
     * Only runs if data-personalize elements exist in the DOM
     */
    function autoInit(options) {
        options = options || {}

        function run() {
            var elements = findPersonalizeElements()
            if (elements.length > 0) {
                personalize(options)
            }
        }

        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', run)
            } else {
                run()
            }
        }
    }

    // ===================================================================
    // 10. PUBLIC API
    // ===================================================================

    var LuaUTMPersonalize = {
        // UTM extraction
        extractUTMParams: extractUTMParams,
        sanitizeParam: sanitizeParam,
        detectReferrer: detectReferrer,
        getUserAgentInfo: getUserAgentInfo,
        getContext: getContext,
        getContextAsync: getContextAsync,
        inferIntent: inferIntent,

        // Sanitizer
        sanitizer: Sanitizer,
        sanitizeHTML: function (html) { return Sanitizer.sanitize(html) },

        // DOM helpers
        safeSetText: safeSetText,
        safeSetHTML: safeSetHTML,
        findElements: findPersonalizeElements,
        applyDecisionToDOM: applyDecisionToDOM,

        // Templates (users must provide their own via options.templates)
        getTemplate: getTemplate,

        // Decision engine
        engine: DecisionEngine,
        chooseWeightedRandom: chooseWeightedRandom,
        getRandomFallbackIntent: getRandomFallbackIntent,

        // Main API
        personalize: personalize,
        personalizeAsync: personalizeAsync,
        autoInit: autoInit,

        // Constants
        UTM_PARAMS: UTM_PARAMS,
        UTM_TIMEOUT_MS: UTM_TIMEOUT_MS,
        REFERRER_PATTERNS: REFERRER_PATTERNS,
        REFERRER_CATEGORIES: REFERRER_CATEGORIES
    }

    // Register globally
    root.LuaUTMPersonalize = LuaUTMPersonalize

    // Also register individual modules for compatibility
    if (!root.LuaUTM) {
        root.LuaUTM = {
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
        }
    }
    if (!root.LuaPersonalize) {
        root.LuaPersonalize = {
            sanitizer: Sanitizer,
            sanitizeHTML: function (html) { return Sanitizer.sanitize(html) },
            safeSetText: safeSetText,
            safeSetHTML: safeSetHTML,
            findElements: findPersonalizeElements,
            applyDecisionToDOM: applyDecisionToDOM,
            getTemplate: getTemplate,
            engine: DecisionEngine,
            personalize: personalize,
            personalizeAsync: personalizeAsync,
            autoInit: autoInit,
            chooseWeightedRandom: chooseWeightedRandom,
            getRandomFallbackIntent: getRandomFallbackIntent
        }
    }

    // Note: autoInit() is NOT called automatically because templates are required
    // Users must call personalize() or personalizeAsync() with their templates

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this)
