
/**
 * AI-Powered Personalization Engine
 * ==================================
 * Integrates OpenAI GPT models with the Lua personalization system.
 * Works alongside the existing decision engine as an optional enhancement.
 *
 * Supports two connection modes:
 *   1. Direct OpenAI API (user provides apiKey) - uses https://api.openai.com/v1/chat/completions
 *   2. Proxy URL (user provides apiUrl pointing to their backend)
 *
 * Supports two personalization modes:
 *   - 'select': AI chooses the best variant from user-provided templates
 *   - 'generate': AI creates new personalized content from scratch
 *
 * Depends on:
 *   - window.LuaWeightedHistory (from storage/weighted-history.js)
 *   - window.LuaPrompts (from prompts/personalization-prompts.js)
 *   - window.LuaUTM or window.LuaUTMPersonalize (for context, optional)
 *
 * Registers on window.LuaAIPersonalize
 * No ES6 imports. Self-contained IIFE.
 */
;(function (root) {
    'use strict'

    // ===================================================================
    // Constants & Defaults
    // ===================================================================

    var OPENAI_BASE_URL = 'https://api.openai.com/v1/chat/completions'
    var DEFAULT_MODEL = 'gpt-4o-mini'
    var DEFAULT_TIMEOUT = 5000
    var DEFAULT_MAX_TOKENS = 500
    var DEFAULT_TEMPERATURE = 0.7
    var DEFAULT_MAX_RETRIES = 1
    var CACHE_KEY_PREFIX = 'lua_ai_cache_'
    var DEFAULT_CACHE_DURATION = 3600000 // 1 hour

    // ===================================================================
    // Configuration Validator
    // ===================================================================

    /**
     * Validate and normalize AI configuration
     * @param {Object} config - Raw AI configuration
     * @returns {Object} - Normalized configuration with defaults applied
     */
    function normalizeConfig(config) {
        if (!config || typeof config !== 'object') {
            return { valid: false, error: 'AI config must be an object' }
        }

        // Must have either apiKey or apiUrl
        var hasApiKey = typeof config.apiKey === 'string' && config.apiKey.trim().length > 0
        var hasApiUrl = typeof config.apiUrl === 'string' && config.apiUrl.trim().length > 0

        if (!hasApiKey && !hasApiUrl) {
            return {
                valid: false,
                error: 'AI config requires either "apiKey" (for direct OpenAI) or "apiUrl" (for proxy endpoint)'
            }
        }

        return {
            valid: true,

            // Connection
            apiKey: hasApiKey ? config.apiKey.trim() : null,
            apiUrl: hasApiUrl ? config.apiUrl.trim() : OPENAI_BASE_URL,
            useDirectApi: hasApiKey && !hasApiUrl,

            // Model settings
            model: config.model || DEFAULT_MODEL,
            temperature: typeof config.temperature === 'number' ? config.temperature : DEFAULT_TEMPERATURE,
            maxTokens: typeof config.maxTokens === 'number' ? config.maxTokens : DEFAULT_MAX_TOKENS,

            // Behavior
            mode: config.mode === 'generate' ? 'generate' : 'select',
            timeout: typeof config.timeout === 'number' ? config.timeout : DEFAULT_TIMEOUT,
            maxRetries: typeof config.maxRetries === 'number' ? config.maxRetries : DEFAULT_MAX_RETRIES,
            fallbackToStandard: config.fallbackToStandard !== false,

            // Caching
            cacheDecisions: config.cacheDecisions !== false,
            cacheDuration: typeof config.cacheDuration === 'number' ? config.cacheDuration : DEFAULT_CACHE_DURATION,

            // History
            historyEnabled: config.historyEnabled !== false,
            historyDecayRate: typeof config.historyDecayRate === 'number' ? config.historyDecayRate : 0.9,
            maxHistorySize: typeof config.maxHistorySize === 'number' ? config.maxHistorySize : 10,

            // Brand context (for generate mode)
            brandContext: config.brandContext || null,

            // Custom prompts
            customPrompts: config.customPrompts || {}
        }
    }

    // ===================================================================
    // Cache Management
    // ===================================================================

    /**
     * Generate a cache key from the context (hash-like identifier)
     * @param {Object} context - Current UTM context
     * @param {string} mode - 'select' or 'generate'
     * @returns {string} - Cache key
     */
    function buildCacheKey(context, mode) {
        var parts = [mode]

        if (context.utm) {
            if (context.utm.utm_source) parts.push('s:' + context.utm.utm_source)
            if (context.utm.utm_medium) parts.push('m:' + context.utm.utm_medium)
            if (context.utm.utm_campaign) parts.push('c:' + context.utm.utm_campaign)
        }

        if (context.referrer) {
            parts.push('r:' + (context.referrer.source || 'direct'))
        }

        if (context.userAgent) {
            parts.push('d:' + (context.userAgent.isMobile ? 'mob' : context.userAgent.isTablet ? 'tab' : 'desk'))
        }

        return CACHE_KEY_PREFIX + parts.join('_')
    }

    /**
     * Read a cached AI decision
     * @param {string} cacheKey - Cache key
     * @param {number} cacheDuration - Max age in ms
     * @returns {Object|null} - Cached decision or null if expired/missing
     */
    function readCache(cacheKey, cacheDuration) {
        try {
            if (typeof localStorage === 'undefined') return null
            var raw = localStorage.getItem(cacheKey)
            if (!raw) return null

            var cached = JSON.parse(raw)
            if (!cached || !cached.timestamp || !cached.decision) return null

            // Check expiry
            var age = Date.now() - cached.timestamp
            if (age > cacheDuration) {
                localStorage.removeItem(cacheKey)
                return null
            }

            return cached.decision
        } catch (e) {
            return null
        }
    }

    /**
     * Write an AI decision to cache
     * @param {string} cacheKey - Cache key
     * @param {Object} decision - Decision to cache
     */
    function writeCache(cacheKey, decision) {
        try {
            if (typeof localStorage === 'undefined') return
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                decision: decision
            }))
        } catch (e) {
            console.warn('[Lua AI] Failed to write cache:', e)
        }
    }

    /**
     * Clear all AI decision caches
     */
    function clearCache() {
        try {
            if (typeof localStorage === 'undefined') return
            var keysToRemove = []
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i)
                if (key && key.indexOf(CACHE_KEY_PREFIX) === 0) {
                    keysToRemove.push(key)
                }
            }
            for (var j = 0; j < keysToRemove.length; j++) {
                localStorage.removeItem(keysToRemove[j])
            }
        } catch (e) {
            console.warn('[Lua AI] Failed to clear cache:', e)
        }
    }

    // ===================================================================
    // API Communication
    // ===================================================================

    /**
     * Call the OpenAI API (direct or via proxy)
     * @param {Array} messages - Chat messages array
     * @param {Object} config - Normalized AI config
     * @returns {Promise<Object>} - Parsed AI response
     */
    function callOpenAI(messages, config) {
        var url = config.useDirectApi ? OPENAI_BASE_URL : config.apiUrl

        var headers = {
            'Content-Type': 'application/json'
        }

        // Add Authorization header for direct API access
        if (config.useDirectApi && config.apiKey) {
            headers['Authorization'] = 'Bearer ' + config.apiKey
        }

        var body = {
            model: config.model,
            messages: messages,
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            response_format: { type: 'json_object' }
        }

        // Create abort controller for timeout
        var controller = null
        var timeoutId = null

        if (typeof AbortController !== 'undefined') {
            controller = new AbortController()
            timeoutId = setTimeout(function () {
                controller.abort()
            }, config.timeout)
        }

        var fetchOptions = {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        }

        if (controller) {
            fetchOptions.signal = controller.signal
        }

        return fetch(url, fetchOptions)
            .then(function (response) {
                if (timeoutId) clearTimeout(timeoutId)

                if (!response.ok) {
                    return response.text().then(function (text) {
                        throw new Error('API request failed (' + response.status + '): ' + text.substring(0, 200))
                    })
                }
                return response.json()
            })
            .then(function (data) {
                // Parse OpenAI response structure
                if (data && data.choices && data.choices[0] && data.choices[0].message) {
                    var content = data.choices[0].message.content
                    try {
                        return JSON.parse(content)
                    } catch (e) {
                        // Try to extract JSON from content if it's wrapped in markdown
                        var jsonMatch = content.match(/\{[\s\S]*\}/)
                        if (jsonMatch) {
                            return JSON.parse(jsonMatch[0])
                        }
                        throw new Error('Failed to parse AI response as JSON: ' + content.substring(0, 200))
                    }
                }

                // If the response IS the parsed content (proxy might forward differently)
                if (data && (data.selectedVariant || data.headline)) {
                    return data
                }

                throw new Error('Unexpected API response structure')
            })
            .catch(function (error) {
                if (timeoutId) clearTimeout(timeoutId)

                if (error.name === 'AbortError') {
                    throw new Error('AI request timed out after ' + config.timeout + 'ms')
                }
                throw error
            })
    }

    /**
     * Call OpenAI with retry logic
     * @param {Array} messages - Chat messages
     * @param {Object} config - Normalized config
     * @param {number} [attempt] - Current attempt number
     * @returns {Promise<Object>} - Parsed AI response
     */
    function callWithRetry(messages, config, attempt) {
        attempt = attempt || 0

        return callOpenAI(messages, config).catch(function (error) {
            if (attempt < config.maxRetries) {
                console.warn('[Lua AI] Retry attempt ' + (attempt + 1) + ':', error.message)
                // Exponential backoff: 500ms, 1000ms, 2000ms...
                return new Promise(function (resolve) {
                    setTimeout(function () {
                        resolve(callWithRetry(messages, config, attempt + 1))
                    }, 500 * Math.pow(2, attempt))
                })
            }
            throw error
        })
    }

    // ===================================================================
    // Response Validation
    // ===================================================================

    /**
     * Validate a SELECTION mode response
     * @param {Object} response - Parsed AI response
     * @param {Object} variants - Available variants (to validate key exists)
     * @returns {Object} - { valid: boolean, error?: string }
     */
    function validateSelectResponse(response, variants) {
        if (!response || typeof response !== 'object') {
            return { valid: false, error: 'Response is not an object' }
        }

        if (!response.selectedVariant || typeof response.selectedVariant !== 'string') {
            return { valid: false, error: 'Missing or invalid "selectedVariant" field' }
        }

        // Check that the selected variant actually exists
        if (!variants[response.selectedVariant]) {
            return { valid: false, error: 'Selected variant "' + response.selectedVariant + '" does not exist in templates' }
        }

        return { valid: true }
    }

    /**
     * Validate a GENERATION mode response
     * @param {Object} response - Parsed AI response
     * @returns {Object} - { valid: boolean, error?: string }
     */
    function validateGenerateResponse(response) {
        if (!response || typeof response !== 'object') {
            return { valid: false, error: 'Response is not an object' }
        }

        if (!response.headline || typeof response.headline !== 'string') {
            return { valid: false, error: 'Missing or invalid "headline" field' }
        }

        if (!response.subheadline || typeof response.subheadline !== 'string') {
            return { valid: false, error: 'Missing or invalid "subheadline" field' }
        }

        if (!response.ctaLabel || typeof response.ctaLabel !== 'string') {
            return { valid: false, error: 'Missing or invalid "ctaLabel" field' }
        }

        return { valid: true }
    }

    // ===================================================================
    // AI Decision Engine
    // ===================================================================

    /**
     * Main AI decision function
     * Gathers context, builds prompts, calls API, validates response
     *
     * @param {Object} context - Current UTM/referrer/device context
     * @param {Object} options - Full options object
     * @param {Object} options.templates - User-provided templates (REQUIRED)
     * @param {Object} options.aiConfig - AI configuration (REQUIRED)
     * @param {boolean} [options.log] - Enable logging (default: true)
     * @returns {Promise<Object>} - Decision result { template, intent, source, context, aiResponse }
     */
    function aiDecide(context, options) {
        var config = normalizeConfig(options.aiConfig)

        if (!config.valid) {
            return Promise.reject(new Error('[Lua AI] ' + config.error))
        }

        var templates = options.templates || {}
        var log = options.log !== false

        // Check cache first
        if (config.cacheDecisions) {
            var cacheKey = buildCacheKey(context, config.mode)
            var cached = readCache(cacheKey, config.cacheDuration)
            if (cached) {
                if (log) {
                    console.log('[Lua AI] Using cached decision:', cached.intent)
                }
                cached.source = 'ai-cached'
                return Promise.resolve(cached)
            }
        }

        // Get weighted history
        var HistoryModule = root.LuaWeightedHistory
        var weightedHistory = ''
        var preferences = {}
        var history = null

        if (config.historyEnabled && HistoryModule) {
            history = HistoryModule.getHistory()
            var weighted = HistoryModule.buildWeightedContext(history, {
                decayRate: config.historyDecayRate
            })
            preferences = HistoryModule.aggregatePreferences(weighted)
            weightedHistory = HistoryModule.formatForPrompt(weighted)
        }

        // Get prompt module
        var PromptsModule = root.LuaPrompts

        if (!PromptsModule) {
            return Promise.reject(new Error('[Lua AI] LuaPrompts module not loaded. Include prompts/personalization-prompts.js'))
        }

        // Build prompt parameters
        var promptParams = {
            context: context,
            weightedHistory: weightedHistory,
            preferences: preferences
        }

        if (config.mode === 'select') {
            promptParams.variants = templates
        } else {
            // Generate mode
            promptParams.brandContext = config.brandContext
            promptParams.fallbackTemplate = templates['default'] || templates[Object.keys(templates)[0]] || null
        }

        // Build messages
        var messages = PromptsModule.buildMessages(config.mode, promptParams, config.customPrompts)

        var startTime = Date.now()

        // Call AI
        return callWithRetry(messages, config).then(function (aiResponse) {
            var latency = Date.now() - startTime
            var decision

            if (config.mode === 'select') {
                // Validate selection
                var selectValidation = validateSelectResponse(aiResponse, templates)
                if (!selectValidation.valid) {
                    throw new Error('Invalid AI selection: ' + selectValidation.error)
                }

                decision = {
                    template: templates[aiResponse.selectedVariant],
                    intent: aiResponse.selectedVariant,
                    source: 'ai',
                    context: context,
                    aiResponse: {
                        confidence: aiResponse.confidence || null,
                        reasoning: aiResponse.reasoning || null,
                        latency: latency,
                        model: config.model,
                        mode: 'select',
                        cached: false
                    }
                }
            } else {
                // Validate generation
                var genValidation = validateGenerateResponse(aiResponse)
                if (!genValidation.valid) {
                    throw new Error('Invalid AI generation: ' + genValidation.error)
                }

                // Build a template from generated content
                var generatedTemplate = {
                    headline: aiResponse.headline,
                    subheadline: aiResponse.subheadline,
                    ctaLabel: aiResponse.ctaLabel,
                    ctaLink: (templates['default'] && templates['default'].ctaLink) || '/shop',
                    image: (templates['default'] && templates['default'].image) || null
                }

                decision = {
                    template: generatedTemplate,
                    intent: 'ai-generated',
                    source: 'ai',
                    context: context,
                    aiResponse: {
                        confidence: aiResponse.confidence || null,
                        reasoning: aiResponse.reasoning || null,
                        latency: latency,
                        model: config.model,
                        mode: 'generate',
                        cached: false
                    }
                }
            }

            // Cache the decision
            if (config.cacheDecisions) {
                writeCache(buildCacheKey(context, config.mode), decision)
            }

            // Record visit to history
            if (config.historyEnabled && HistoryModule) {
                HistoryModule.recordVisit({
                    context: context,
                    intent: decision.intent,
                    selectedVariant: decision.intent,
                    source: 'ai',
                    aiDecision: true
                }, {
                    maxHistorySize: config.maxHistorySize
                })
            }

            if (log) {
                console.log('[Lua AI] Decision made:', {
                    mode: config.mode,
                    intent: decision.intent,
                    source: 'ai',
                    confidence: decision.aiResponse.confidence,
                    latency: latency + 'ms',
                    model: config.model
                })
            }

            return decision

        }).catch(function (error) {
            var latency = Date.now() - startTime

            if (log) {
                console.warn('[Lua AI] Error after ' + latency + 'ms:', error.message)
            }

            throw error
        })
    }

    // ===================================================================
    // Integration Helpers
    // ===================================================================

    /**
     * High-level AI personalize function
     * Wraps aiDecide with full context gathering and DOM application
     * Designed to be called from the main personalize() function
     *
     * @param {Object} options - Full personalization options
     * @param {Object} options.templates - User templates (REQUIRED)
     * @param {Object} options.aiConfig - AI configuration (REQUIRED)
     * @param {Object} [options.context] - Pre-computed context
     * @param {boolean} [options.log] - Enable logging
     * @returns {Promise<Object>} - Decision result
     */
    function personalizeWithAI(options) {
        options = options || {}

        // Get context
        var context = options.context

        if (!context) {
            // Try to get context from UTM modules
            var utmModule = root.LuaUTMPersonalize || root.LuaUTM
            if (utmModule && typeof utmModule.getContext === 'function') {
                context = utmModule.getContext()
            } else {
                context = {
                    utm: {},
                    referrer: { source: 'direct', category: 'direct', url: '' },
                    userAgent: { raw: '', isMobile: false, isTablet: false, isDesktop: true },
                    timestamp: Date.now(),
                    hasUTM: false,
                    primaryIntent: 'default'
                }
            }
        }

        return aiDecide(context, options)
    }

    /**
     * Quick check: is AI properly configured and ready?
     * @param {Object} aiConfig - AI config to check
     * @returns {Object} - { ready: boolean, error?: string }
     */
    function isReady(aiConfig) {
        var config = normalizeConfig(aiConfig)
        if (!config.valid) {
            return { ready: false, error: config.error }
        }

        // Check dependencies
        if (!root.LuaPrompts) {
            return { ready: false, error: 'LuaPrompts module not loaded' }
        }

        // History is optional but recommended
        if (!root.LuaWeightedHistory) {
            console.warn('[Lua AI] LuaWeightedHistory not loaded. History features disabled.')
        }

        return { ready: true }
    }

    // ===================================================================
    // Public API
    // ===================================================================

    var LuaAIPersonalize = {
        // Core
        decide: aiDecide,
        personalizeWithAI: personalizeWithAI,
        isReady: isReady,

        // Configuration
        normalizeConfig: normalizeConfig,

        // API communication
        callOpenAI: callOpenAI,

        // Validation
        validateSelectResponse: validateSelectResponse,
        validateGenerateResponse: validateGenerateResponse,

        // Cache
        clearCache: clearCache,

        // Constants
        OPENAI_BASE_URL: OPENAI_BASE_URL,
        DEFAULT_MODEL: DEFAULT_MODEL,
        DEFAULT_TIMEOUT: DEFAULT_TIMEOUT,
        DEFAULT_CACHE_DURATION: DEFAULT_CACHE_DURATION
    }

    // Register globally
    root.LuaAIPersonalize = LuaAIPersonalize

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this)
