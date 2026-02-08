# Lua Integration Guide

## 1. Introduction

Lua is a lightweight A/B testing library that works in both browser and server environments. It allows you to:

- Define experiments with multiple variants.
- Assign users to specific variants based on weights.
- Persist assignments so users see the same variant on return visits.

## 2. Installation

### NPM / Yarn / PNPM

Best for modern web applications using a bundler (Webpack, Vite, Rollup).

```bash
npm install lua
# OR
yarn add lua
# OR
pnpm add lua
```

### Script Tag

Best for simple static sites or quick prototypes.
Include `lua.js` from your build folder or CDN.

```html
<script src="/path/to/lua.js"></script>
```

## 3. Quick Start

### Step 1: Initialize

Create a single instance of `Lua` at the entry point of your application.

```javascript
import Lua from 'lua';

const lua = new Lua({
    store: Lua.stores.local, // Uses localStorage to save assignments
    debug: true                // Enable console logs for debugging
});
```

### Step 2: Define an Experiment

Define your test with a unique name and the variants (buckets) you want to test.

```javascript
lua.define({
    name: 'new-checkout-flow',
    buckets: {
        'control': { weight: 0.5 }, // 50% traffic
        'one-page': { weight: 0.5 } // 50% traffic
    }
});
```

### Step 3: Assign the User

Call `.assign()` to determine which variant the current user belongs to. This checks for existing assignments first, then randomizes if none exist.

```javascript
lua.assign();
```

### Step 4: Implement Logic

Use the assignment to conditionally render content or change behavior.

```javascript
const assignment = lua.assignments()['new-checkout-flow'];

if (assignment === 'one-page') {
    loadOnePageCheckout();
} else {
    loadStandardCheckout();
}
```

## 4. Advanced Usage

### Templatized Variants (The "Hero" Pattern)

Instead of hardcoding logic for every test, use a "Template Registry" pattern. This is ideal for testing different content within the same UI component (e.g., a Hero Banner).

**Concept:**

1. Create a generic UI component (The Template) that accepts data (Title, Image, CTA).
2. Define variants in Lua that correspond to different data sets.
3. Map the assignment to the specific data set.

**Example:**

```javascript
// 1. Define Data Sets
const heroContent = {
    'seasonal': { title: 'Summer Sale', cta: 'Shop Now' },
    'minimal': { title: 'New Collection', cta: 'Discover' }
};

// 2. Define Test
lua.define({
    name: 'hero_content_test',
    buckets: {
        'seasonal': { weight: 1 },
        'minimal': { weight: 1 }
    }
});

lua.assign();

// 3. Render
const variant = lua.assignments()['hero_content_test'];
const content = heroContent[variant];

document.getElementById('hero-title').innerText = content.title;
document.getElementById('hero-cta').innerText = content.cta;
```

## 5. Debugging & QA

### Force a Variant

To test a specific variant without changing code:

1. Open DevTools -> Application -> Local Storage.
2. Find the `ab-tests` key.
3. Edit the JSON value to set your desired variant:

    ```json
    {"new-checkout-flow": "one-page"}
    ```

4. Reload the page.

### Reset Assignments

To clear all assignments and get re-bucketed:

```javascript
localStorage.removeItem('ab-tests');
location.reload();
```

## 6. UTM-Based Personalization

Lua includes built-in UTM parameter detection and content personalization. This allows you to show different content based on where users come from (Google Ads, Facebook, email campaigns, etc.).

### Basic UTM Personalization

```html
<!-- Include the UTM personalization script -->
<script src="utm-personalize.js" defer></script>
```

```javascript
// Define your content templates
var templates = {
    'gaming': {
        headline: 'Level Up Your Setup',
        subheadline: 'Pro-grade gear for serious gamers.',
        ctaLabel: 'Explore Gaming',
        ctaLink: '/gaming',
        image: '/images/gaming-hero.jpg'
    },
    'professional': {
        headline: 'Work Smarter',
        subheadline: 'Premium productivity tools.',
        ctaLabel: 'View Collection',
        ctaLink: '/professional',
        image: '/images/pro-hero.jpg'
    },
    'default': {
        headline: 'Welcome',
        subheadline: 'Discover products you will love.',
        ctaLabel: 'Shop Now',
        ctaLink: '/shop',
        image: '/images/default-hero.jpg'
    }
};

// Apply personalization
LuaUTMPersonalize.personalize({
    templates: templates,
    log: true
});
```

### HTML Markup

Use `data-personalize` attributes to mark elements that should be personalized:

```html
<div class="hero" data-personalize="hero">
    <h1 data-personalize="headline">Default Headline</h1>
    <p data-personalize="subheadline">Default subheadline</p>
    <a href="/shop" data-personalize="ctaLink">
        <span data-personalize="ctaLabel">Default CTA</span>
    </a>
</div>
```

## 7. AI-Powered Personalization

Enhance personalization with AI-driven content selection and generation using OpenAI models.

### Setup

Include the AI modules after the core personalization script:

```html
<!-- Core personalization -->
<script src="utm-personalize.js" defer></script>

<!-- AI modules -->
<script src="storage/weighted-history.js" defer></script>
<script src="prompts/personalization-prompts.js" defer></script>
<script src="ai-personalize.js" defer></script>
```

### Enable AI Personalization

```javascript
// Option 1: Direct OpenAI API (for development/testing)
LuaUTMPersonalize.personalize({
    templates: templates,
    enableAI: true,
    aiConfig: {
        apiKey: 'sk-your-openai-key',
        model: 'gpt-4o-mini',  // Default model
        mode: 'select'          // 'select' or 'generate'
    }
}).then(function(decision) {
    console.log('AI selected:', decision.intent);
    console.log('Confidence:', decision.aiResponse.confidence);
});

// Option 2: Via backend proxy (recommended for production)
LuaUTMPersonalize.personalize({
    templates: templates,
    enableAI: true,
    aiConfig: {
        apiUrl: 'https://your-server.com/api/openai-proxy',
        mode: 'select'
    }
});
```

### AI Modes

**Select Mode**: AI chooses the best variant from your predefined templates.
- Predictable output
- Brand-consistent content
- Faster response

**Generate Mode**: AI creates new personalized content from scratch.
- Highly personalized
- Unique content per user segment
- Requires brand context configuration

```javascript
// Generate mode example
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

### User History & Weighted Decay

The AI system automatically tracks user visits and applies exponential decay to older visits. Recent behavior carries more weight than historical patterns.

```javascript
// Check if user is returning
if (LuaWeightedHistory.isReturningUser()) {
    var history = LuaWeightedHistory.getHistory();
    console.log('Visit count:', history.visits.length);
    console.log('Preferences:', history.preferences);
}

// Clear history (for testing)
LuaWeightedHistory.clearHistory();
LuaAIPersonalize.clearCache();
```

For comprehensive AI setup, see the [AI Personalization Guide](AI_PERSONALIZATION_GUIDE.md).

## 8. Best Practices

- **Unique Names**: Ensure every test has a unique `name`.
- **Clean Up**: When a test is over, remove the definition and the logic, but keep the winning variant's code.
- **Server-Side**: If using SSR, ensure the storage driver works with cookies or headers to maintain consistency between server and client.
- **AI Security**: For production, use a backend proxy instead of exposing your OpenAI API key client-side.
- **Caching**: AI decisions are cached by default (1 hour). Adjust `cacheDuration` in `aiConfig` if needed.
- **Fallback**: AI automatically falls back to standard UTM-based personalization if the API fails.
