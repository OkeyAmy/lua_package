
/**
 * DOM Personalization Engine
 * Handles content injection with data-personalize attributes
 * Uses textContent for text, DOMPurify-style sanitized HTML for rich content
 *
 * No ES6 imports - self-contained IIFE that registers on window.LuaPersonalize
 * Depends on window.LuaUTM (from utm.js) for context extraction
 * Falls back to random A/B test when no UTM params are present
 */
;(function (root) {
    'use strict'

    // ===================================================================
    // DOMPurify-style HTML Sanitizer (inline, OWASP-recommended approach)
    // Provides safe HTML injection without external dependencies
    // ===================================================================

    /**
     * Inline DOMPurify-style sanitizer
     * Uses the browser's DOMParser to safely parse and sanitize HTML
     * Falls back to regex-based sanitization if DOMParser unavailable
     */
    var Sanitizer = (function () {

        // Allowed HTML tags (safe for content injection)
        var ALLOWED_TAGS = {
            'p': true, 'span': true, 'strong': true, 'em': true,
            'b': true, 'i': true, 'br': true, 'a': true, 'img': true,
            'h1': true, 'h2': true, 'h3': true, 'h4': true, 'h5': true, 'h6': true,
            'div': true, 'section': true, 'ul': true, 'ol': true, 'li': true,
            'blockquote': true, 'figure': true, 'figcaption': true
        }

        // Allowed HTML attributes (safe subset)
        var ALLOWED_ATTRS = {
            'href': true, 'src': true, 'alt': true, 'class': true,
            'id': true, 'title': true, 'target': true, 'rel': true,
            'width': true, 'height': true, 'loading': true
        }

        // Dangerous URI schemes
        var DANGEROUS_URI = /^(javascript|vbscript|data):/i

        // Event handler pattern (onclick, onerror, onload, etc.)
        var EVENT_HANDLER = /^on/i

        /**
         * Check if DOMParser is available (modern browsers)
         * @returns {boolean}
         */
        function hasDOMParser() {
            try {
                return typeof DOMParser !== 'undefined' && new DOMParser()
            } catch (e) {
                return false
            }
        }

        /**
         * Sanitize HTML using DOMParser (preferred, secure method)
         * Parses HTML into a DOM tree, walks nodes, and rebuilds safe HTML
         * @param {string} dirty - Untrusted HTML string
         * @returns {string} - Sanitized HTML string
         */
        function sanitizeWithDOMParser(dirty) {
            if (typeof dirty !== 'string' || !dirty.trim()) return ''

            try {
                var parser = new DOMParser()
                var doc = parser.parseFromString(dirty, 'text/html')
                var body = doc.body

                if (!body) return ''

                return walkAndClean(body)
            } catch (e) {
                console.warn('[Lua Sanitizer] DOMParser failed, using fallback:', e)
                return sanitizeWithRegex(dirty)
            }
        }

        /**
         * Recursively walk DOM nodes and build clean HTML
         * @param {Node} node - DOM node to process
         * @returns {string} - Cleaned HTML string
         */
        function walkAndClean(node) {
            var output = ''

            for (var i = 0; i < node.childNodes.length; i++) {
                var child = node.childNodes[i]

                // Text node - safe to include
                if (child.nodeType === 3) {
                    output += escapeText(child.textContent)
                    continue
                }

                // Element node
                if (child.nodeType === 1) {
                    var tagName = child.tagName.toLowerCase()

                    // Skip disallowed tags entirely (including children)
                    if (tagName === 'script' || tagName === 'style' ||
                        tagName === 'iframe' || tagName === 'object' ||
                        tagName === 'embed' || tagName === 'form' ||
                        tagName === 'input' || tagName === 'textarea') {
                        continue
                    }

                    // If tag is allowed, include it with filtered attributes
                    if (ALLOWED_TAGS[tagName]) {
                        output += '<' + tagName
                        output += cleanAttributes(child)
                        output += '>'

                        // Self-closing tags
                        if (tagName === 'br' || tagName === 'img') {
                            continue
                        }

                        // Recurse into children
                        output += walkAndClean(child)
                        output += '</' + tagName + '>'
                    } else {
                        // Tag not allowed - include children only (strip the tag)
                        output += walkAndClean(child)
                    }
                }
            }

            return output
        }

        /**
         * Filter element attributes to only allowed ones
         * @param {Element} element - DOM element
         * @returns {string} - Attribute string
         */
        function cleanAttributes(element) {
            var attrStr = ''
            var attrs = element.attributes

            for (var i = 0; i < attrs.length; i++) {
                var attr = attrs[i]
                var name = attr.name.toLowerCase()
                var value = attr.value

                // Skip event handlers (onclick, onerror, etc.)
                if (EVENT_HANDLER.test(name)) continue

                // Skip disallowed attributes
                if (!ALLOWED_ATTRS[name]) continue

                // Check URI safety for href/src
                if ((name === 'href' || name === 'src') && DANGEROUS_URI.test(value.trim())) {
                    continue
                }

                // Add rel="noopener noreferrer" for external links
                if (name === 'target' && value === '_blank') {
                    attrStr += ' target="_blank" rel="noopener noreferrer"'
                    continue
                }

                attrStr += ' ' + name + '="' + escapeAttr(value) + '"'
            }

            return attrStr
        }

        /**
         * Escape text content for safe HTML inclusion
         * @param {string} text - Raw text
         * @returns {string} - Escaped text
         */
        function escapeText(text) {
            if (!text) return ''
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
        }

        /**
         * Escape attribute value for safe HTML inclusion
         * @param {string} value - Raw attribute value
         * @returns {string} - Escaped attribute value
         */
        function escapeAttr(value) {
            if (!value) return ''
            return value
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
        }

        /**
         * Fallback regex-based sanitizer for environments without DOMParser
         * @param {string} html - Raw HTML string
         * @returns {string} - Sanitized HTML
         */
        function sanitizeWithRegex(html) {
            if (typeof html !== 'string') return ''

            var DANGEROUS_PATTERNS = [
                /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
                /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
                /<embed\b[^>]*>/gi,
                /<link\b[^>]*>/gi,
                /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
                /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
                /javascript:/gi,
                /vbscript:/gi,
                /data:/gi,
                /on\w+\s*=/gi
            ]

            var sanitized = html

            DANGEROUS_PATTERNS.forEach(function (pattern) {
                sanitized = sanitized.replace(pattern, '')
            })

            // Remove disallowed tags but keep their text content
            sanitized = sanitized.replace(/<\/?(\w+)([^>]*)>/g, function (match, tagName, attrs) {
                var tag = tagName.toLowerCase()
                if (!ALLOWED_TAGS[tag]) return ''

                // For closing tags, just return the closing tag
                if (match.charAt(1) === '/') return '</' + tag + '>'

                // Filter attributes
                var cleanAttrs = ''
                var attrRegex = /(\w+)=['"]([^'"]*)['"]/g
                var attrMatch

                while ((attrMatch = attrRegex.exec(attrs)) !== null) {
                    var attrName = attrMatch[1].toLowerCase()
                    if (ALLOWED_ATTRS[attrName] && !EVENT_HANDLER.test(attrName)) {
                        var val = attrMatch[2]
                        if ((attrName === 'href' || attrName === 'src') && DANGEROUS_URI.test(val)) {
                            continue
                        }
                        cleanAttrs += ' ' + attrName + '="' + val + '"'
                    }
                }

                return '<' + tag + cleanAttrs + '>'
            })

            return sanitized
        }

        // Public sanitizer API
        return {
            /**
             * Sanitize HTML string (main entry point)
             * Uses DOMParser when available, regex fallback otherwise
             * @param {string} dirty - Untrusted HTML
             * @returns {string} - Sanitized HTML
             */
            sanitize: function (dirty) {
                if (typeof dirty !== 'string') return ''
                if (!dirty.trim()) return ''

                if (hasDOMParser()) {
                    return sanitizeWithDOMParser(dirty)
                }
                return sanitizeWithRegex(dirty)
            },

            escapeText: escapeText,
            escapeAttr: escapeAttr
        }
    })()

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
        if (!element) return
        element.textContent = text
    }

    /**
     * Safely set HTML content on an element (DOMPurify-sanitized)
     * @param {Element} element - DOM element
     * @param {string} html - HTML to set (will be sanitized)
     */
    function safeSetHTML(element, html) {
        if (!element) return
        element.innerHTML = Sanitizer.sanitize(html)
    }

    /**
     * Find all elements with data-personalize attribute
     * @param {string} [key] - Optional specific key to find
     * @param {Element} [searchRoot] - Root element to search from (default: document)
     * @returns {NodeList|Array} - Matching elements
     */
    function findPersonalizeElements(key, searchRoot) {
        searchRoot = searchRoot || (typeof document !== 'undefined' ? document : null)
        if (!searchRoot) return []

        var selector = key
            ? '[data-personalize="' + key + '"]'
            : '[data-personalize]'

        return searchRoot.querySelectorAll(selector)
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
            console.warn('[Lua Personalize] No templates provided. Templates must be passed via options.templates')
            return null
        }

        // Try to get the intent template
        if (userTemplates[intent]) {
            return userTemplates[intent]
        }

        // Fall back to 'default' template if available
        if (userTemplates['default']) {
            return userTemplates['default']
        }

        // If no default, return the first available template
        var firstKey = Object.keys(userTemplates)[0]
        if (firstKey) {
            console.warn('[Lua Personalize] Intent "' + intent + '" not found, using first available template:', firstKey)
            return userTemplates[firstKey]
        }

        return null
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
        if (names.length !== weights.length) return names[0]
        var sum = 0
        var i
        for (i = 0; i < weights.length; i++) {
            sum += weights[i]
        }
        var n = Math.random() * sum
        var limit = 0
        for (i = 0; i < names.length; i++) {
            limit += weights[i]
            if (n <= limit) return names[i]
        }
        return names[names.length - 1]
    }

    /**
     * Get a random template key from user-provided templates
     * Used as fallback when no UTM/referrer context is available
     * @param {Object} userTemplates - User-provided templates (required)
     * @returns {string|null} - Random template intent key or null if no templates
     */
    function getRandomFallbackIntent(userTemplates) {
        if (!userTemplates || typeof userTemplates !== 'object') {
            return null
        }

        var names = Object.keys(userTemplates)
        if (names.length === 0) {
            return null
        }

        var weights = []
        for (var i = 0; i < names.length; i++) {
            weights.push(1) // Equal weight by default
        }
        return chooseWeightedRandom(names, weights)
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
        standardDecide: function (context, options) {
            options = options || {}
            var customRules = options.rules || {}
            var userTemplates = options.templates
            var enableRandomFallback = options.randomFallback !== false

            // Templates are required - warn if not provided
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

            // Determine the source of the decision
            if (context.hasUTM) {
                source = 'utm'
            } else if (context.referrer && context.referrer.category !== 'direct') {
                source = 'referrer'
            }

            // Check custom rules first (highest priority)
            for (var ruleKey in customRules) {
                var rule = customRules[ruleKey]
                if (typeof rule.match === 'function' && rule.match(context)) {
                    intent = rule.intent || ruleKey
                    source = 'custom-rule'
                    break
                }
            }

            // If intent is still 'default' and random fallback is enabled,
            // pick a random template for A/B testing
            if (intent === 'default' && source === 'default' && enableRandomFallback) {
                var randomIntent = getRandomFallbackIntent(userTemplates)
                if (randomIntent) {
                    intent = randomIntent
                    source = 'random-ab'
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
         * @param {Object} context - Context from LuaUTM.getContext()
         * @param {Object} [options] - Configuration options
         * @param {boolean} [options.enableAI] - Enable AI-powered decisions
         * @param {Object} [options.aiConfig] - AI configuration
         * @returns {Object|Promise<Object>} - Decision result (Promise if AI enabled)
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
                            // AI failed - fall back to standard engine
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

            // Standard decision (synchronous)
            return this.standardDecide(context, options)
        }
    }

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
        options = options || {}
        var template = decision.template
        var context = decision.context || {}
        var log = options.log !== false

        if (!template) {
            console.warn('[Lua Personalize] No template in decision, skipping DOM update')
            return decision
        }

        // Find and update each personalize slot in the DOM
        var slots = ['image', 'headline', 'subheadline', 'ctaLabel', 'ctaLink']

        slots.forEach(function (slot) {
            var elements = findPersonalizeElements(slot)

            for (var i = 0; i < elements.length; i++) {
                var element = elements[i]
                var value = template[slot]
                if (!value) continue

                if (slot === 'image') {
                    // For images, set background-image or src attribute
                    if (element.tagName === 'IMG') {
                        element.src = value
                        element.alt = template.headline || 'Personalized image'
                    } else {
                        element.style.backgroundImage = 'url(' + value + ')'
                    }
                } else if (slot === 'ctaLink') {
                    // For links, set href attribute
                    element.href = value
                } else {
                    // For text content, use textContent (safe, no HTML parsing)
                    safeSetText(element, value)
                }
            }
        })

        // Apply to generic 'hero' sections with data-personalize="hero"
        var heroElements = findPersonalizeElements('hero')
        for (var h = 0; h < heroElements.length; h++) {
            var heroEl = heroElements[h]
            heroEl.setAttribute('data-intent', decision.intent)
            heroEl.setAttribute('data-source', decision.source)

            // If hero has a background image slot, apply it
            if (template.image && !heroEl.querySelector('[data-personalize="image"]')) {
                heroEl.style.backgroundImage = 'url(' + template.image + ')'
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
            })
        }

        return decision
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
            return options.context
        }

        if (root.LuaUTM && typeof root.LuaUTM.getContext === 'function') {
            return root.LuaUTM.getContext()
        }

        // No UTM module available - create minimal default context
        return {
            utm: {},
            referrer: { source: 'direct', category: 'direct', url: '' },
            userAgent: { raw: '', isMobile: false, isTablet: false, isDesktop: true },
            timestamp: Date.now(),
            hasUTM: false,
            primaryIntent: 'default'
        }
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

        var context = resolveContext(options)
        var decision = DecisionEngine.decide(context, options)

        // If decision is a Promise (AI path), handle async flow
        if (decision && typeof decision.then === 'function') {
            return decision.then(function (aiDecision) {
                return applyDecisionToDOM(aiDecision, options)
            }).catch(function (err) {
                console.warn('[Lua Personalize] AI decision failed, using standard:', err.message)
                // Fallback to standard decision + DOM application
                var fallbackDecision = DecisionEngine.standardDecide(context, options)
                return applyDecisionToDOM(fallbackDecision, options)
            })
        }

        // Synchronous path (standard engine)
        return applyDecisionToDOM(decision, options)
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
        options = options || {}

        // Use async context getter if available
        if (root.LuaUTM && typeof root.LuaUTM.getContextAsync === 'function') {
            return root.LuaUTM.getContextAsync(options).then(function (context) {
                options.context = context
                return personalize(options)
            }).then(function (decision) {
                // Ensure we always return a resolved promise
                return decision
            }).catch(function (err) {
                console.warn('[Lua Personalize] Async error, using default:', err)
                // Force standard engine fallback
                var fallbackOptions = {
                    templates: options.templates,
                    context: resolveContext(options),
                    log: options.log
                }
                var fallbackDecision = DecisionEngine.standardDecide(fallbackOptions.context, fallbackOptions)
                return applyDecisionToDOM(fallbackDecision, fallbackOptions)
            })
        }

        // Wrap synchronous/AI personalization in a promise
        try {
            var result = personalize(options)
            // If result is a promise (AI path), return it directly
            if (result && typeof result.then === 'function') {
                return result
            }
            return Promise.resolve(result)
        } catch (err) {
            console.warn('[Lua Personalize] Error, using default:', err)
            var defaultContext = {
                utm: {},
                referrer: { source: 'direct', category: 'direct', url: '' },
                userAgent: { raw: '', isMobile: false, isTablet: false, isDesktop: true },
                timestamp: Date.now(),
                hasUTM: false,
                primaryIntent: 'default'
            }
            var fallback = DecisionEngine.standardDecide(defaultContext, { templates: options.templates })
            return Promise.resolve(applyDecisionToDOM(fallback, options))
        }
    }

    /**
     * Auto-initialize personalization when DOM is ready
     * Scans for data-personalize attributes and applies content
     * @param {Object} [options] - Configuration options
     */
    function autoInit(options) {
        options = options || {}

        function run() {
            // Check if there are any data-personalize elements on the page
            var elements = findPersonalizeElements()
            if (elements.length > 0) {
                personalize(options)
            }
        }

        // Wait for DOM ready
        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', run)
            } else {
                run()
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
        sanitizeHTML: function (html) { return Sanitizer.sanitize(html) },
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
    }

    // Expose globally
    root.LuaPersonalize = LuaPersonalize

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this)
