
/**
 * Tests for AI Personalization Engine
 * Tests config validation, API communication, response validation, and caching
 */

// Mock localStorage
const localStorageMock = (function () {
    let store = {}
    return {
        getItem: jest.fn(function (key) { return store[key] || null }),
        setItem: jest.fn(function (key, val) { store[key] = String(val) }),
        removeItem: jest.fn(function (key) { delete store[key] }),
        clear: jest.fn(function () { store = {} }),
        get length() { return Object.keys(store).length },
        key: jest.fn(function (i) { return Object.keys(store)[i] || null })
    }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock })

// Mock crypto
Object.defineProperty(global, 'crypto', {
    value: {
        getRandomValues: function (buf) {
            for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256)
            return buf
        }
    }
})

// Mock fetch
global.fetch = jest.fn()
global.AbortController = class {
    constructor() { this.signal = {} }
    abort() {}
}

// Load modules in order (dependencies first)
require('../storage/weighted-history')
require('../prompts/personalization-prompts')
require('../ai-personalize')

const LuaAIPersonalize = global.LuaAIPersonalize
const LuaPrompts = global.LuaPrompts
const LuaWeightedHistory = global.LuaWeightedHistory

const mockTemplates = {
    'gaming': {
        headline: 'Level Up Your Setup',
        subheadline: 'Pro gear for serious gamers.',
        ctaLabel: 'Explore Gaming',
        ctaLink: '/gaming',
        image: 'gaming.jpg'
    },
    'professional': {
        headline: 'Work Smarter',
        subheadline: 'Premium productivity tools.',
        ctaLabel: 'View Collection',
        ctaLink: '/professional',
        image: 'pro.jpg'
    },
    'default': {
        headline: 'Welcome',
        subheadline: 'Discover products.',
        ctaLabel: 'Shop Now',
        ctaLink: '/shop',
        image: 'default.jpg'
    }
}

const mockContext = {
    utm: { utm_source: 'reddit', utm_campaign: 'gaming_console' },
    referrer: { source: 'reddit', category: 'social', url: 'https://reddit.com' },
    userAgent: { isMobile: false, isTablet: false, isDesktop: true, raw: '' },
    timestamp: Date.now(),
    hasUTM: true,
    primaryIntent: 'gaming'
}

beforeEach(() => {
    localStorageMock.clear()
    jest.clearAllMocks()
    global.fetch.mockReset()
})

describe('LuaAIPersonalize', () => {
    it('should be registered on global', () => {
        expect(LuaAIPersonalize).toBeDefined()
        expect(typeof LuaAIPersonalize.decide).toBe('function')
        expect(typeof LuaAIPersonalize.normalizeConfig).toBe('function')
    })

    describe('normalizeConfig', () => {
        it('should reject null config', () => {
            const result = LuaAIPersonalize.normalizeConfig(null)
            expect(result.valid).toBe(false)
        })

        it('should reject config without apiKey or apiUrl', () => {
            const result = LuaAIPersonalize.normalizeConfig({})
            expect(result.valid).toBe(false)
            expect(result.error).toContain('apiKey')
        })

        it('should accept config with apiKey', () => {
            const result = LuaAIPersonalize.normalizeConfig({ apiKey: 'sk-test123' })
            expect(result.valid).toBe(true)
            expect(result.useDirectApi).toBe(true)
            expect(result.apiKey).toBe('sk-test123')
        })

        it('should accept config with apiUrl', () => {
            const result = LuaAIPersonalize.normalizeConfig({ apiUrl: 'https://proxy.example.com/api' })
            expect(result.valid).toBe(true)
            expect(result.useDirectApi).toBe(false)
            expect(result.apiUrl).toBe('https://proxy.example.com/api')
        })

        it('should apply defaults for missing fields', () => {
            const result = LuaAIPersonalize.normalizeConfig({ apiKey: 'sk-test' })
            expect(result.model).toBe('gpt-4o-mini')
            expect(result.mode).toBe('select')
            expect(result.timeout).toBe(5000)
            expect(result.maxRetries).toBe(1)
            expect(result.fallbackToStandard).toBe(true)
            expect(result.cacheDecisions).toBe(true)
            expect(result.historyEnabled).toBe(true)
            expect(result.historyDecayRate).toBe(0.9)
        })

        it('should use custom values when provided', () => {
            const result = LuaAIPersonalize.normalizeConfig({
                apiKey: 'sk-test',
                model: 'gpt-4o',
                mode: 'generate',
                timeout: 10000,
                temperature: 0.5,
                maxTokens: 1000
            })
            expect(result.model).toBe('gpt-4o')
            expect(result.mode).toBe('generate')
            expect(result.timeout).toBe(10000)
            expect(result.temperature).toBe(0.5)
            expect(result.maxTokens).toBe(1000)
        })

        it('should prefer apiUrl over direct when both provided', () => {
            const result = LuaAIPersonalize.normalizeConfig({
                apiKey: 'sk-test',
                apiUrl: 'https://proxy.com/api'
            })
            expect(result.useDirectApi).toBe(false)
            expect(result.apiUrl).toBe('https://proxy.com/api')
        })
    })

    describe('validateSelectResponse', () => {
        it('should accept valid selection response', () => {
            const result = LuaAIPersonalize.validateSelectResponse(
                { selectedVariant: 'gaming', confidence: 0.9, reasoning: 'test' },
                mockTemplates
            )
            expect(result.valid).toBe(true)
        })

        it('should reject missing selectedVariant', () => {
            const result = LuaAIPersonalize.validateSelectResponse(
                { confidence: 0.9 },
                mockTemplates
            )
            expect(result.valid).toBe(false)
        })

        it('should reject non-existent variant', () => {
            const result = LuaAIPersonalize.validateSelectResponse(
                { selectedVariant: 'nonexistent' },
                mockTemplates
            )
            expect(result.valid).toBe(false)
            expect(result.error).toContain('nonexistent')
        })

        it('should reject null response', () => {
            const result = LuaAIPersonalize.validateSelectResponse(null, mockTemplates)
            expect(result.valid).toBe(false)
        })
    })

    describe('validateGenerateResponse', () => {
        it('should accept valid generation response', () => {
            const result = LuaAIPersonalize.validateGenerateResponse({
                headline: 'Test Headline',
                subheadline: 'Test subheadline here',
                ctaLabel: 'Click Me'
            })
            expect(result.valid).toBe(true)
        })

        it('should reject missing headline', () => {
            const result = LuaAIPersonalize.validateGenerateResponse({
                subheadline: 'Test',
                ctaLabel: 'Click'
            })
            expect(result.valid).toBe(false)
            expect(result.error).toContain('headline')
        })

        it('should reject missing subheadline', () => {
            const result = LuaAIPersonalize.validateGenerateResponse({
                headline: 'Test',
                ctaLabel: 'Click'
            })
            expect(result.valid).toBe(false)
        })

        it('should reject missing ctaLabel', () => {
            const result = LuaAIPersonalize.validateGenerateResponse({
                headline: 'Test',
                subheadline: 'Sub'
            })
            expect(result.valid).toBe(false)
        })
    })

    describe('decide (select mode)', () => {
        it('should call OpenAI and return a valid decision', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                selectedVariant: 'gaming',
                                confidence: 0.92,
                                reasoning: 'User came from Reddit with gaming console campaign'
                            })
                        }
                    }]
                })
            })

            const decision = await LuaAIPersonalize.decide(mockContext, {
                templates: mockTemplates,
                aiConfig: { apiKey: 'sk-test', mode: 'select', cacheDecisions: false, historyEnabled: false }
            })

            expect(decision.intent).toBe('gaming')
            expect(decision.source).toBe('ai')
            expect(decision.template).toBe(mockTemplates['gaming'])
            expect(decision.aiResponse.confidence).toBe(0.92)
            expect(decision.aiResponse.model).toBe('gpt-4o-mini')
            expect(decision.aiResponse.mode).toBe('select')
        })

        it('should include Authorization header for direct API', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: { content: JSON.stringify({ selectedVariant: 'gaming', confidence: 0.8, reasoning: 'test' }) }
                    }]
                })
            })

            await LuaAIPersonalize.decide(mockContext, {
                templates: mockTemplates,
                aiConfig: { apiKey: 'sk-mykey123', mode: 'select', cacheDecisions: false, historyEnabled: false }
            })

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.openai.com/v1/chat/completions',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer sk-mykey123'
                    })
                })
            )
        })

        it('should use proxy URL when apiUrl is provided', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: { content: JSON.stringify({ selectedVariant: 'gaming', confidence: 0.8, reasoning: 'test' }) }
                    }]
                })
            })

            await LuaAIPersonalize.decide(mockContext, {
                templates: mockTemplates,
                aiConfig: { apiUrl: 'https://myproxy.com/openai', mode: 'select', cacheDecisions: false, historyEnabled: false }
            })

            expect(global.fetch).toHaveBeenCalledWith(
                'https://myproxy.com/openai',
                expect.any(Object)
            )
        })
    })

    describe('decide (generate mode)', () => {
        it('should call OpenAI and return generated content', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                headline: 'Game On, Gear Up',
                                subheadline: 'The ultimate gaming setup awaits you.',
                                ctaLabel: 'Level Up',
                                confidence: 0.88,
                                reasoning: 'Gamer from Reddit'
                            })
                        }
                    }]
                })
            })

            const decision = await LuaAIPersonalize.decide(mockContext, {
                templates: mockTemplates,
                aiConfig: {
                    apiKey: 'sk-test',
                    mode: 'generate',
                    cacheDecisions: false,
                    historyEnabled: false
                }
            })

            expect(decision.intent).toBe('ai-generated')
            expect(decision.source).toBe('ai')
            expect(decision.template.headline).toBe('Game On, Gear Up')
            expect(decision.template.subheadline).toBe('The ultimate gaming setup awaits you.')
            expect(decision.template.ctaLabel).toBe('Level Up')
            expect(decision.aiResponse.mode).toBe('generate')
        })
    })

    describe('error handling', () => {
        it('should reject with error for invalid config', async () => {
            await expect(LuaAIPersonalize.decide(mockContext, {
                templates: mockTemplates,
                aiConfig: {}
            })).rejects.toThrow('apiKey')
        })

        it('should reject on API error', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                text: () => Promise.resolve('Unauthorized')
            })

            await expect(LuaAIPersonalize.decide(mockContext, {
                templates: mockTemplates,
                aiConfig: { apiKey: 'sk-bad', cacheDecisions: false, historyEnabled: false, maxRetries: 0 }
            })).rejects.toThrow('401')
        })

        it('should reject on invalid JSON response', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: { content: 'this is not json' }
                    }]
                })
            })

            await expect(LuaAIPersonalize.decide(mockContext, {
                templates: mockTemplates,
                aiConfig: { apiKey: 'sk-test', cacheDecisions: false, historyEnabled: false, maxRetries: 0 }
            })).rejects.toThrow()
        })

        it('should reject on invalid selection (nonexistent variant)', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: { content: JSON.stringify({ selectedVariant: 'fake', confidence: 0.5, reasoning: 'oops' }) }
                    }]
                })
            })

            await expect(LuaAIPersonalize.decide(mockContext, {
                templates: mockTemplates,
                aiConfig: { apiKey: 'sk-test', cacheDecisions: false, historyEnabled: false, maxRetries: 0 }
            })).rejects.toThrow('does not exist')
        })
    })

    describe('caching', () => {
        it('should cache a decision and return it on subsequent calls', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: { content: JSON.stringify({ selectedVariant: 'gaming', confidence: 0.9, reasoning: 'test' }) }
                    }]
                })
            })

            // First call - hits API
            const first = await LuaAIPersonalize.decide(mockContext, {
                templates: mockTemplates,
                aiConfig: { apiKey: 'sk-test', cacheDecisions: true, historyEnabled: false }
            })
            expect(first.source).toBe('ai')
            expect(global.fetch).toHaveBeenCalledTimes(1)

            // Second call - should use cache
            const second = await LuaAIPersonalize.decide(mockContext, {
                templates: mockTemplates,
                aiConfig: { apiKey: 'sk-test', cacheDecisions: true, historyEnabled: false }
            })
            expect(second.source).toBe('ai-cached')
            expect(global.fetch).toHaveBeenCalledTimes(1) // No new fetch call
        })

        it('clearCache should remove all cached decisions', async () => {
            // Store something in cache
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: { content: JSON.stringify({ selectedVariant: 'gaming', confidence: 0.9, reasoning: 'test' }) }
                    }]
                })
            })

            await LuaAIPersonalize.decide(mockContext, {
                templates: mockTemplates,
                aiConfig: { apiKey: 'sk-test', cacheDecisions: true, historyEnabled: false }
            })

            LuaAIPersonalize.clearCache()

            // Next call should hit API again
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: { content: JSON.stringify({ selectedVariant: 'professional', confidence: 0.8, reasoning: 'cleared' }) }
                    }]
                })
            })

            const result = await LuaAIPersonalize.decide(mockContext, {
                templates: mockTemplates,
                aiConfig: { apiKey: 'sk-test', cacheDecisions: true, historyEnabled: false }
            })
            expect(result.source).toBe('ai')
            expect(global.fetch).toHaveBeenCalledTimes(2)
        })
    })

    describe('isReady', () => {
        it('should return ready for valid config with modules loaded', () => {
            const result = LuaAIPersonalize.isReady({ apiKey: 'sk-test' })
            expect(result.ready).toBe(true)
        })

        it('should return not ready for invalid config', () => {
            const result = LuaAIPersonalize.isReady({})
            expect(result.ready).toBe(false)
            expect(result.error).toBeDefined()
        })
    })
})

describe('LuaPrompts', () => {
    it('should be registered on global', () => {
        expect(LuaPrompts).toBeDefined()
        expect(typeof LuaPrompts.buildSelectPrompt).toBe('function')
        expect(typeof LuaPrompts.buildGeneratePrompt).toBe('function')
        expect(typeof LuaPrompts.buildMessages).toBe('function')
    })

    describe('buildMessages', () => {
        it('should build select mode messages', () => {
            const messages = LuaPrompts.buildMessages('select', {
                context: mockContext,
                weightedHistory: 'No history',
                variants: mockTemplates
            })

            expect(messages.length).toBe(2)
            expect(messages[0].role).toBe('system')
            expect(messages[1].role).toBe('user')
            expect(messages[0].content).toContain('personalization')
            expect(messages[1].content).toContain('reddit')
            expect(messages[1].content).toContain('gaming')
            expect(messages[1].content).toContain('AVAILABLE VARIANTS')
        })

        it('should build generate mode messages', () => {
            const messages = LuaPrompts.buildMessages('generate', {
                context: mockContext,
                weightedHistory: 'No history',
                brandContext: {
                    brandVoice: 'bold and energetic',
                    targetAudience: 'gamers'
                }
            })

            expect(messages.length).toBe(2)
            expect(messages[0].content).toContain('copywriter')
            expect(messages[1].content).toContain('bold and energetic')
            expect(messages[1].content).toContain('gamers')
        })

        it('should use custom system prompt when provided', () => {
            const messages = LuaPrompts.buildMessages('select', {
                context: mockContext,
                variants: mockTemplates
            }, {
                system: 'You are a custom AI.'
            })

            expect(messages[0].content).toBe('You are a custom AI.')
        })
    })

    describe('buildSelectPrompt', () => {
        it('should include all UTM parameters', () => {
            const prompt = LuaPrompts.buildSelectPrompt({
                context: {
                    utm: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'sale' },
                    referrer: { source: 'google', category: 'search' },
                    userAgent: { isMobile: true, isTablet: false, isDesktop: false },
                    hasUTM: true,
                    primaryIntent: 'price-focused'
                },
                weightedHistory: 'New visitor',
                variants: mockTemplates
            })

            expect(prompt).toContain('google')
            expect(prompt).toContain('cpc')
            expect(prompt).toContain('sale')
            expect(prompt).toContain('mobile')
            expect(prompt).toContain('price-focused')
        })

        it('should list all variant keys', () => {
            const prompt = LuaPrompts.buildSelectPrompt({
                context: mockContext,
                variants: mockTemplates
            })

            expect(prompt).toContain('"gaming"')
            expect(prompt).toContain('"professional"')
            expect(prompt).toContain('"default"')
        })

        it('should include preference scores when provided', () => {
            const prompt = LuaPrompts.buildSelectPrompt({
                context: mockContext,
                variants: mockTemplates,
                preferences: { gaming: 1.5, professional: 0.7 }
            })

            expect(prompt).toContain('PREFERENCE SCORES')
            expect(prompt).toContain('gaming')
            expect(prompt).toContain('1.500')
        })
    })

    describe('buildGeneratePrompt', () => {
        it('should include brand context fields', () => {
            const prompt = LuaPrompts.buildGeneratePrompt({
                context: mockContext,
                brandContext: {
                    brandVoice: 'friendly and modern',
                    targetAudience: 'young professionals',
                    productType: 'tech accessories',
                    industry: 'e-commerce',
                    customField: 'custom value'
                }
            })

            expect(prompt).toContain('friendly and modern')
            expect(prompt).toContain('young professionals')
            expect(prompt).toContain('tech accessories')
            expect(prompt).toContain('e-commerce')
            expect(prompt).toContain('custom value')
        })

        it('should include reference template when provided', () => {
            const prompt = LuaPrompts.buildGeneratePrompt({
                context: mockContext,
                fallbackTemplate: {
                    headline: 'Default Headline',
                    subheadline: 'Default sub',
                    ctaLabel: 'Default CTA'
                }
            })

            expect(prompt).toContain('Default Headline')
            expect(prompt).toContain('REFERENCE TEMPLATE')
        })
    })
})
