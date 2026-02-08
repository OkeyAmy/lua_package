
/**
 * UTM Parameter Extraction & Context Detection
 * Uses native URLSearchParams API for extracting UTM parameters
 * and document.referrer/navigator.userAgent for context inference
 *
 * No ES6 imports - self-contained IIFE that registers on window.LuaUTM
 * Can be loaded standalone via <script> tag or bundled by Rollup
 */
;(function (root) {
    'use strict'

    // Default timeout for async operations (1 second max as recommended)
    var UTM_TIMEOUT_MS = 1000

    // Allowed UTM parameter names
    var UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']

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
    }

    // Referrer category mapping
    var REFERRER_CATEGORIES = {
        search: ['google', 'bing', 'yahoo', 'duckduckgo'],
        social: ['facebook', 'twitter', 'instagram', 'linkedin', 'pinterest', 'tiktok', 'youtube', 'reddit']
    }

    /**
     * Safely extracts UTM parameters from URL using native URLSearchParams API
     * @param {string} [url] - URL to parse (defaults to window.location.search)
     * @returns {Object} - Object containing UTM parameters
     */
    function extractUTMParams(url) {
        var result = {}

        try {
            var searchString = url || (typeof window !== 'undefined' ? window.location.search : '')

            if (!searchString) {
                return result
            }

            // Use native URLSearchParams API
            var params = new URLSearchParams(searchString)

            UTM_PARAMS.forEach(function (param) {
                var value = params.get(param)
                if (value) {
                    // Sanitize: only allow alphanumeric, dashes, underscores
                    result[param] = sanitizeParam(value)
                }
            })
        } catch (e) {
            // Fallback: return empty object on any error
            console.warn('[Lua UTM] Error extracting UTM params:', e)
        }

        return result
    }

    /**
     * Sanitize parameter value to prevent XSS
     * Only allows alphanumeric, dashes, underscores, and spaces
     * @param {string} value - Raw parameter value
     * @returns {string} - Sanitized value
     */
    function sanitizeParam(value) {
        if (typeof value !== 'string') return ''
        // Remove any HTML tags and special characters
        return value
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/[^\w\s\-_.]/g, '') // Only allow safe characters
            .substring(0, 100) // Limit length
            .trim()
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
        }

        try {
            if (typeof document === 'undefined' || !document.referrer) {
                return result
            }

            result.url = document.referrer

            // Check for email patterns in referrer
            if (/mail\.|email\.|newsletter/i.test(document.referrer)) {
                result.source = 'email'
                result.category = 'email'
                return result
            }

            // Check against known patterns
            for (var source in REFERRER_PATTERNS) {
                if (REFERRER_PATTERNS[source].test(document.referrer)) {
                    result.source = source

                    // Determine category
                    for (var category in REFERRER_CATEGORIES) {
                        if (REFERRER_CATEGORIES[category].indexOf(source) !== -1) {
                            result.category = category
                            break
                        }
                    }

                    return result
                }
            }

            // Unknown external referrer
            result.source = 'external'
            result.category = 'other'

        } catch (e) {
            console.warn('[Lua UTM] Error detecting referrer:', e)
        }

        return result
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
        }

        try {
            if (typeof navigator === 'undefined' || !navigator.userAgent) {
                return result
            }

            result.raw = navigator.userAgent

            // Mobile detection
            result.isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            result.isTablet = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent)
            result.isDesktop = !result.isMobile && !result.isTablet

        } catch (e) {
            console.warn('[Lua UTM] Error getting user agent:', e)
        }

        return result
    }

    /**
     * Get full personalization context
     * Combines UTM params, referrer info, and user agent
     * @param {Object} [options] - Configuration options
     * @param {string} [options.url] - Custom URL to parse
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

        // Determine if we have UTM data
        context.hasUTM = Object.keys(context.utm).length > 0

        // Infer primary intent
        context.primaryIntent = inferIntent(context)

        return context
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
            var campaign = context.utm.utm_campaign.toLowerCase()

            if (/sale|discount|offer|promo/i.test(campaign)) return 'price-focused'
            if (/gaming|game|esport/i.test(campaign)) return 'gaming'
            if (/work|office|professional|productivity/i.test(campaign)) return 'professional'
            if (/creative|design|art|studio/i.test(campaign)) return 'creative'
            if (/brand|story|about/i.test(campaign)) return 'brand-story'
        }

        // Priority 2: UTM source can indicate intent
        if (context.utm.utm_source) {
            var source = context.utm.utm_source.toLowerCase()

            if (/google|bing|yahoo/i.test(source)) return 'search-optimized'
            if (/facebook|instagram|tiktok/i.test(source)) return 'social-visual'
            if (/twitter|x$/i.test(source)) return 'social-brief'
            if (/email|newsletter/i.test(source)) return 'returning-user'
            if (/youtube/i.test(source)) return 'video-engaged'
        }

        // Priority 3: Referrer category
        if (context.referrer.category === 'search') return 'search-optimized'
        if (context.referrer.category === 'social') return 'social-visual'
        if (context.referrer.category === 'email') return 'returning-user'

        // Default
        return 'default'
    }

    /**
     * Get context with timeout fallback
     * Returns default context if operation takes too long
     * @param {Object} [options] - Configuration options
     * @param {number} [options.timeout] - Timeout in ms (default: 1000)
     * @returns {Promise<Object>} - Context object
     */
    function getContextAsync(options) {
        options = options || {}
        var timeout = options.timeout || UTM_TIMEOUT_MS

        return new Promise(function (resolve) {
            var timer = setTimeout(function () {
                // Timeout: return default context
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
    }

    // Expose globally
    root.LuaUTM = LuaUTM

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this)
