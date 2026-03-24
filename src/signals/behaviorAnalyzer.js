/**
 * @file behaviorAnalyzer.js
 * Passively tracks user behavior on the page: scroll depth, click count,
 * time on page, and mouse activity.
 *
 * Computes a single engagementScore (0–1) as a weighted composite.
 * This module is designed to be started once and snapshotted at decision time.
 */

'use strict';

// Engagement score formula:
//   0.45 × min(1, timeMs / FULL_ENGAGED_MS)
// + 0.35 × scrollDepth
// + 0.15 × min(1, clicks / MAX_CLICKS)
// + 0.05 × min(1, mouseScore)

const FULL_ENGAGED_MS = 8000; // 8s = fully engaged user
const MAX_CLICKS = 5;

/**
 * BehaviorAnalyzer — attach event listeners to start tracking,
 * call snapshot() when you need the current state.
 */
class BehaviorAnalyzer {
    /**
     * @param {{ enableListeners?: boolean }} [opts]
     */
    constructor(opts) {
        const options = opts || {};
        this._timeStart = Date.now();
        this._scrollDepth = 0;
        this._clickCount = 0;
        this._rageClicks = 0;
        this._mouseActive = false;
        this._mouseMoveCount = 0;
        this._lastClickTime = 0;
        this._listeners = [];

        if (options.enableListeners !== false) {
            this._attach();
        }
    }

    // ── Event Listeners ──────────────────────────────────────────────────────

    _attach() {
        const scrollHandler = () => {
            try {
                const doc = document.documentElement;
                const top = doc.scrollTop || document.body.scrollTop || 0;
                const max = doc.scrollHeight - doc.clientHeight;
                if (max > 0) {
                    this._scrollDepth = Math.max(this._scrollDepth, Math.min(1, top / max));
                }
            } catch { /* ignore */ }
        };

        const clickHandler = (e) => {
            this._clickCount++;
            const now = Date.now();
            // Rage click: < 300ms gap same target
            if (now - this._lastClickTime < 300) this._rageClicks++;
            this._lastClickTime = now;
            this._mouseActive = true;
        };

        const mouseMoveHandler = () => {
            this._mouseMoveCount++;
            this._mouseActive = true;
        };

        try {
            window.addEventListener('scroll', scrollHandler, { passive: true });
            window.addEventListener('click', clickHandler, { passive: true });
            window.addEventListener('mousemove', mouseMoveHandler, { passive: true });

            this._listeners.push(
                ['scroll', scrollHandler],
                ['click', clickHandler],
                ['mousemove', mouseMoveHandler],
            );
        } catch { /* no DOM — test environment */ }
    }

    // ── Simulation (for tests) ────────────────────────────────────────────────

    /**
     * Simulate behavior for unit testing.
     * @param {{ timeOnPageMs?: number, scrollDepth?: number, clickCount?: number }} state
     */
    simulate(state) {
        if (state.timeOnPageMs != null) {
            this._timeStart = Date.now() - state.timeOnPageMs;
        }
        if (state.scrollDepth != null) this._scrollDepth = state.scrollDepth;
        if (state.clickCount != null) this._clickCount = state.clickCount;
    }

    // ── Snapshot ──────────────────────────────────────────────────────────────

    /**
     * Return an immutable snapshot of current behavior.
     * @returns {BehaviorSnapshot}
     */
    snapshot() {
        const timeMs = Date.now() - this._timeStart;
        const scrollDepth = this._scrollDepth;
        const clickCount = this._clickCount;
        const mouseScore = Math.min(1, this._mouseMoveCount / 100);

        const engagementScore = clamp01(
            0.45 * Math.min(1, timeMs / FULL_ENGAGED_MS)
            + 0.35 * scrollDepth
            + 0.15 * Math.min(1, clickCount / MAX_CLICKS)
            + 0.05 * mouseScore
        );

        return {
            timeOnPageMs: timeMs,
            scrollDepth,
            clickCount,
            rageClicks: this._rageClicks,
            mouseMovementScore: mouseScore,
            engagementScore,
        };
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    destroy() {
        try {
            for (const [event, handler] of this._listeners) {
                window.removeEventListener(event, handler);
            }
        } catch { /* ignore */ }
        this._listeners = [];
    }
}

function clamp01(v) {
    return Math.max(0, Math.min(1, Number(v) || 0));
}

/**
 * @typedef {object} BehaviorSnapshot
 * @property {number} timeOnPageMs
 * @property {number} scrollDepth       (0–1)
 * @property {number} clickCount
 * @property {number} rageClicks
 * @property {number} mouseMovementScore (0–1)
 * @property {number} engagementScore   (0–1, weighted composite)
 */

module.exports = { BehaviorAnalyzer };
