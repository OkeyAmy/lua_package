
/**
 * AI Personalization Prompt Templates
 * ====================================
 * Provides detailed, structured prompt templates for the AI decision engine.
 * Two modes supported:
 *   - Selection Mode: AI chooses the best variant from user-provided options
 *   - Generation Mode: AI creates new personalized content from scratch
 *
 * Prompts are optimized for GPT-4o-mini with strict JSON output formatting.
 * Based on research from the LOLA framework and content personalization best practices.
 *
 * Registers on window.LuaPrompts
 * No ES6 imports. Self-contained IIFE.
 */
;(function (root) {
    'use strict'

    // ===================================================================
    // System Prompts (role: 'system')
    // ===================================================================

    /**
     * System prompt for SELECTION mode
     * AI selects the best content variant from available options
     */
    var SYSTEM_PROMPT_SELECT = [
        'You are an expert content personalization engine embedded in a website A/B testing library.',
        'Your sole task is to analyze user context and select the single best content variant from a provided list.',
        '',
        'Decision principles:',
        '1. RELEVANCE: Match the user\'s intent, traffic source, and campaign to the most contextually appropriate variant.',
        '2. RECENCY BIAS: Recent user behavior (higher weight) matters more than older visits, but patterns across visits reveal preference.',
        '3. DEVICE AWARENESS: Consider the user\'s device type when selecting content (e.g., shorter copy for mobile).',
        '4. CONVERSION FOCUS: Optimize for click-through and engagement. Prefer variants that speak directly to the user\'s likely motivation.',
        '5. RETURNING USERS: If history shows a returning visitor, favor continuity (similar intent) unless the new context strongly differs.',
        '',
        'CRITICAL RULES:',
        '- You MUST respond with ONLY valid JSON. No markdown, no explanation outside JSON.',
        '- You MUST select from the provided variant keys only. Never invent a variant key.',
        '- The "selectedVariant" field MUST exactly match one of the provided variant keys.',
        '- Include a confidence score (0.0 to 1.0) reflecting how well the variant matches the context.',
        '- Keep "reasoning" under 50 words.'
    ].join('\n')

    /**
     * System prompt for GENERATION mode
     * AI creates new personalized content based on context
     */
    var SYSTEM_PROMPT_GENERATE = [
        'You are an expert conversion copywriter embedded in a website personalization engine.',
        'Your sole task is to generate personalized website content (headline, subheadline, CTA) based on user context.',
        '',
        'Writing principles:',
        '1. RELEVANCE: Tailor the message to the user\'s traffic source, campaign intent, and browsing history.',
        '2. BREVITY: Headlines should be 3-8 words. Subheadlines should be 8-15 words. CTAs should be 2-4 words.',
        '3. URGENCY: Create a sense of value or urgency appropriate to the user\'s intent without being pushy.',
        '4. DEVICE AWARENESS: For mobile users, prefer shorter, punchier copy.',
        '5. TONE MATCHING: Match the tone to the traffic source (e.g., casual for social, professional for LinkedIn).',
        '6. CONTINUITY: For returning users, acknowledge familiarity without being overly personal.',
        '',
        'CRITICAL RULES:',
        '- You MUST respond with ONLY valid JSON. No markdown, no explanation outside JSON.',
        '- Generate content for ALL required fields: headline, subheadline, ctaLabel.',
        '- Content must be brand-safe, professional, and free of offensive language.',
        '- Keep "reasoning" under 50 words.',
        '- If brand context is provided, align your tone and vocabulary with it.'
    ].join('\n')

    // ===================================================================
    // User Prompt Builders (role: 'user')
    // ===================================================================

    /**
     * Build the user prompt for SELECTION mode
     *
     * @param {Object} params - Prompt parameters
     * @param {Object} params.context - Current UTM/referrer/device context
     * @param {string} params.weightedHistory - Formatted history string
     * @param {Object} params.variants - Available template variants (key -> content)
     * @param {Object} [params.preferences] - Aggregated preference scores
     * @returns {string} - Formatted user prompt
     */
    function buildSelectPrompt(params) {
        var ctx = params.context || {}
        var utm = ctx.utm || {}
        var referrer = ctx.referrer || {}
        var userAgent = ctx.userAgent || {}

        var lines = []

        // Current session context
        lines.push('=== CURRENT SESSION CONTEXT ===')
        lines.push('UTM Source: ' + (utm.utm_source || 'none'))
        lines.push('UTM Medium: ' + (utm.utm_medium || 'none'))
        lines.push('UTM Campaign: ' + (utm.utm_campaign || 'none'))
        lines.push('UTM Content: ' + (utm.utm_content || 'none'))
        lines.push('UTM Term: ' + (utm.utm_term || 'none'))
        lines.push('Referrer: ' + (referrer.source || 'direct') + ' (' + (referrer.category || 'direct') + ')')
        lines.push('Device: ' + (userAgent.isMobile ? 'mobile' : userAgent.isTablet ? 'tablet' : 'desktop'))
        lines.push('Has UTM Params: ' + (ctx.hasUTM ? 'yes' : 'no'))
        lines.push('Inferred Intent: ' + (ctx.primaryIntent || 'unknown'))
        lines.push('')

        // Historical context
        lines.push('=== USER HISTORY ===')
        lines.push(params.weightedHistory || 'No history available (new visitor).')
        lines.push('')

        // Preference scores
        if (params.preferences && Object.keys(params.preferences).length > 0) {
            lines.push('=== PREFERENCE SCORES (higher = stronger preference) ===')
            for (var intent in params.preferences) {
                lines.push('  ' + intent + ': ' + params.preferences[intent].toFixed(3))
            }
            lines.push('')
        }

        // Available variants
        lines.push('=== AVAILABLE VARIANTS ===')
        lines.push('Select EXACTLY ONE of the following variant keys:')
        lines.push('')

        var variantKeys = Object.keys(params.variants || {})
        for (var i = 0; i < variantKeys.length; i++) {
            var key = variantKeys[i]
            var variant = params.variants[key]
            lines.push('Key: "' + key + '"')
            if (variant.headline) lines.push('  Headline: ' + variant.headline)
            if (variant.subheadline) lines.push('  Subheadline: ' + variant.subheadline)
            if (variant.ctaLabel) lines.push('  CTA: ' + variant.ctaLabel)
            lines.push('')
        }

        // Response format
        lines.push('=== RESPOND WITH JSON ONLY ===')
        lines.push('{')
        lines.push('  "selectedVariant": "<exact_variant_key>",')
        lines.push('  "confidence": <0.0_to_1.0>,')
        lines.push('  "reasoning": "<brief explanation under 50 words>"')
        lines.push('}')

        return lines.join('\n')
    }

    /**
     * Build the user prompt for GENERATION mode
     *
     * @param {Object} params - Prompt parameters
     * @param {Object} params.context - Current UTM/referrer/device context
     * @param {string} params.weightedHistory - Formatted history string
     * @param {Object} [params.brandContext] - Brand voice/audience info
     * @param {Object} [params.preferences] - Aggregated preference scores
     * @param {Object} [params.fallbackTemplate] - Default template for reference
     * @returns {string} - Formatted user prompt
     */
    function buildGeneratePrompt(params) {
        var ctx = params.context || {}
        var utm = ctx.utm || {}
        var referrer = ctx.referrer || {}
        var userAgent = ctx.userAgent || {}

        var lines = []

        // Current session context
        lines.push('=== CURRENT SESSION CONTEXT ===')
        lines.push('UTM Source: ' + (utm.utm_source || 'none'))
        lines.push('UTM Medium: ' + (utm.utm_medium || 'none'))
        lines.push('UTM Campaign: ' + (utm.utm_campaign || 'none'))
        lines.push('UTM Content: ' + (utm.utm_content || 'none'))
        lines.push('UTM Term: ' + (utm.utm_term || 'none'))
        lines.push('Referrer: ' + (referrer.source || 'direct') + ' (' + (referrer.category || 'direct') + ')')
        lines.push('Device: ' + (userAgent.isMobile ? 'mobile' : userAgent.isTablet ? 'tablet' : 'desktop'))
        lines.push('Has UTM Params: ' + (ctx.hasUTM ? 'yes' : 'no'))
        lines.push('Inferred Intent: ' + (ctx.primaryIntent || 'unknown'))
        lines.push('')

        // Historical context
        lines.push('=== USER HISTORY ===')
        lines.push(params.weightedHistory || 'No history available (new visitor).')
        lines.push('')

        // Preference scores
        if (params.preferences && Object.keys(params.preferences).length > 0) {
            lines.push('=== PREFERENCE SCORES (higher = stronger preference) ===')
            for (var intent in params.preferences) {
                lines.push('  ' + intent + ': ' + params.preferences[intent].toFixed(3))
            }
            lines.push('')
        }

        // Brand context
        if (params.brandContext) {
            lines.push('=== BRAND CONTEXT ===')
            if (params.brandContext.brandVoice) {
                lines.push('Brand Voice: ' + params.brandContext.brandVoice)
            }
            if (params.brandContext.targetAudience) {
                lines.push('Target Audience: ' + params.brandContext.targetAudience)
            }
            if (params.brandContext.productType) {
                lines.push('Product/Service: ' + params.brandContext.productType)
            }
            if (params.brandContext.industry) {
                lines.push('Industry: ' + params.brandContext.industry)
            }
            // Allow arbitrary brand context fields
            var knownFields = { brandVoice: 1, targetAudience: 1, productType: 1, industry: 1 }
            for (var field in params.brandContext) {
                if (!knownFields[field]) {
                    lines.push(field + ': ' + params.brandContext[field])
                }
            }
            lines.push('')
        }

        // Reference template (so AI understands the general structure)
        if (params.fallbackTemplate) {
            lines.push('=== REFERENCE TEMPLATE (for structure/tone guidance) ===')
            if (params.fallbackTemplate.headline) {
                lines.push('  Example Headline: ' + params.fallbackTemplate.headline)
            }
            if (params.fallbackTemplate.subheadline) {
                lines.push('  Example Subheadline: ' + params.fallbackTemplate.subheadline)
            }
            if (params.fallbackTemplate.ctaLabel) {
                lines.push('  Example CTA: ' + params.fallbackTemplate.ctaLabel)
            }
            lines.push('')
        }

        // Response format
        lines.push('=== GENERATE PERSONALIZED CONTENT - RESPOND WITH JSON ONLY ===')
        lines.push('{')
        lines.push('  "headline": "<3-8 words, attention-grabbing>",')
        lines.push('  "subheadline": "<8-15 words, supporting message>",')
        lines.push('  "ctaLabel": "<2-4 words, action-oriented>",')
        lines.push('  "confidence": <0.0_to_1.0>,')
        lines.push('  "reasoning": "<brief explanation under 50 words>"')
        lines.push('}')

        return lines.join('\n')
    }

    /**
     * Build the complete messages array for the OpenAI API
     *
     * @param {string} mode - 'select' or 'generate'
     * @param {Object} params - Prompt parameters (same as buildSelectPrompt/buildGeneratePrompt)
     * @param {Object} [customPrompts] - Optional custom prompts override
     * @param {string} [customPrompts.system] - Custom system prompt
     * @param {string} [customPrompts.user] - Custom user prompt (template string, not used currently)
     * @returns {Array} - Messages array for OpenAI chat completions
     */
    function buildMessages(mode, params, customPrompts) {
        customPrompts = customPrompts || {}

        var systemPrompt
        var userPrompt

        if (mode === 'generate') {
            systemPrompt = customPrompts.system || SYSTEM_PROMPT_GENERATE
            userPrompt = buildGeneratePrompt(params)
        } else {
            // Default to 'select' mode
            systemPrompt = customPrompts.system || SYSTEM_PROMPT_SELECT
            userPrompt = buildSelectPrompt(params)
        }

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ]
    }

    // ===================================================================
    // Public API
    // ===================================================================

    var LuaPrompts = {
        // System prompts (exposed for customization reference)
        SYSTEM_PROMPT_SELECT: SYSTEM_PROMPT_SELECT,
        SYSTEM_PROMPT_GENERATE: SYSTEM_PROMPT_GENERATE,

        // Prompt builders
        buildSelectPrompt: buildSelectPrompt,
        buildGeneratePrompt: buildGeneratePrompt,
        buildMessages: buildMessages
    }

    // Register globally
    root.LuaPrompts = LuaPrompts

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this)
