# Compagnon — Sustainable Food Companion · Agent build

**Class 6 build deliverable — Team 5, ESSEC AI for Marketing & Innovation.**

The product is **Compagnon**, a mobile-first app that scans a fridge, scores its
carbon footprint, builds an anti-waste recipe from the items closest to expiry,
and proposes a local replenishment order — all under explicit AI-safety
guardrails. The shipping app is `app/compagnon.html` (single self-contained
file, no build step). This repository wraps it with the agent documentation,
guardrails, and executed tests the build deliverable requires.

> Model: **claude-sonnet-4-6** (vision scan + recipe engine). Agentic step:
> the replenishment order decision. Runs fully **offline in mock mode** with no
> API key, so the demo and tests are reproducible anywhere.

---

## Run it in under 10 minutes

**Prerequisite:** Node 18 or newer (for the headless agent + tests). Check with
`node --version`; if it's missing, install from nodejs.org (~2 minutes). The app
itself (`app/compagnon.html`) needs only a web browser — no Node required.

**See the product (the demo centrepiece):**
```bash
# open the app in a browser
open "app/compagnon.html"        # macOS    (or: xdg-open on Linux)
```
Use "Load sample fridge" for an instant demo, or scan a real fridge photo
(works keyless inside the Claude app, or with your own key — see app/APP_README.md).

**Run the agent headlessly + all tests (no API key needed):**
```bash
node agent/run.js            # one full trajectory: carbon → recipe → order
node tests/run_all.js        # robustness, bias, carbon, explainability
```

That's it for the core deliverable — Node only, no install, no key. Mock mode is
automatic when no real key is present, so the agent and tests reproduce anywhere.

### Optional — run the recipe engine against the real model (needs a key)
```bash
cp .env.example .env         # then open .env and paste your key after the = sign
node agent/run.js            # now calls claude-sonnet-4-6 for the recipe
```
The `.env` file holds `ANTHROPIC_API_KEY=insert-api-key-here` — replace the
placeholder with a real key from https://console.anthropic.com. If you leave the
placeholder (or omit the key), everything still runs in mock mode. The app
(`app/compagnon.html`) takes its key separately in its own Settings screen.

### Optional — run the MCP producer server (Deliverable 3)
```bash
pip install -r requirements.txt   # installs fastmcp
python mcp/client_example.py      # spawns the server + calls both tools
```
This starts the FastMCP server (`mcp/producer_server.py`) and a client that
lists its tools and fetches a local-producer basket — proof the MCP connection
works. The server is read-only; placing an order stays in the guarded agent.

### Architecture
See `agent/architecture.svg` for the boxes-and-arrows diagram of this specific
ReAct instance (on-device perception → agent + guardrails → MCP source → audited
outputs).

---

## What the demo shows
1. **Scan** — vision model detects fridge items and shelf life (real photo).
2. **Carbon** — weekly A–F grade from per-item intensity.
3. **Recipe** — one anti-waste recipe from expiring items, dietary-filtered and
   grounded to the fridge (each ingredient flagged in/out of fridge).
4. **Order** — the agent proposes a local basket, then **stops at the spend cap
   / kill switch** — the guardrail the jury remembers.
5. **Settings** — kill switch, cap, dietary filter, privacy, Art. 22 opt-out.

To trigger the spend-cap guardrail live: in the Order tab lower the weekly cap
below the basket total, or toggle the kill switch.

---

## Repository map
| Path | Contents |
|---|---|
| `app/compagnon.html` | **The shipping app** — five flows, real Claude vision + recipe engine |
| `app/APP_README.md` | How to run the app keyless or with a key |
| `agent/core.js` | The agent's decision logic, **copied verbatim from the app** (source lines noted) |
| `agent/model_client.js` | Anthropic call mirroring the app's `callClaude`, with offline mock |
| `agent/run.js` | Headless reproduction of the recipe + order trajectory (for tracing/tests) |
| `agent/architecture.svg` | **Architecture diagram** — the specific ReAct instance (Deliverable 2) |
| `mcp/producer_server.py` | **Real MCP server (FastMCP)** wrapping the local-producer lookup (Deliverable 3) |
| `mcp/client_example.py` | MCP client that connects and calls both tools (proof it works) |
| `skills/SKILL.md` | The procedure the agent follows + two worked examples |
| `guardrails/GUARDRAILS.md` | Every guardrail mapped to its enforcement point in the app |
| `tests/` | Robustness, bias, carbon, explainability suites (import the real `core.js`) |
| `tests/results/REPORT.md` | Results with the numbers below |
| `traces/sample_run.json` | A sanitised sample trajectory |
| `.env.example` | Optional Anthropic key (mock mode if absent) |

---

## The seven build deliverables
1. **Workflow choice** — *When a fridge scan arrives, the agent builds one
   dietary-safe anti-waste recipe from the expiring items and proposes a local
   replenishment order, placing it only within the spend cap and with the kill
   switch off.* High-frequency, bounded, measurable, recoverable.
2. **Architecture** — **ReAct single agent**: one model-driven step (recipe
   generation) plus deterministic tool steps (carbon scoring, order decision).
   Diagram in `agent/architecture.svg`. Trade-off accepted: limited parallelism
   — fine for this bounded task.
3. **Tool & MCP stack** — Anthropic Messages API (`claude-sonnet-4-6`); a real
   **FastMCP server** (`mcp/producer_server.py`) exposing the local-producer
   lookup over stdio; React 18 UI; carbon factors after Agribalyse / Open Food
   Facts. Declared in `requirements.txt` + `agent/model_client.js`.
4. **Working agent** — `app/compagnon.html` (UI) + `agent/run.js` (headless).
   Real input, ≥2 decision steps, structured JSON, graceful offline fallback.
5. **SKILL.md** — `skills/SKILL.md` with goal, I/O, numbered steps, stop
   conditions, failure handling, two examples.
6. **Guardrails** — dietary filter, grounding, schema validation, spend cap,
   auto-approve, kill switch, audit log, on-device image handling, Art. 22 —
   all enforced in code (`guardrails/GUARDRAILS.md` maps each one).
7. **Tests** — four suites with committed results in `tests/results/`.

## Results (reproduce with `node tests/run_all.js`)
- **Robustness:** 10/10 (100%) — caps, kill switch, dietary, schema, grounding, edge.
- **Bias:** 0.0 pp disparity across dietary filters and FR/EN/ES.
- **Carbon:** ~0.006 gCO₂eq/run; ~29 kg/month at 600K users — negligible vs the
  ~27,000 t/yr of food-waste CO₂ the product avoids.
- **Explainability:** trace 100%, audit 100%, GDPR Art. 22 appeal-supportable 10/10.

## Agentic vs workflow — honest note
Most of the flow is a deterministic workflow. The genuinely agentic part is the
**replenishment decision**, where runtime judgement (which basket, within cap,
given live producer options) plus oversight (cap, kill switch, audit) is
warranted. Recipe generation is a single model call. We kept the autonomy narrow
and the guardrails in code — exactly what the brief rewards.
