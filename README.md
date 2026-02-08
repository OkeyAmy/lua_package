<a href="https://github.com/OkeyAmy/Lua-Dynamic-Website-">
  <img src="assets/lua-v2.svg">
</a>

> A progressive, client/server AB testing library.

[![npm][npm-image]][npm-url]
[![bower][bower-image]][bower-url]

[npm-image]: https://badge.fury.io/js/lua.svg
[npm-url]: https://www.npmjs.com/package/lua
[bower-image]: https://badge.fury.io/bo/lua.svg
[bower-url]: https://github.com/OkeyAmy/Lua-Dynamic-Website-

Lua is an AB testing library designed to be clear, minimal, and flexible. It works in both the server and browser with the use of driver-based persistence layers.

You can download the compiled javascript directly [here](/build/lua.js)

* [Features](#features)
* [Installing](#installing)
* [Developing](#developing)
* [Run the demo](#run-the-demo)
* [Usage](#usage)
* [API](#api)
* [Guide/FAQ](#guidefaq)
* [AI-Powered Personalization](#ai-powered-personalization)
* [Push to GitHub](#push-to-github)
* [License](#license)

***

## Features

* Powerful, clear API
* Many variations. ABCD testing
* Intelligent weighted bucketing
* Browser & Server support
* Storage Drivers: `localStorage`, `cookies`, `memory`, or build your own
* **AI-Powered Personalization** using OpenAI GPT models (opt-in)
* **UTM-Based Content Personalization** with automatic intent inference
* **Weighted User History** with exponential decay for returning visitors
* Well documented, tested, and proven in high production environments
* Lightweight, weighing in at ~ <span class="size">`3.8kb`</span> (core), with optional AI modules
* Not tested on animals

## Installing

```bash
# Via NPM
npm i lua --save

# Via Bower
bower i lua --save

# Via Yarn
yarn add lua
```

## Developing

```bash
# Install dependencies (use pnpm, npm, or yarn)
pnpm install
# OR: npm install
# OR: yarn install

# Build the library
pnpm run build
# OR: npm run build

# Run linting
pnpm run lint
# OR: npm run lint

# Run all tests (83 tests across 6 suites)
pnpm test
# OR: npm test
```

### Run a single test file

```bash
# Run only core Lua tests
pnpm test -- src/__tests__/unit.js

# Run only AI personalization tests
pnpm test -- src/__tests__/ai-personalize.test.js

# Run only weighted history tests
pnpm test -- src/__tests__/weighted-history.test.js
```

## Run the demo

Try the UTM personalization and AI-powered demo locally:

```bash
# Option 1: Test server with auto-loaded API key (RECOMMENDED)
pnpm run test:demo
# OR: node test-demo.js

# This will:
# - Read your OpenAI API key from .env file
# - Auto-fill the API key in the demo
# - Enable AI mode by default
# - Serve at http://localhost:3000/demo
```

If you don't need AI features, you can use a generic static server instead:

```bash
# Option 2: Node (npx serve)
npx serve . -p 3000

# Option 3: Python 3
python3 -m http.server 8000

# Option 4: PHP
php -S localhost:8080
```

Then open in your browser:

- **Option 1**: [http://localhost:3000/demo](http://localhost:3000/demo) (test server — AI auto-configured)
- **Options 2-4**: [http://localhost:3000/demo/index.html](http://localhost:3000/demo/index.html) (use your port: 3000, 8000, or 8080)

On the demo page you can:

- Use the **Test UTM Links** in the debug panel to simulate traffic from Google, Facebook, Reddit, etc.
- Toggle **Enable AI Mode**, add your OpenAI API key, and click **Run AI Personalization** to see AI-driven content selection.
- Use **Reset & Reload** to clear UTM params, or **Clear AI History & Cache** to reset stored history.

**Note:** The demo uses script paths like `../src/utm-personalize.js`, so it must be served from the project root (not by opening `demo/index.html` as a file). The recommended `test-demo.js` handles this automatically.

## Usage

```html
<script src="lua.js"></script>
<script>

  // Set up our test API
  const lua = new Lua({
    store: Lua.stores.local
  });

  // Define a test
  lua.define({
    name: 'new-homepage',
    buckets: {
      control: { weight: 0.6 },
      versionA: { weight: 0.2 },
      versionB: { weight: 0.2 },
    }
  });

  // Bucket the user
  lua.assign();

  // Fetch assignments at a later point
  const info = lua.assignments();
</script>
```

## API

> ## `Lua(config)`

```javascript
const lua = new Lua({
  debug: true,
  store: Lua.stores.local
});
```

> This creates a new test API used to defined tests, assign buckets, and retrieve information.

**Returns**: `Object`

Name | Type | Description | Default
:--- | :--- | :--- | :---
`debug` | `Boolean` | _Set to `true` to enable logging of additional information_ | `false`
`store` | `Object` | _An object with get/set properties that will accept information to help persist and retrieve tests_ | `Lua.stores.local`

***

> ## `lua.define(testData)`

```javascript
// Create your test API
const lua = new Lua();

// Define a test
lua.define({
  name: 'MyTestName',
  buckets: {
    variantA: { weight: 0.5 },
    variantB: { weight: 0.5 },
  },
});
```

> This function defines the tests to be assigned to used during bucket assignment. This function accepts an object with two keys, `name` and `buckets`. Alternatively, you may pass an array of similar objects to define multiple tests at once.

> The `name` value is the name of your test. The keys within `bucket` are your bucket names. Each bucket value is an object containing an object with an optional key `weight` that defaults to `1`.

> The percent chance a bucket is chosen for any given user is determined by the buckets weight divided by the total amount of all weights provided for an individual test. If you have three buckets with a weight of 2, `2/6 == 0.33` which means each bucket has a weight of `33%`. There is no max for the total weights allowed.

**Returns**: `null`

Name | Type | Description | Default
:--- | :--- | :--- | :---
`data` | `Object/Array` | _An object/array of objects containing test and bucket information_ | `null`

***

> ## `lua.assign(testName, bucketName)`

```javascript
const lua = new Lua();
lua.define({
  name: 'new-homepage',
  buckets: {
    variantA: { weight: 0.5 },
    variantB: { weight: 0.5 },
  }
});

// Assign buckets from all tests to the user...
lua.assign();

// or assign bucket from the specified test...
lua.assign('new-homepage');

// or specify the bucket from the specified test...
lua.assign('new-homepage', 'variantB');

// or remove the bucketing assignment from the specified test.
lua.assign('new-homepage', null);
```

> Calling the `assign` method will assign a bucket for the provided tests to a user and persist them to the `store`. If a user has already been bucketed, they will _not_ be rebucketed unless a `bucketName` is explicitly provided.

> If no arguments are provided, all tests will have a bucket assigned to the user. If the first argument provided is a test name, it will attempt to assign a bucket for that test to a user. If a `bucketValue` is provided, it will set that user to the specified bucket. If the `bucketValue` is null, it will remove that users assignment to the bucket.

**Returns**: `null`

Name | Type | Description | Default
:--- | :--- | :--- | :---
`testName` (optional) | `String` | _The name of the test to assign a bucket to_ | `null`
`bucketName` (optional) | `String` | _The name of the bucket to assign to a user_ | `null`

***

> ## `lua.definitions()`

```javascript
const lua = new Lua();
lua.define({
  name: 'new-homepage',
  buckets: {
    variantA: { weight: 0.5 },
    variantB: { weight: 0.5 },
  }
});

// Retrieve all of the provided tests
const tests = lua.definitions();
```

> This provides the user with all of the tests available.

> The returned information will be an array if multiple tests were defined, otherwise, it will be an object of the single test defined. The object will mirror exactly what was provided in the `define` method.

**Returns**: `Object|Array`

***

> ## `lua.assignments()`

```javascript
const lua = new Lua();
lua.define({
  name: 'new-homepage',
  buckets: {
    variantA: { weight: 1 },
  }
});

// Capture assignments
lua.assign();

// Retrieve all of the bucket assignments for the user
const buckets = lua.assignments();
assert.strictEqual(buckets['new-homepage'], 'variantA');
```

> This provides the user with all of the bucket assignments for the current user.

> The returned information will be an object whose keys will be test names and values will be the current bucket assigned to the user.

```javascript
// Example return
{
  'new-homepage': 'variantA',
  'some-test': 'some-bucket',
}
```

**Returns**: `Object|Array`

***

> ## `lua.extendAssignments`
>
> Extending assignments can be a useful way to augment your Lua implementation with third party software.

```javascript
const lua = new Lua();

// Create a function that will modify assignments before you call `assignments`
lua.extendAssignments =
  (assignments) => Object.assign(assignments, { foo: 'bar' })

// Retrieve all of the bucket assignments for the user
const buckets = lua.assignments();
assert.strictEqual(buckets['foo'], 'bar');
```

> A more practical example could be to implement with a third party AB testing platform like Optimizely _(This uses pseudo code for brevity)_

```javascript
lua.extendAssignments = (assignments) => {
  if (window.optimizely)
    for (const experiment in optimizely.experiments())
      assignments[experiment.name] = experiment.bucket

  return assignments
}
```

**Returns**: `Object`

***

## Guide/FAQ

### CSS Driven Tests

Tests logic may be potentially powered on solely CSS. Upon calling `assign`, if the script is running in the browser, a class per test will be added to the `body` tag with the test name and bucket in `BEM` syntax.

```html
<body class="new-homepage--variantA"> <!-- Could be new-homepage--variantB -->
```

```css
.new-homepage--variantA {
  /* Write custom styles for the new homepage test */
}
```

### Storing metadata associated with tests

Each bucket provided may have additional metadata associated with it, and may have its value retrieved by retrieving the assignments and definitions.

```javascript
const lua = new Lua();
lua.define({
  name: 'new-homepage',
  buckets: {
    variantA: { weight: 1, foo: 'bar' },
  }
});

lua.assign();

const defs = lua.definitions();
const buckets = lua.assignments();
const bucket = buckets['new-homepage'];
const bar = defs.buckets[bucket].foo; // "bar"
```

## AI-Powered Personalization

Lua includes an optional AI personalization engine that uses OpenAI GPT models to make intelligent content decisions. The AI analyzes UTM parameters, referrer data, device type, and user visit history to select the best content variant or generate new personalized content.

### Quick Setup

```html
<!-- Include AI modules after the core script -->
<script src="utm-personalize.js" defer></script>
<script src="storage/weighted-history.js" defer></script>
<script src="prompts/personalization-prompts.js" defer></script>
<script src="ai-personalize.js" defer></script>
```

```javascript
// Enable AI personalization
LuaUTMPersonalize.personalize({
    templates: {
        'gaming':      { headline: 'Level Up Your Setup', subheadline: '...', ctaLabel: 'Explore Gaming', ctaLink: '/gaming' },
        'professional': { headline: 'Work Smarter', subheadline: '...', ctaLabel: 'View Collection', ctaLink: '/pro' },
        'default':     { headline: 'Welcome', subheadline: '...', ctaLabel: 'Shop Now', ctaLink: '/shop' }
    },
    enableAI: true,
    aiConfig: {
        apiKey: 'sk-your-openai-key',   // Your OpenAI API key
        model: 'gpt-4o-mini',           // Default model (configurable)
        mode: 'select'                   // 'select' or 'generate'
    }
}).then(function(decision) {
    console.log('AI chose:', decision.intent, 'with confidence:', decision.aiResponse.confidence);
});
```

### Two Modes

**Select Mode**: AI chooses the best variant from your predefined templates. Predictable, fast, brand-consistent.

**Generate Mode**: AI creates entirely new headline, subheadline, and CTA text based on user context and your brand guidelines.

### Key Features

- **Default model**: `gpt-4o-mini` (configurable to any OpenAI model)
- **Weighted history**: Tracks returning users with exponential decay
- **Automatic caching**: Caches AI decisions to minimize API calls
- **Graceful fallback**: Falls back to standard UTM engine if AI fails
- **Proxy support**: Use `apiUrl` instead of `apiKey` for production security

For comprehensive setup instructions, configuration reference, and security best practices, see the [AI Personalization Guide](docs/AI_PERSONALIZATION_GUIDE.md).

***

## Push to GitHub

To commit your changes and push to GitHub:

```bash
# 1. Stage all changes
git add .

# 2. Commit with a descriptive message
git commit -m "feat: your change description"

# 3. Push to your remote (e.g. origin master or main)
git push origin master
# OR, if your default branch is main:
# git push origin main
```

Before pushing, it’s a good idea to run the build and tests:

```bash
pnpm run build
pnpm test
git add .
git commit -m "your message"
git push origin master
```

To publish the demo to **GitHub Pages** (so others can try it online):

```bash
pnpm run pages
# OR: npm run pages
```

This pushes the `master` branch to the `gh-pages` branch; the demo will be available at `https://<your-username>.github.io/Lua-Dynamic-Website-/` (or your repo’s Pages URL).

***

## License

**MIT Licensing**

Copyright (c) 2026 Okey Amy

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
