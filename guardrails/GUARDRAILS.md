# Guardrails — Compagnon agent

All guardrails are **enforced in code**, in the shipping app
(`app/compagnon.html`) and in the headless module (`agent/core.js`) that the
tests import. None live only in prompts. Each row gives the enforcement point.

| # | Guardrail | Type | Enforcement point | Behaviour when triggered |
|---|-----------|------|-------------------|--------------------------|
| 1 | **Dietary filter** | Output content filter | `dietViolation()` — `core.js`, app line 408. Checked at the recipe tool-call level, after generation, **not** in the prompt. | Recipe rejected; agent falls back to a compliant offline recipe. |
| 2 | **Ingredient grounding** | Hallucination guard | `groundIngredients()` — `core.js`, app line 409. | Every ingredient flagged `fromFridge` true/false; ungrounded items are visible, not silently trusted. |
| 3 | **Recipe schema validation** | Output validation | `recipeValid()` — app line 477 (`if(!recipe.title||!Array.isArray…)`). | Malformed model output is discarded; offline recipe used instead. |
| 4 | **Spend cap** | Budget / action limit | `decideOrder()` — app `Order` component, line 510. `overCap = total > cap`. | Order **escalated**, not placed. Cap is user-set (€15–80). |
| 5 | **Auto-approve threshold** | Action gate | `decideOrder()` — `auto` flag. | Under cap + auto off → manual confirmation required. |
| 6 | **Kill switch** | Global stop | `decideOrder()` — `killed` flag; app `setKilled`. | All autonomous actions blocked instantly until resumed. |
| 7 | **Audit log** | Oversight / traceability | `addLog()` in app; `audit[]` in `decideOrder()`. | Every order decision recorded with amount, CO₂, distance, timestamp. |
| 8 | **On-device image handling** | Privacy | App scan flow — photo read then discarded, faces not retained. | No image leaves the device beyond the model call; nothing stored. |
| 9 | **EU AI Act / GDPR Art. 22** | Compliance | App Settings — AI disclosure label, Art. 22 opt-out, right-to-erasure clear-all. | Automated ordering can be disabled; all data erasable. |

## How to see them trigger
- **Spend cap / kill switch / auto-approve:** `node tests/test_robustness.js` runs
  each path; or open the app, set a low cap or toggle the kill switch in the Order tab.
- **Dietary filter:** `node tests/test_bias.js` runs every diet against the recipe
  validator; or pick "vegan" in the app and generate a recipe.
- **Audit log:** printed in every `agent/run.js` trace and saved to `traces/`.

## External source (MCP)
The local-producer data the order step uses is exposed by a real MCP server,
`mcp/producer_server.py` (FastMCP), read-only and scoped to producers within
15 km. The server never places orders — ordering stays here, behind the
guardrails above. Run `python mcp/client_example.py` to see it serve.
