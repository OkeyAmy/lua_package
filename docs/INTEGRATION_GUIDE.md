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

## 6. Best Practices

- **Unique Names**: Ensure every test has a unique `name`.
- **Clean Up**: When a test is over, remove the definition and the logic, but keep the winning variant's code.
- **Server-Side**: If using SSR, ensure the storage driver works with cookies or headers to maintain consistency between server and client.
