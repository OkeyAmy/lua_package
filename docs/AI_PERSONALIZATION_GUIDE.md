# AI-Powered Personalization Guide

Lua's AI personalization feature enhances the existing UTM-based personalization with intelligent content selection and generation powered by OpenAI models. The AI analyzes user context, traffic source, browsing history, and your content variants to deliver the most engaging experience.

---

## Table of Contents

- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Configuration Reference](#configuration-reference)
- [Modes](#modes)
- [Security](#security)
- [User History & Weighted Decay](#user-history--weighted-decay)
- [Prompt Customization](#prompt-customization)
- [Backend Proxy Setup](#backend-proxy-setup)
- [Error Handling & Fallbacks](#error-handling--fallbacks)
- [Performance & Cost Optimization](#performance--cost-optimization)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Include the scripts

```html
<!-- Core personalization (required) -->
<script src="utm-personalize.js" defer></script>

<!-- AI modules (optional - include for AI features) -->
<script src="storage/weighted-history.js" defer></script>
<script src="prompts/personalization-prompts.js" defer></script>
<script src="ai-personalize.js" defer></script>
```

### 2. Define your templates

```javascript
var templates = {
    'gaming': {
        headline: 'Level Up Your Setup',
        subheadline: 'Pro-grade gear for serious gamers.',
        ctaLabel: 'Explore Gaming',
        ctaLink: '/gaming',
        image: '/images/gaming-hero.jpg'
    },
    'professional': {
        headline: 'Work Smarter, Not Harder',
        subheadline: 'Premium productivity tools.',
        ctaLabel: 'View Collection',
        ctaLink: '/professional',
        image: '/images/pro-hero.jpg'
    },
    'default': {
        headline: 'Welcome to Our Store',
        subheadline: 'Discover products you will love.',
        ctaLabel: 'Start Shopping',
        ctaLink: '/shop',
        image: '/images/default-hero.jpg'
    }
};
```

### 3. Run AI personalization

```javascript
// Option A: Direct OpenAI API (user provides their own key)
var result = LuaUTMPersonalize.personalize({
    templates: templates,
    enableAI: true,
    aiConfig: {
        apiKey: 'sk-your-openai-key',  // User's own API key
        model: 'gpt-4o-mini',          // Default model
        mode: 'select'                  // Pick best variant
    }
});

// Option B: Via your backend proxy
var result = LuaUTMPersonalize.personalize({
    templates: templates,
    enableAI: true,
    aiConfig: {
        apiUrl: 'https://your-server.com/api/openai-proxy',
        mode: 'select'
    }
});

// Handle the result (AI returns a Promise)
result.then(function(decision) {
    console.log('AI selected:', decision.intent);
    console.log('Confidence:', decision.aiResponse.confidence);
});
```

---

## How It Works

When AI personalization is enabled, the following happens on page load:

1. **Context Collection**: UTM parameters, referrer info, device type, and browsing history are gathered from the current session.

2. **History Analysis**: Previous visits are loaded from localStorage and weighted by recency using exponential decay. Recent visits carry significantly more influence than older ones.

3. **Prompt Construction**: All context is assembled into a structured prompt optimized for the selected model. The prompt includes the current context, historical patterns, preference scores, and available content variants.

4. **AI Decision**: The prompt is sent to OpenAI (directly or via proxy). The AI analyzes all context and either selects the best variant (select mode) or generates new content (generate mode).

5. **DOM Update**: The selected or generated content is injected into elements with `data-personalize` attributes.

6. **History Recording**: The decision is recorded in localStorage for future visits, and the result is cached to avoid redundant API calls.

### Decision Priority

When AI is enabled, the system follows this priority:

```
AI Decision (cached) → AI Decision (fresh) → Standard Engine Fallback
```

If AI fails for any reason (timeout, API error, invalid response), the system automatically falls back to the standard UTM-based decision engine.

---

## Configuration Reference

```javascript
{
    // === Connection (one is REQUIRED) ===
    apiKey: 'sk-...',          // OpenAI API key for direct access
    apiUrl: 'https://...',     // Proxy endpoint URL

    // === Model ===
    model: 'gpt-4o-mini',     // OpenAI model (default: 'gpt-4o-mini')
    temperature: 0.7,          // Response creativity (0-2, default: 0.7)
    maxTokens: 500,            // Max response tokens (default: 500)

    // === Behavior ===
    mode: 'select',            // 'select' or 'generate' (default: 'select')
    timeout: 5000,             // Request timeout in ms (default: 5000)
    maxRetries: 1,             // Retry failed requests (default: 1)
    fallbackToStandard: true,  // Use standard engine on AI failure (default: true)

    // === Caching ===
    cacheDecisions: true,      // Cache AI decisions in localStorage (default: true)
    cacheDuration: 3600000,    // Cache TTL in ms (default: 1 hour)

    // === History ===
    historyEnabled: true,      // Track user visit history (default: true)
    historyDecayRate: 0.9,     // Weight decay per day (default: 0.9)
    maxHistorySize: 10,        // Max visits to store (default: 10)

    // === Brand Context (for generate mode) ===
    brandContext: {
        brandVoice: 'friendly, modern',
        targetAudience: 'young professionals',
        productType: 'tech accessories',
        industry: 'e-commerce'
    },

    // === Custom Prompts (advanced) ===
    customPrompts: {
        system: null,          // Override system prompt
        user: null             // Override user prompt template
    }
}
```

---

## Modes

### Select Mode (recommended)

In select mode, the AI analyzes all context and chooses the best variant from your predefined templates.

**Advantages**: Predictable output, faster response, content stays brand-consistent.

```javascript
aiConfig: {
    apiKey: 'sk-...',
    mode: 'select'
}
```

**AI Response**:
```json
{
    "selectedVariant": "gaming",
    "confidence": 0.92,
    "reasoning": "User from Reddit with gaming campaign"
}
```

### Generate Mode

In generate mode, the AI creates entirely new headline, subheadline, and CTA text based on context.

**Advantages**: Highly personalized, unique content per user segment.

```javascript
aiConfig: {
    apiKey: 'sk-...',
    mode: 'generate',
    brandContext: {
        brandVoice: 'bold, energetic, youthful',
        targetAudience: 'gamers aged 18-30',
        productType: 'gaming peripherals'
    }
}
```

**AI Response**:
```json
{
    "headline": "Game On, Level Up",
    "subheadline": "The ultimate gaming setup awaits you.",
    "ctaLabel": "Gear Up Now",
    "confidence": 0.88,
    "reasoning": "Gamer from Reddit interested in consoles"
}
```

---

## Security

### Direct API Access

When using `apiKey` directly, the key is sent from the browser. This is suitable for:
- Development and testing
- Internal tools
- Sites where the key exposure risk is acceptable

**Important**: Anyone who inspects your page can see the API key. Use with caution in production.

### Backend Proxy (Recommended for Production)

For production deployments, use a backend proxy that secures your API key. See [Backend Proxy Setup](#backend-proxy-setup) for details.

### What Data is Sent to OpenAI

The AI prompt includes:
- UTM parameters (source, medium, campaign, content, term)
- Referrer source and category
- Device type (mobile/tablet/desktop)
- Inferred intent
- Visit history (timestamps, intents, sources - no PII)
- Available template content (headlines, subheadlines, CTAs)

**Not sent**: User IP, cookies, personal data, form inputs, or any PII.

---

## User History & Weighted Decay

The system tracks user visits in localStorage to provide context for AI decisions.

### How Decay Works

Each visit is weighted by its age using exponential decay:

```
weight = decayRate ^ daysAgo
```

With the default decay rate of 0.9:
- Today's visit: weight = 1.0
- 1 day ago: weight = 0.9
- 7 days ago: weight = 0.478
- 30 days ago: weight = 0.042

### Returning Users

When a user returns to your site:
1. The system loads their visit history from localStorage
2. Visits are weighted by recency
3. Preference scores are aggregated (e.g., "gaming: 1.7, professional: 0.3")
4. All history is included in the AI prompt

If the user returns with a **different intent** (new UTM params), both the old history and new context are sent to the AI. The AI uses both to make an informed decision - potentially favoring continuity or adapting to the new intent.

### Storage Structure

```javascript
// Stored in localStorage under key: 'lua_personalize_history'
{
    userId: 'uuid-v4',
    createdAt: 1707400000000,
    visits: [
        {
            timestamp: 1707400000000,
            context: {
                utm: { utm_source: 'reddit' },
                referrer: { source: 'reddit', category: 'social' },
                device: 'desktop'
            },
            intent: 'gaming',
            selectedVariant: 'gaming',
            source: 'ai',
            aiDecision: true
        }
    ],
    preferences: {
        gaming: 1.5,
        professional: 0.7
    }
}
```

### Clearing History

```javascript
// Clear all history
LuaWeightedHistory.clearHistory();

// Clear AI decision cache
LuaAIPersonalize.clearCache();
```

---

## Prompt Customization

### Custom System Prompt

Override the default system prompt for specialized behavior:

```javascript
aiConfig: {
    apiKey: 'sk-...',
    customPrompts: {
        system: 'You are a luxury brand personalization engine. Always maintain an elegant, premium tone. Prefer understated sophistication over flashy messaging.'
    }
}
```

### Accessing Default Prompts

```javascript
// View the default prompts for reference
console.log(LuaPrompts.SYSTEM_PROMPT_SELECT);
console.log(LuaPrompts.SYSTEM_PROMPT_GENERATE);

// Build a prompt manually to inspect it
var prompt = LuaPrompts.buildSelectPrompt({
    context: LuaUTMPersonalize.getContext(),
    weightedHistory: 'No history',
    variants: myTemplates
});
console.log(prompt);
```

---

## Backend Proxy Setup

For production, create a backend proxy that stores your OpenAI API key securely.

### Node.js / Express Example

```javascript
const express = require('express');
const OpenAI = require('openai');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Rate limiting
const limiter = rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    max: 10                // 10 requests per minute per IP
});

app.post('/api/openai-proxy', limiter, async (req, res) => {
    try {
        const { model, messages, temperature, max_tokens, response_format } = req.body;

        const response = await openai.chat.completions.create({
            model: model || 'gpt-4o-mini',
            messages: messages,
            temperature: temperature || 0.7,
            max_tokens: max_tokens || 500,
            response_format: response_format
        });

        res.json(response);
    } catch (error) {
        console.error('OpenAI proxy error:', error.message);
        res.status(500).json({ error: 'AI service unavailable' });
    }
});

app.listen(3000);
```

### Client Configuration for Proxy

```javascript
LuaUTMPersonalize.personalize({
    templates: templates,
    enableAI: true,
    aiConfig: {
        apiUrl: 'https://your-server.com/api/openai-proxy',
        mode: 'select'
    }
});
```

---

## Error Handling & Fallbacks

The AI system is designed to degrade gracefully:

| Scenario | Behavior |
|----------|----------|
| AI modules not loaded | Standard engine is used (no AI) |
| Invalid API key | Falls back to standard engine |
| Request timeout | Falls back to standard engine |
| Invalid AI response | Falls back to standard engine |
| Rate limit exceeded | Falls back to standard engine |
| Network error | Falls back to standard engine |
| Cached decision available | Uses cache (no API call) |

### Disabling Fallback

If you want strict AI-only behavior (no fallback):

```javascript
aiConfig: {
    apiKey: 'sk-...',
    fallbackToStandard: false  // Will throw error instead of falling back
}
```

---

## Performance & Cost Optimization

### Caching Strategy

By default, AI decisions are cached in localStorage for 1 hour. The cache key is based on the user's context (UTM params, referrer, device), so the same context will return the cached decision without an API call.

```javascript
aiConfig: {
    cacheDecisions: true,
    cacheDuration: 3600000  // 1 hour (default)
}
```

### Cost Estimates (GPT-4o-mini)

- Input: ~$0.15 per 1M tokens
- Output: ~$0.60 per 1M tokens
- Typical request: ~500 input + 200 output tokens = ~$0.0002 per decision
- With 1-hour caching: ~$0.0002 per unique user context per hour

### Reducing Costs

1. **Enable caching** (default): Avoids redundant API calls
2. **Use GPT-4o-mini** (default): Most cost-effective model
3. **Prefer select mode**: Shorter responses than generate mode
4. **Increase cache duration**: `cacheDuration: 7200000` (2 hours)
5. **Use backend rate limiting**: Prevent abuse when using a proxy

---

## API Reference

### `LuaAIPersonalize`

| Method | Description |
|--------|-------------|
| `decide(context, options)` | Make an AI decision. Returns `Promise<Object>` |
| `personalizeWithAI(options)` | Full AI personalization flow |
| `isReady(aiConfig)` | Check if AI is properly configured |
| `normalizeConfig(config)` | Validate and normalize config |
| `clearCache()` | Clear all cached AI decisions |
| `validateSelectResponse(response, variants)` | Validate select mode response |
| `validateGenerateResponse(response)` | Validate generate mode response |

### `LuaWeightedHistory`

| Method | Description |
|--------|-------------|
| `getHistory()` | Get or create user history |
| `recordVisit(visitData, options)` | Record a new visit |
| `getUserId()` | Get the user's UUID |
| `isReturningUser()` | Check if user has previous visits |
| `getLastVisit()` | Get the most recent visit |
| `clearHistory()` | Clear all visit history |
| `calculateWeight(timestamp, decayRate)` | Calculate decay weight |
| `buildWeightedContext(history, options)` | Build weighted visit context |
| `aggregatePreferences(weightedVisits)` | Aggregate intent preferences |
| `formatForPrompt(weightedVisits)` | Format history for AI prompt |

### `LuaPrompts`

| Method | Description |
|--------|-------------|
| `buildMessages(mode, params, customPrompts)` | Build OpenAI messages array |
| `buildSelectPrompt(params)` | Build select mode user prompt |
| `buildGeneratePrompt(params)` | Build generate mode user prompt |
| `SYSTEM_PROMPT_SELECT` | Default select mode system prompt |
| `SYSTEM_PROMPT_GENERATE` | Default generate mode system prompt |

---

## Troubleshooting

### AI decision not firing

Check that all required scripts are loaded in order:
```javascript
console.log('UTM:', !!window.LuaUTMPersonalize);
console.log('History:', !!window.LuaWeightedHistory);
console.log('Prompts:', !!window.LuaPrompts);
console.log('AI:', !!window.LuaAIPersonalize);
```

### "AI not ready" warning

Ensure your `aiConfig` has either `apiKey` or `apiUrl`:
```javascript
var ready = LuaAIPersonalize.isReady({ apiKey: 'sk-...' });
console.log(ready); // { ready: true } or { ready: false, error: '...' }
```

### AI falls back to standard engine

Check the browser console for error messages. Common causes:
- Invalid or expired API key
- Network connectivity issues
- OpenAI rate limits
- Timeout (increase `timeout` in config)

### Cached decisions not updating

Clear the cache manually:
```javascript
LuaAIPersonalize.clearCache();
```

Or disable caching for debugging:
```javascript
aiConfig: { cacheDecisions: false }
```
