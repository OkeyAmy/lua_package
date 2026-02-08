
import {
  getRandomAssignment,
  getDefaultBucket,
  validateStore,
} from './utils'

// UTM functions are now on window.LuaUTM (IIFE pattern, no import needed)
// utm.js must be loaded before lua.js to populate window.LuaUTM

export default class Lua {
  constructor(options = {}) {
    Object.assign(this, {
      storageKey: 'ab-tests',
      root: typeof document !== 'undefined' ? document.body : null,
    }, options)

    validateStore(this.store)

    this.previousAssignments = {}
    try {
      // assert that the data is a JSON string
      // that represents a JSON object
      // saw a bug where it was, for some reason, stored as `null`
      const data = this.store.get(this.storageKey)
      if (typeof data === 'string' && data[0] === '{') {
        this.previousAssignments = JSON.parse(data)
      }
    } catch (_) {
      // ignore
    }

    this.userAssignments = {}
    this.persistedUserAssignments = {}
    this.providedTests = []
  }

  define(tests) {
    let normalizedData = tests
    if (!Array.isArray(tests)) normalizedData = [tests]

    normalizedData.forEach((test) => {
      if (!test.name) throw new Error('Tests must have a name')
      if (!test.buckets) throw new Error('Tests must have buckets')
      if (!Object.keys(test.buckets)) throw new Error('Tests must have buckets')
      this.providedTests.push(test)
    })
  }

  definitions() {
    return this.providedTests
  }

  removeClasses(testName, exceptClassName) {
    try {
      const { root } = this
      if (!root) return

      // classList does not support returning all classes
      const currentClassNames = root.className.split(/\s+/g)
        .map(x => x.trim())
        .filter(Boolean)

      currentClassNames
        .filter(x => x.indexOf(`${testName}--`) === 0)
        .filter(className => className !== exceptClassName)
        .forEach(className => root.classList.remove(className))
    } catch (_) {
      // Ignore
    }
  }

  applyClasses() {
    try {
      const { userAssignments, root } = this
      if (!root) return

      Object.keys(userAssignments).forEach((testName) => {
        const bucket = userAssignments[testName]

        const className = bucket ? `${testName}--${bucket}` : null
        // remove all classes related to this bucket
        this.removeClasses(testName, className)

        // only assign a class is the test is assigned to a bucket
        // this removes then adds a class, which is not ideal but is clean
        if (className) root.classList.add(className)
      })
    } catch (_) {
      // Ignore
    }
  }

  assignAll() {
    const {
      previousAssignments,
      userAssignments,
      persistedUserAssignments,
    } = this

    this.providedTests.forEach((test) => {
      // winners take precedence
      {
        const winner = Object.keys(test.buckets)
          .filter(name => test.buckets[name].winner)[0]
        if (winner) {
          userAssignments[test.name] = winner
          return
        }
      }

      // already assigned, probably because someone
      // called `.assignAll()` twice.
      if (userAssignments[test.name]) return

      {
        // previously assigned, so we continue to persist it
        const bucket = previousAssignments[test.name]
        if (bucket && test.buckets[bucket]) {
          const assignment = previousAssignments[test.name]
          persistedUserAssignments[test.name] = assignment
          userAssignments[test.name] = assignment
          test.active = true
          return
        }
      }

      // inactive tests should be set to default
      if (test.active === false) {
        userAssignments[test.name] = getDefaultBucket(test.buckets)
        return
      }

      // randomly assign
      {
        const assignment = getRandomAssignment(test)
        persistedUserAssignments[test.name] = assignment
        userAssignments[test.name] = assignment
      }
    })

    this.persist()
    this.applyClasses()
  }

  assign(testName, bucketName) {
    if (!testName) return this.assignAll()

    const test = this.providedTests.filter(x => x.name === testName)[0]
    if (bucketName === null || !test) {
      delete this.userAssignments[testName]
      delete this.persistedUserAssignments[testName]
      this.persist()
      this.removeClasses(testName)
      return
    }

    const assignment = bucketName || getRandomAssignment(test)
    this.userAssignments[testName] = assignment
    this.persistedUserAssignments[testName] = assignment
    test.active = true

    this.persist()
    this.applyClasses()
  }

  extendAssignments(assignments) {
    return assignments
  }

  assignments() {
    return this.extendAssignments(this.userAssignments)
  }

  persist() {
    this.store.set(this.storageKey, JSON.stringify(this.persistedUserAssignments))
  }

  /**
   * Get UTM context for the current page
   * Uses window.LuaUTM global (populated by utm.js IIFE)
   * @returns {Object} - Context object with UTM params, referrer, user agent, and intent
   */
  getUTMContext() {
    try {
      var _root = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : {}
      if (_root.LuaUTM && typeof _root.LuaUTM.getContext === 'function') {
        return _root.LuaUTM.getContext()
      }
      return { utm: {}, referrer: {}, userAgent: {}, primaryIntent: 'default', hasUTM: false }
    } catch (_) {
      return { utm: {}, referrer: {}, userAgent: {}, primaryIntent: 'default', hasUTM: false }
    }
  }

  /**
   * Get bucket based on UTM context
   * Maps UTM intent to test buckets
   * @param {Object} test - Test definition with buckets
   * @param {Object} context - UTM context
   * @returns {string|null} - Bucket name or null if no match
   */
  getUTMBasedBucket(test, context) {
    if (!context || !context.hasUTM) return null

    // Check if test has UTM rules defined
    const utmRules = test.utmRules || {}

    // Priority 1: Match by utm_campaign
    if (context.utm.utm_campaign) {
      const campaignRule = utmRules[context.utm.utm_campaign]
      if (campaignRule && test.buckets[campaignRule]) {
        return campaignRule
      }
    }

    // Priority 2: Match by utm_source
    if (context.utm.utm_source) {
      const sourceRule = utmRules[context.utm.utm_source]
      if (sourceRule && test.buckets[sourceRule]) {
        return sourceRule
      }
    }

    // Priority 3: Match by inferred intent
    const intent = context.primaryIntent
    if (intent && test.buckets[intent]) {
      return intent
    }

    // Priority 4: Check for intent-mapped buckets
    const intentMapping = test.intentMapping || {}
    if (intent && intentMapping[intent] && test.buckets[intentMapping[intent]]) {
      return intentMapping[intent]
    }

    return null
  }

  /**
   * Assign with UTM-aware personalization
   * Falls back to random A/B if no UTM match
   * @param {string} [testName] - Optional specific test name
   * @param {Object} [options] - Options including forceUTM, context
   * @returns {Object} - { assignment, source: 'utm'|'random'|'persisted' }
   */
  assignWithUTM(testName, options = {}) {
    const context = options.context || this.getUTMContext()

    // If no test name, assign all with UTM awareness
    if (!testName) {
      return this.assignAllWithUTM(context)
    }

    const test = this.providedTests.filter(x => x.name === testName)[0]
    if (!test) {
      return { assignment: null, source: 'none' }
    }

    // Check for winner first (takes precedence)
    const winner = Object.keys(test.buckets).filter(name => test.buckets[name].winner)[0]
    if (winner) {
      this.userAssignments[testName] = winner
      this.persist()
      this.applyClasses()
      return { assignment: winner, source: 'winner' }
    }

    // Check previous assignment
    const previousBucket = this.previousAssignments[testName]
    if (previousBucket && test.buckets[previousBucket]) {
      this.userAssignments[testName] = previousBucket
      this.persistedUserAssignments[testName] = previousBucket
      test.active = true
      this.persist()
      this.applyClasses()
      return { assignment: previousBucket, source: 'persisted' }
    }

    // Try UTM-based assignment
    const utmBucket = this.getUTMBasedBucket(test, context)
    if (utmBucket) {
      this.userAssignments[testName] = utmBucket
      this.persistedUserAssignments[testName] = utmBucket
      test.active = true
      this.persist()
      this.applyClasses()
      return { assignment: utmBucket, source: 'utm', intent: context.primaryIntent }
    }

    // Fallback to random assignment
    const assignment = getRandomAssignment(test)
    this.userAssignments[testName] = assignment
    this.persistedUserAssignments[testName] = assignment
    test.active = true
    this.persist()
    this.applyClasses()
    return { assignment, source: 'random' }
  }

  /**
   * Assign all tests with UTM awareness
   * @param {Object} context - UTM context
   * @returns {Object} - Map of test names to assignment results
   */
  assignAllWithUTM(context) {
    context = context || this.getUTMContext()
    const results = {}

    this.providedTests.forEach((test) => {
      const result = this.assignWithUTM(test.name, { context })
      results[test.name] = result
    })

    return results
  }
}

