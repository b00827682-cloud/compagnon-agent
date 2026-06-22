# Compagnon — Sustainable Food Companion

A mobile-first web app that scans a fridge photo, scores the carbon footprint of its contents, builds an anti-waste recipe from what is closest to expiry, and proposes a local replenishment order. Built for the AI for Marketing & Innovation course (Team 5, ESSEC).

It is a single self-contained file, `Compagnon - Sustainable Food App.html`. No build step, no install. Open it in a browser.

## The five flows

1. **Fridge** — photograph the fridge; a vision model detects each item, draws a labeled box over it, and reads an estimated shelf life. Items can also be added or edited by hand.
2. **Carbon** — a weekly A to F grade computed from per-item carbon intensity, with the top contributors ranked.
3. **Recipes** — one anti-waste recipe built from the items closest to expiry, adapting to the fridge contents and to a dietary filter (vegetarian, vegan, gluten-free, dairy-free).
4. **Order** — an agentic local replenishment basket with a spend cap, auto-approve, a kill switch, and a readable audit log.
5. **Settings** — oversight controls, dietary preferences, privacy and rights, and the API key field.

Inventory, settings, saved recipes, and the audit log persist between sessions.

## Running the photo scan

The photo scan reads the actual image with a vision model, so it works on **any** photo. The model call needs to be reachable, which happens in either of two ways:

- **Inside Claude (free).** Open the app from the Claude.ai artifact panel (on a computer) or the Claude app. The model call is authenticated automatically, no key or billing. This is the simplest way to demo real detection on any photo.
- **Standalone with your own API key.** Open Settings, paste an Anthropic API key (from console.anthropic.com) into the Connection field, and save it. The app then calls the model directly from any browser, including the downloaded file. The key is stored only on the device.

If the model cannot be reached (for example, the file is opened directly in a plain browser with no key), the scan shows a clear message and the rest of the app still works: add items by hand, load the sample fridge, and use the carbon, recipe, and order flows offline.

## Responsible AI

EU AI Act limited-risk framing, a persistent AI-generated label on model output, an agent kill switch and spend cap, a readable audit log, on-device image handling that discards the photo after detection, and a clear-all-data control for the right to erasure.

## Tech notes

Single HTML file. React 18 and Babel are loaded from a CDN and the UI is plain CSS with brand design tokens (forest green, gold, cream). Vision detection and recipe generation call the Anthropic Messages API (`claude-sonnet-4-6`). Carbon values are estimated from food-category factors in the spirit of Agribalyse and Open Food Facts. Local producer data in the Order flow is sample data.
