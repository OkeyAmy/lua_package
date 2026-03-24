# LuaIntent — Comprehensive Integration Guide

## 📦 Methods of Installation

LuaIntent is designed to be fully isomorphic and pluggable. You can inject it directly into the `<head>` of your HTML document, import it via a bundler (Webpack/Vite/esbuild), or even run it on your Node server (e.g. Next.js Edge Middleware) because it has **zero browser-specific native dependencies** inside the core math engine.

### Method 1: The Browser Snippet (Recommended for Marketers)

To start profiling intent immediately, you can simply load the library inside your site's `<head>`.

```html
<script src="https://cdn.lua-intent.com/v1.0.0/lua-intent.bundle.js"></script>
<script>
  document.addEventListener("DOMContentLoaded", () => {
    // 1. Boot up the tracker
    const behaviorTracker = new window.BehaviorAnalyzer({ enableListeners: true });
    const engine = new window.LuaIntent({ debug: true });

    // 2. Sample data every 5 seconds to adjust intent organically
    setInterval(() => {
       const snapshot = behaviorTracker.snapshot();
       const decision = engine.decide({
           url: window.location.href,
           referrer: document.referrer,
           behavior: snapshot
       });

       console.log("Top Intent:", decision.intent);
       console.log("Algorithm Confidence:", decision.confidence);

       // 3. Simple UI Switcher
       if (decision.intent === 'buy_now') {
         document.body.classList.add('theme-urgent');
         document.getElementById('cta-button').innerText = 'Complete Purchase';
       }
    }, 5000);
  });
</script>
```

### Method 2: NPM Package (React / Next.js / Vue)

If you are building a Single Page Application (SPA), LuaIntent easily integrates via imports.

```bash
npm install @lua-intent/core
```

```javascript
import { LuaIntent } from '@lua-intent/core';
import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

export function useIntent() {
  const location = useLocation();
  const [intent, setIntent] = useState('research');
  
  useEffect(() => {
    const engine = new LuaIntent();
    // In React, the behavior score is tracked manually or via the adapter
    const decision = engine.decide({
      url: window.location.origin + location.pathname + location.search,
      referrer: document.referrer || '',
      behavior: { engagementScore: 1.0 } 
    });
    
    setIntent(decision.intent);
  }, [location]);

  return intent; // e.g., 'compare', 'buy_now', 'research'
}
```

---

## ⚙️ Configuration Overrides

You can explicitly disable specific signal layers to comply with complex privacy policies simply by omitting them from the `decide(context)` payload.

If you omit `behavior`, the ScoreFuser will automatically skip the Engagement Multiplier and rely purely on URL, Time, and Referrer data—providing an instant (but slightly less confident) intent score!

```javascript
const engine = new LuaIntent({
    defaultIntent: 'brand', 
    aiThreshold: 0.65 // Only use AI if the math confidence drops below 65%
});
```
