# LuaIntent

LuaIntent is a plug-and-play, mathematically robust website personalization engine. It uses a lightweight algorithmic decision engine to detect visitor intent and dynamically morph your website's UI, all without requiring an expensive backend or sending data to an LLM for every click.

## What problem does it solve?

Most personalization tools are either simple A/B testing frameworks that rely on static tags, or analytics pipelines that report data long after the visitor has left. **LuaIntent calculates a visitor's exact intent in real-time, instantly within the browser, using a strict mathematical fusion algorithm.**

This gives you a 0-latency personalization gatekeeper that acts *before* the UI renders.

## Key capabilities

- **Single script tag or npm installation**
- **Multi-signal intent detection:**
  - `URL/UTM`: Search terms via `?q=`, and UTM payloads that map to marketing campaign intents.
  - `Referrer`: Tracks the origin category (e.g., Organic search vs. Paid social).
  - `Behavior`: A passive listener calculating an *Engagement Score* based on time on page, scroll depth, and mouse movement.
  - `History`: Recognizes persistent `localStorage` visit patterns with a recency decay factor.
- **Explainable decisions:** Outputs strict mathematics: confidence percentages, the winning intent category, priority level, and an English string reason.
- **Deep Structural Morphing:** Designed to transform entire HTML layout structures, not just simple hero images.
- **Privacy-first:** Runs entirely locally on the client's device. No PII is tracked.
- **Optional AI Gatekeeper:** Only triggers an expensive network call to an LLM *if and only if* algorithmic confidence falls mathematically below your custom threshold.

## The Intent Taxonomy

By default, the engine scores the visitor against 8 core intent categories (you can customize these via the SDK configuration):

- **`buy_now`**: High-intent, direct purchase signals (e.g., checkout retargeting)
- **`compare`**: Evaluating options or cross-shopping competitors
- **`research`**: Top-of-funnel learning, documentation reading
- **`budget`**: Price-sensitive, deal-seeking behavior
- **`impulse`**: Fast actions driven by urgency or flash sales
- **`use_case`**: Persona-specific contexts (e.g., a `gaming` persona vs an `office` persona)
- **`brand`**: Exploring the company mission, about us page
- **`return`**: Loyalty and returning visitor retention

## Quick start (local demo)

1) Build the LuaIntent browser bundle:

```bash
npx esbuild demo/bundle-entry.js --bundle --outfile=demo/lua-intent.bundle.js
```

1) Open the demo page in your browser:

```
demo/index.html
```

## How the Decision Engine Works (The Math)

1. **Passive Signal Collection**: Silently groups data from the URL, `document.referrer`, and a background DOM listener into a formal interface (`AuraSignals`).
2. **Weighted Scoring**: Evaluates the signals against the Intent Taxonomy using pattern matching and behavioral multiplier logic (`intentScorer.js`).
3. **Score Fusion**: Runs an α-coefficient algorithm (`scoreFuser.js`) to mathematically combine all signals, applying strict weights (e.g., 0.45 weight for a URL hit, 0.20 for a Referrer hit).
4. **Confidence Evaluator**: Runs separation math algorithms (`confidenceCalc.js`). If the top intent wins by 0.1 points over the runner-up, confidence plummets. If it wins by 5.0 points, confidence spikes.
5. **Decide() Pipeline**: Finally, evaluates an 8-level Priority Waterfall to allow manual overrides (P0), returning the strictly typed `IntentDecision` object instantly.

## Repository structure

```
demo/                 # The live interactive dynamic website visualizer
src/                  
  ├── signals/        # Tracking layers (URL, Referrer, Behavior, History)
  ├── scoring/        # The Bayesian fusion math & confidence formula
  ├── decision/       # 8-level Priority waterfall override rules
  └── config/         # Deeply swappable weights, coefficients, dictionaries
docs/                 # Deep-dive documentation and integration guides
```

## Documentation Library

- `DEMO_README.md` — 1-minute live interactive demo script and talk track.
- `docs/INTEGRATION_GUIDE.md` — Step-by-step instructions for bringing LuaIntent to React, Next.js, and pure HTML apps.
- `docs/AI_PERSONALIZATION_GUIDE.md` — A deep dive into the mathematical Bayesian fusion and Separation logic.
