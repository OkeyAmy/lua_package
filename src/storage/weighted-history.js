
/**
 * Weighted History Manager
 * ========================
 * Manages localStorage for user visit history with exponential decay.
 * Tracks user visits with timestamps, UTM params, intents, and selected variants.
 * Applies configurable exponential decay so recent visits carry more weight.
 *
 * Storage key: 'lua_personalize_history'
 * Registers on window.LuaWeightedHistory
 *
 * No ES6 imports. Self-contained IIFE.
 */
;(function (root) {
    'use strict'

    // ===================================================================
    // Constants
    // ===================================================================

    var STORAGE_KEY = 'lua_personalize_history'
    var DEFAULT_DECAY_RATE = 0.9
    var DEFAULT_MAX_HISTORY = 10
    var DEFAULT_MAX_WEIGHTED = 5
    var MS_PER_DAY = 1000 * 60 * 60 * 24

    // ===================================================================
    // UUID Generator (simple, no crypto dependency)
    // ===================================================================

    /**
     * Generate a simple UUID v4
     * Uses crypto.getRandomValues when available, Math.random fallback
     * @returns {string} - UUID string
     */
    function generateUUID() {
        try {
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                var buf = new Uint8Array(16)
                crypto.getRandomValues(buf)
                buf[6] = (buf[6] & 0x0f) | 0x40
                buf[8] = (buf[8] & 0x3f) | 0x80
                var hex = ''
                for (var i = 0; i < 16; i++) {
                    var h = buf[i].toString(16)
                    hex += h.length === 1 ? '0' + h : h
                }
                return (
                    hex.substring(0, 8) + '-' +
                    hex.substring(8, 12) + '-' +
                    hex.substring(12, 16) + '-' +
                    hex.substring(16, 20) + '-' +
                    hex.substring(20, 32)
                )
            }
        } catch (e) {
            // Fallback below
        }

        // Math.random fallback
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (Math.random() * 16) | 0
            var v = c === 'x' ? r : (r & 0x3) | 0x8
            return v.toString(16)
        })
    }

    // ===================================================================
    // LocalStorage Helpers
    // ===================================================================

    /**
     * Check if localStorage is available
     * @returns {boolean}
     */
    function isLocalStorageAvailable() {
        try {
            if (typeof localStorage === 'undefined') return false
            var testKey = '__lua_test__'
            localStorage.setItem(testKey, '1')
            localStorage.removeItem(testKey)
            return true
        } catch (e) {
            return false
        }
    }

    /**
     * Read history from localStorage
     * @returns {Object|null} - Parsed history object or null
     */
    function readFromStorage() {
        if (!isLocalStorageAvailable()) return null
        try {
            var raw = localStorage.getItem(STORAGE_KEY)
            if (!raw) return null
            var parsed = JSON.parse(raw)
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed.visits)) {
                return parsed
            }
            return null
        } catch (e) {
            console.warn('[Lua History] Failed to read history:', e)
            return null
        }
    }

    /**
     * Write history to localStorage
     * @param {Object} history - History object to persist
     * @returns {boolean} - Whether the write was successful
     */
    function writeToStorage(history) {
        if (!isLocalStorageAvailable()) return false
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
            return true
        } catch (e) {
            console.warn('[Lua History] Failed to write history:', e)
            return false
        }
    }

    // ===================================================================
    // Weighted Decay Functions
    // ===================================================================

    /**
     * Calculate the weight of a visit based on its age using exponential decay
     * Weight = decayRate ^ daysAgo
     * Example: decayRate=0.9, 1 day ago = 0.9, 7 days ago = 0.478, 30 days ago = 0.042
     *
     * @param {number} timestamp - Visit timestamp in ms
     * @param {number} [decayRate] - Decay rate per day (0-1, default: 0.9)
     * @returns {number} - Weight between 0 and 1
     */
    function calculateWeight(timestamp, decayRate) {
        decayRate = typeof decayRate === 'number' ? decayRate : DEFAULT_DECAY_RATE
        var now = Date.now()
        var daysAgo = Math.max(0, (now - timestamp) / MS_PER_DAY)
        return Math.pow(decayRate, daysAgo)
    }

    /**
     * Build weighted context from visit history
     * Returns the most relevant visits sorted by weight (highest first)
     *
     * @param {Object} history - History object with visits array
     * @param {Object} [options] - Configuration
     * @param {number} [options.decayRate] - Decay rate (default: 0.9)
     * @param {number} [options.maxWeighted] - Max results to return (default: 5)
     * @returns {Array} - Weighted visits sorted by relevance
     */
    function buildWeightedContext(history, options) {
        options = options || {}
        var decayRate = options.decayRate || DEFAULT_DECAY_RATE
        var maxWeighted = options.maxWeighted || DEFAULT_MAX_WEIGHTED

        if (!history || !Array.isArray(history.visits) || history.visits.length === 0) {
            return []
        }

        var weighted = []

        for (var i = 0; i < history.visits.length; i++) {
            var visit = history.visits[i]
            var weight = calculateWeight(visit.timestamp, decayRate)

            weighted.push({
                timestamp: visit.timestamp,
                weight: Math.round(weight * 1000) / 1000,
                intent: visit.intent || 'unknown',
                selectedVariant: visit.selectedVariant || null,
                source: visit.source || 'unknown',
                aiDecision: visit.aiDecision || false,
                context: visit.context || {}
            })
        }

        // Sort by weight descending (most recent / relevant first)
        weighted.sort(function (a, b) {
            return b.weight - a.weight
        })

        // Return top N results
        return weighted.slice(0, maxWeighted)
    }

    /**
     * Aggregate intent preferences from weighted history
     * Produces a score map of intents weighted by recency
     *
     * @param {Array} weightedVisits - Output of buildWeightedContext
     * @returns {Object} - Intent -> score mapping
     */
    function aggregatePreferences(weightedVisits) {
        var scores = {}

        for (var i = 0; i < weightedVisits.length; i++) {
            var visit = weightedVisits[i]
            var intent = visit.intent
            if (!intent || intent === 'unknown' || intent === 'default') continue

            if (!scores[intent]) {
                scores[intent] = 0
            }
            scores[intent] += visit.weight
        }

        return scores
    }

    // ===================================================================
    // History Management
    // ===================================================================

    /**
     * Initialize or retrieve existing history
     * Creates a new history object with a UUID if none exists
     *
     * @returns {Object} - History object
     */
    function getHistory() {
        var history = readFromStorage()

        if (!history) {
            history = {
                userId: generateUUID(),
                createdAt: Date.now(),
                visits: [],
                preferences: {}
            }
            writeToStorage(history)
        }

        return history
    }

    /**
     * Record a new visit to history
     *
     * @param {Object} visitData - Visit data to record
     * @param {Object} visitData.context - UTM context (utm, referrer, userAgent)
     * @param {string} visitData.intent - Inferred or AI-selected intent
     * @param {string} visitData.selectedVariant - Selected template/variant key
     * @param {string} visitData.source - Decision source ('ai', 'utm', 'referrer', 'random-ab', etc.)
     * @param {boolean} [visitData.aiDecision] - Whether AI made this decision
     * @param {Object} [options] - Configuration
     * @param {number} [options.maxHistorySize] - Max visits to keep (default: 10)
     * @returns {Object} - Updated history object
     */
    function recordVisit(visitData, options) {
        options = options || {}
        var maxHistorySize = options.maxHistorySize || DEFAULT_MAX_HISTORY

        var history = getHistory()

        // Build a minimal context to store (avoid storing sensitive/large data)
        var minimalContext = {}
        if (visitData.context) {
            if (visitData.context.utm) {
                minimalContext.utm = visitData.context.utm
            }
            if (visitData.context.referrer) {
                minimalContext.referrer = {
                    source: visitData.context.referrer.source,
                    category: visitData.context.referrer.category
                }
            }
            if (visitData.context.userAgent) {
                minimalContext.device = visitData.context.userAgent.isMobile
                    ? 'mobile'
                    : visitData.context.userAgent.isTablet
                        ? 'tablet'
                        : 'desktop'
            }
        }

        var visit = {
            timestamp: Date.now(),
            context: minimalContext,
            intent: visitData.intent || 'unknown',
            selectedVariant: visitData.selectedVariant || null,
            source: visitData.source || 'unknown',
            aiDecision: !!visitData.aiDecision
        }

        history.visits.push(visit)

        // Trim to max size (keep most recent)
        if (history.visits.length > maxHistorySize) {
            history.visits = history.visits.slice(-maxHistorySize)
        }

        // Update aggregated preferences
        var weighted = buildWeightedContext(history, options)
        history.preferences = aggregatePreferences(weighted)

        writeToStorage(history)

        return history
    }

    /**
     * Get the user ID from history (creates one if needed)
     * @returns {string} - User UUID
     */
    function getUserId() {
        var history = getHistory()
        return history.userId
    }

    /**
     * Check if this is a returning user (has previous visits)
     * @returns {boolean}
     */
    function isReturningUser() {
        var history = readFromStorage()
        return history !== null && Array.isArray(history.visits) && history.visits.length > 0
    }

    /**
     * Get the most recent visit from history
     * @returns {Object|null} - Most recent visit or null
     */
    function getLastVisit() {
        var history = readFromStorage()
        if (!history || !Array.isArray(history.visits) || history.visits.length === 0) {
            return null
        }
        return history.visits[history.visits.length - 1]
    }

    /**
     * Format weighted history as a human-readable string for AI prompts
     * @param {Array} weightedVisits - Output of buildWeightedContext
     * @returns {string} - Formatted string
     */
    function formatForPrompt(weightedVisits) {
        if (!weightedVisits || weightedVisits.length === 0) {
            return 'No previous visit history available. This is a new visitor.'
        }

        var lines = []
        lines.push('Previous visits (' + weightedVisits.length + ' recorded, weighted by recency):')

        for (var i = 0; i < weightedVisits.length; i++) {
            var v = weightedVisits[i]
            var date = new Date(v.timestamp)
            var dateStr = date.toISOString().split('T')[0]
            var line = '  - [' + dateStr + '] '
            line += 'Intent: ' + v.intent
            if (v.selectedVariant) line += ', Variant: ' + v.selectedVariant
            line += ', Source: ' + v.source
            line += ', Weight: ' + v.weight
            if (v.context && v.context.utm && v.context.utm.utm_source) {
                line += ', UTM: ' + v.context.utm.utm_source
            }
            lines.push(line)
        }

        return lines.join('\n')
    }

    /**
     * Clear all history (useful for testing or user request)
     * @returns {boolean} - Whether the clear was successful
     */
    function clearHistory() {
        if (!isLocalStorageAvailable()) return false
        try {
            localStorage.removeItem(STORAGE_KEY)
            return true
        } catch (e) {
            return false
        }
    }

    // ===================================================================
    // Public API
    // ===================================================================

    var LuaWeightedHistory = {
        // Core functions
        getHistory: getHistory,
        recordVisit: recordVisit,
        getUserId: getUserId,
        isReturningUser: isReturningUser,
        getLastVisit: getLastVisit,
        clearHistory: clearHistory,

        // Weighted context
        calculateWeight: calculateWeight,
        buildWeightedContext: buildWeightedContext,
        aggregatePreferences: aggregatePreferences,
        formatForPrompt: formatForPrompt,

        // Utilities
        isLocalStorageAvailable: isLocalStorageAvailable,
        generateUUID: generateUUID,

        // Constants
        STORAGE_KEY: STORAGE_KEY,
        DEFAULT_DECAY_RATE: DEFAULT_DECAY_RATE,
        DEFAULT_MAX_HISTORY: DEFAULT_MAX_HISTORY
    }

    // Register globally
    root.LuaWeightedHistory = LuaWeightedHistory

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this)
