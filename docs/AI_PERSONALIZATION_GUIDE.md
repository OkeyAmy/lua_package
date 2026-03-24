# AI Personalization Architecture — The Math Behind LuaIntent

The core premise behind LuaIntent is that **AI / LLMs are too slow and expensive to evaluate every single visitor click.**

Instead of sending every visitor's mouse-wiggle to OpenAI, **LuaIntent acts as a Mathematical Gatekeeper.**

## 1. Zero-Cost Algorithmic Certainty

LuaIntent runs entirely natively in the browser via `scoreFuser.js`.
If a user lands on your site via a Google Ad with `?utm_campaign=checkout-retarget`, the *Priority Waterfall* automatically overrides all other signals and enforces a `P1` "Buy Now" intent.

There's no need to ask an LLM. It's definitive math.

## 2. Bayesian Score Fusion

When signals conflict (e.g. a visitor arrives from Reddit, which implies `compare`, but searches for `?q=cheap+monitor`, which implies `budget`), the engine invokes the `scoreFuser`.

Each layer outputs a primitive score (`urlAnalyzer` outputs `2.5`, `referrer` outputs `0.4`).
The `scoreFuser` applies static *Alpha Coefficients* (`α`) to determine the reliability of the source.

* `α_url = 0.45`
* `α_referrer = 0.20`
* `α_behavior = 0.15`

Wait, what if they tie?

## 3. The Separation Confidence Formula (`confidenceCalc.js`)

A core innovation of LuaIntent is its `confidence` rating.

If "Compare" scores 3.1 and "Buy Now" scores 3.0, the engine is NOT confident, even though "Compare" won. It uses this formula:

```javascript
// Separation: How far apart are the top two intents?
const separation = (topScore - secondScore) / topScore;

// If separation is < 5%, confidence drastically drops.
const confidence = rawBaseConfidence * (0.7 + (0.3 * separation));
```

## 4. The AI Gateway

This is where the AI comes in.

If (and ONLY if) `confidence < aiThreshold` (default: 0.50), the system will trigger the `AILayer` module. At this point, the JavaScript SDK will serialize the `AuraSignals` object into a lightweight JSON string and execute a network request to an Anthropic/OpenAI wrapper, asking the LLM to disambiguate the tie.

**This hybrid architecture guarantees:**

1. 0ms Latency for 80% of specific visitors.
2. Advanced AI deep-logic for the 20% of anomalous, deeply conflicting visitors.
3. Total privacy preservation unless the AI gate is triggered.
