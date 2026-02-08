# Lua Setup & Usage Guide

## Overview

Lua is a progressive, client/server A/B testing library designed to be clear, minimal, and flexible. It allows you to define tests, assign users to buckets (variants), and persist these assignments using drivers like `localStorage`.

## Installation

### Via NPM

To install the package in your project:

```bash
npm install lua --save
# OR
yarn add lua
# OR
pnpm add lua
```

Run `python3 -m http.server 8000` to start the demo server and `http://localhost:8000/demo/index.html` to view the demo.

### Via Script Tag

You can also include the built file directly in your HTML:

```html
<script src="path/to/lua.js"></script>
```

## Basic Setup

### 1. Initialize Lua

Create an instance of `Lua`. You can configure the storage driver (defaults to `localStorage`) and debug mode.

```javascript
import Lua from 'lua'; // If using ES modules
// OR just 'Lua' global if using script tag

const lua = new Lua({
    store: Lua.stores.local, // Persist assignments in localStorage
    debug: true                // Log actions to console
});
```

### 2. Define Tests

Define your A/B tests with their variants (buckets) and weights.

- `weight`: Determines the probability of a user landing in that bucket.

```javascript
lua.define({
    name: 'hero-banner-test',
    buckets: {
        control: { weight: 0.34 }, // 34% chance
        variantA: { weight: 0.33 }, // 33% chance
        variantB: { weight: 0.33 }, // 33% chance
    }
});
```

### 3. Assign User

Call `.assign()` to place the current user into a bucket for all defined tests. If the user is already assigned, this will retrieve their existing assignment.

```javascript
lua.assign();
```

### 4. Use Assignment

Retrieve the assignment to determine what to show the user.

```javascript
```javascript
const assignments = lua.assignments();
const variant = assignments['hero-banner-test'];

if (variant === 'variantA') {
    // Show Variant A
} else if (variant === 'variantB') {
    // Show Variant B
} else {
    // Show Control
}

```

## Example: E-commerce Hero Test

Here is a practical example of testing different Hero Banners on an e-commerce site.

```javascript
// 1. Setup
const lua = new Lua();

// 2. Define the test
lua.define({
    name: 'homepage_hero',
    buckets: {
        'seasonal_sale': { weight: 1 },
        'new_arrivals': { weight: 1 },
        'brand_story': { weight: 1 }
    }
});

// 3. Assign
lua.assign();

// 4. Render based on assignment
const assignment = lua.assignments()['homepage_hero'];
const heroContainer = document.querySelector('#hero-section');

const contentMap = {
    'seasonal_sale': {
        title: 'Summer Sale',
        text: 'Up to 50% off on all beachwear.',
        cta: 'Shop Sale'
    },
    'new_arrivals': {
        title: 'New Arrivals',
        text: 'Check out the latest trends for this season.',
        cta: 'View Collection'
    },
    'brand_story': {
        title: 'Our Story',
        text: 'Handcrafted with sustainable materials.',
        cta: 'Learn More'
    }
};

const content = contentMap[assignment] || contentMap['seasonal_sale']; // Fallback to control

// Apply content
heroContainer.querySelector('h1').textContent = content.title;
heroContainer.querySelector('p').textContent = content.text;
heroContainer.querySelector('button').textContent = content.cta;
```

## Debugging

If you need to force a specific variant for testing:

1. Open your browser's Developer Tools (F12).
2. Go to the **Application** tab > **Local Storage**.
3. Find the `ab-tests` key and delete it to reset.
4. Reload the page.
