
/**
 * Tests for Weighted History Manager
 * Tests localStorage management, exponential decay, and visit tracking
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
        key: jest.fn(function (i) { return Object.keys(store)[i] || null }),
        _getStore: function () { return store }
    }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock })

// Mock crypto for UUID generation
Object.defineProperty(global, 'crypto', {
    value: {
        getRandomValues: function (buf) {
            for (let i = 0; i < buf.length; i++) {
                buf[i] = Math.floor(Math.random() * 256)
            }
            return buf
        }
    }
})

// Load the module (IIFE registers on global)
require('../storage/weighted-history')

const LuaWeightedHistory = global.LuaWeightedHistory

beforeEach(() => {
    localStorageMock.clear()
    jest.clearAllMocks()
})

describe('LuaWeightedHistory', () => {
    it('should be registered on global', () => {
        expect(LuaWeightedHistory).toBeDefined()
        expect(typeof LuaWeightedHistory.getHistory).toBe('function')
        expect(typeof LuaWeightedHistory.recordVisit).toBe('function')
    })

    describe('generateUUID', () => {
        it('should generate a valid UUID format', () => {
            const uuid = LuaWeightedHistory.generateUUID()
            expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
        })

        it('should generate unique UUIDs', () => {
            const uuids = new Set()
            for (let i = 0; i < 100; i++) {
                uuids.add(LuaWeightedHistory.generateUUID())
            }
            expect(uuids.size).toBe(100)
        })
    })

    describe('getHistory', () => {
        it('should create a new history if none exists', () => {
            const history = LuaWeightedHistory.getHistory()
            expect(history).toBeDefined()
            expect(history.userId).toBeDefined()
            expect(Array.isArray(history.visits)).toBe(true)
            expect(history.visits.length).toBe(0)
            expect(history.createdAt).toBeDefined()
        })

        it('should return existing history', () => {
            const first = LuaWeightedHistory.getHistory()
            const second = LuaWeightedHistory.getHistory()
            expect(first.userId).toBe(second.userId)
        })

        it('should persist to localStorage', () => {
            LuaWeightedHistory.getHistory()
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'lua_personalize_history',
                expect.any(String)
            )
        })
    })

    describe('recordVisit', () => {
        it('should add a visit to history', () => {
            const history = LuaWeightedHistory.recordVisit({
                context: {
                    utm: { utm_source: 'google' },
                    referrer: { source: 'google', category: 'search' },
                    userAgent: { isMobile: false, isTablet: false, isDesktop: true }
                },
                intent: 'search-optimized',
                selectedVariant: 'search-optimized',
                source: 'utm',
                aiDecision: false
            })

            expect(history.visits.length).toBe(1)
            expect(history.visits[0].intent).toBe('search-optimized')
            expect(history.visits[0].source).toBe('utm')
            expect(history.visits[0].aiDecision).toBe(false)
        })

        it('should store minimal context data', () => {
            const history = LuaWeightedHistory.recordVisit({
                context: {
                    utm: { utm_source: 'facebook', utm_campaign: 'gaming' },
                    referrer: { source: 'facebook', category: 'social', url: 'https://facebook.com/long-url' },
                    userAgent: { isMobile: true, isTablet: false, isDesktop: false, raw: 'Mozilla/5.0...' }
                },
                intent: 'gaming',
                selectedVariant: 'gaming',
                source: 'ai',
                aiDecision: true
            })

            const visit = history.visits[0]
            expect(visit.context.utm.utm_source).toBe('facebook')
            expect(visit.context.referrer.source).toBe('facebook')
            expect(visit.context.device).toBe('mobile')
            // Should NOT store raw user agent
            expect(visit.context.userAgent).toBeUndefined()
        })

        it('should trim history to max size', () => {
            for (let i = 0; i < 15; i++) {
                LuaWeightedHistory.recordVisit({
                    context: {},
                    intent: 'visit-' + i,
                    source: 'test'
                }, { maxHistorySize: 5 })
            }

            const history = LuaWeightedHistory.getHistory()
            expect(history.visits.length).toBe(5)
            // Should keep the most recent ones
            expect(history.visits[0].intent).toBe('visit-10')
            expect(history.visits[4].intent).toBe('visit-14')
        })

        it('should update preferences', () => {
            LuaWeightedHistory.recordVisit({
                context: {},
                intent: 'gaming',
                source: 'utm'
            })
            LuaWeightedHistory.recordVisit({
                context: {},
                intent: 'gaming',
                source: 'utm'
            })
            LuaWeightedHistory.recordVisit({
                context: {},
                intent: 'professional',
                source: 'utm'
            })

            const history = LuaWeightedHistory.getHistory()
            expect(history.preferences).toBeDefined()
            expect(history.preferences['gaming']).toBeGreaterThan(0)
            expect(history.preferences['professional']).toBeGreaterThan(0)
        })
    })

    describe('calculateWeight', () => {
        it('should return 1.0 for current timestamp', () => {
            const weight = LuaWeightedHistory.calculateWeight(Date.now())
            expect(weight).toBeCloseTo(1.0, 1)
        })

        it('should decay over time', () => {
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
            const weight = LuaWeightedHistory.calculateWeight(oneDayAgo, 0.9)
            expect(weight).toBeCloseTo(0.9, 1)
        })

        it('should decay significantly over a week', () => {
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
            const weight = LuaWeightedHistory.calculateWeight(sevenDaysAgo, 0.9)
            expect(weight).toBeCloseTo(Math.pow(0.9, 7), 2)
            expect(weight).toBeLessThan(0.5)
        })

        it('should use default decay rate', () => {
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
            const weight = LuaWeightedHistory.calculateWeight(oneDayAgo)
            expect(weight).toBeCloseTo(0.9, 1)
        })
    })

    describe('buildWeightedContext', () => {
        it('should return empty array for empty history', () => {
            const result = LuaWeightedHistory.buildWeightedContext({ visits: [] })
            expect(result).toEqual([])
        })

        it('should return empty array for null history', () => {
            const result = LuaWeightedHistory.buildWeightedContext(null)
            expect(result).toEqual([])
        })

        it('should return weighted visits sorted by weight', () => {
            const now = Date.now()
            const history = {
                visits: [
                    { timestamp: now - (3 * 24 * 60 * 60 * 1000), intent: 'old', source: 'utm' },
                    { timestamp: now, intent: 'new', source: 'ai' },
                    { timestamp: now - (1 * 24 * 60 * 60 * 1000), intent: 'mid', source: 'referrer' }
                ]
            }

            const result = LuaWeightedHistory.buildWeightedContext(history)
            expect(result[0].intent).toBe('new')
            expect(result[1].intent).toBe('mid')
            expect(result[2].intent).toBe('old')
            expect(result[0].weight).toBeGreaterThan(result[1].weight)
            expect(result[1].weight).toBeGreaterThan(result[2].weight)
        })

        it('should limit to maxWeighted results', () => {
            const now = Date.now()
            const visits = []
            for (let i = 0; i < 10; i++) {
                visits.push({
                    timestamp: now - (i * 24 * 60 * 60 * 1000),
                    intent: 'visit-' + i,
                    source: 'test'
                })
            }

            const result = LuaWeightedHistory.buildWeightedContext(
                { visits: visits },
                { maxWeighted: 3 }
            )
            expect(result.length).toBe(3)
        })
    })

    describe('aggregatePreferences', () => {
        it('should sum weights by intent', () => {
            const weighted = [
                { intent: 'gaming', weight: 0.9 },
                { intent: 'gaming', weight: 0.8 },
                { intent: 'professional', weight: 0.7 }
            ]

            const prefs = LuaWeightedHistory.aggregatePreferences(weighted)
            expect(prefs['gaming']).toBeCloseTo(1.7, 1)
            expect(prefs['professional']).toBeCloseTo(0.7, 1)
        })

        it('should skip unknown and default intents', () => {
            const weighted = [
                { intent: 'unknown', weight: 0.9 },
                { intent: 'default', weight: 0.8 },
                { intent: 'gaming', weight: 0.7 }
            ]

            const prefs = LuaWeightedHistory.aggregatePreferences(weighted)
            expect(prefs['unknown']).toBeUndefined()
            expect(prefs['default']).toBeUndefined()
            expect(prefs['gaming']).toBeCloseTo(0.7, 1)
        })
    })

    describe('formatForPrompt', () => {
        it('should return new visitor message for empty history', () => {
            const result = LuaWeightedHistory.formatForPrompt([])
            expect(result).toContain('new visitor')
        })

        it('should format visits with details', () => {
            const weighted = [
                {
                    timestamp: Date.now(),
                    intent: 'gaming',
                    selectedVariant: 'gaming-promo',
                    source: 'utm',
                    weight: 0.95,
                    context: { utm: { utm_source: 'reddit' } }
                }
            ]

            const result = LuaWeightedHistory.formatForPrompt(weighted)
            expect(result).toContain('gaming')
            expect(result).toContain('utm')
            expect(result).toContain('0.95')
            expect(result).toContain('reddit')
        })
    })

    describe('utility functions', () => {
        it('isReturningUser should return false for new users', () => {
            expect(LuaWeightedHistory.isReturningUser()).toBe(false)
        })

        it('isReturningUser should return true after recording a visit', () => {
            LuaWeightedHistory.recordVisit({ context: {}, intent: 'test', source: 'test' })
            expect(LuaWeightedHistory.isReturningUser()).toBe(true)
        })

        it('getUserId should return consistent ID', () => {
            const id1 = LuaWeightedHistory.getUserId()
            const id2 = LuaWeightedHistory.getUserId()
            expect(id1).toBe(id2)
        })

        it('getLastVisit should return null for empty history', () => {
            expect(LuaWeightedHistory.getLastVisit()).toBeNull()
        })

        it('getLastVisit should return most recent visit', () => {
            LuaWeightedHistory.recordVisit({ context: {}, intent: 'first', source: 'test' })
            LuaWeightedHistory.recordVisit({ context: {}, intent: 'second', source: 'test' })
            const last = LuaWeightedHistory.getLastVisit()
            expect(last.intent).toBe('second')
        })

        it('clearHistory should remove all data', () => {
            LuaWeightedHistory.recordVisit({ context: {}, intent: 'test', source: 'test' })
            expect(LuaWeightedHistory.isReturningUser()).toBe(true)
            LuaWeightedHistory.clearHistory()
            expect(LuaWeightedHistory.isReturningUser()).toBe(false)
        })

        it('isLocalStorageAvailable should return true', () => {
            expect(LuaWeightedHistory.isLocalStorageAvailable()).toBe(true)
        })
    })
})
