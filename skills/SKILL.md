---
name: compagnon-fridge
description: >
  Turns a fridge scan into two safe outcomes: (1) one anti-waste recipe built
  from the items closest to expiry, respecting the household dietary filter, and
  (2) a local replenishment order placed under a spend cap, auto-approve and
  kill-switch oversight. Implemented in the Compagnon app (app/compagnon.html);
  this skill documents the procedure the app follows.
version: 1.0.0
model: claude-sonnet-4-6
guardrails: [dietary_filter, grounding, schema_validation, spend_cap, auto_approve, kill_switch, audit_log]
tested_with: [happy_path, low_cap_escalation, kill_switch, vegan_filter]
---

# Skill: Compagnon Fridge → Recipe & Replenishment

## Goal
From the current fridge inventory, (a) generate exactly one anti-waste recipe
that prioritises items closest to expiry and never violates the dietary filter,
and (b) propose/place a local replenishment order without ever exceeding the
user's spend cap or acting while the kill switch is on.

## Inputs
- Fridge inventory: items with `name`, category `k`, `days` to expiry, `co2`, `wkg`.
  Produced by the on-device vision scan or the "load sample fridge" shortcut.
- `diet`: one of `none | vegetarian | vegan | gluten-free | dairy-free`.
- Order settings: `cap` (€15–80), `auto` (auto-approve under cap), `killed`.

## Outputs
- **Recipe** (strict JSON): `title, why, servings, time_min, ingredients[{name,amount,fromFridge}], steps[4–6], macros, co2e_per_serving_kg`.
- **Order decision**: `status ∈ {PLACED, ESCALATED, NEEDS_CONFIRM, BLOCKED}`, `total`, `co2Saved`, `audit[]`.

## Procedure — recipe engine
1. Sort inventory by `days` ascending; take the items expiring within 6 days
   (the "rescue" set), up to 5.
2. Call `claude-sonnet-4-6` with a system prompt that demands JSON-only output,
   uses only inventory + common pantry staples, and respects the dietary
   constraint strictly.
3. **Guardrail — schema validation:** parse JSON; if it lacks a title or arrays
   for ingredients/steps, reject.
4. **Guardrail — dietary filter:** run `dietViolation(recipe, diet)`; if any
   banned token is present, reject. Enforced *after* generation, at the
   tool-call level, not in the prompt.
5. **Guardrail — grounding:** run `groundIngredients(recipe, inv)` so each
   ingredient is flagged `fromFridge` true/false; surface the count to the user.
6. On any rejection, fall back to the deterministic offline recipe (also
   dietary-checked). Never show an unvalidated recipe.

## Procedure — replenishment agent
1. Build the basket from the nearest local producers (within 15 km), sourced via
   the MCP producer server (`mcp/producer_server.py`, tool `basket_for`).
2. **Guardrail — kill switch:** if `killed`, block all action; log and stop.
3. **Guardrail — spend cap:** if `total > cap`, escalate for approval; do not place.
4. **Guardrail — auto-approve:** if under cap and `auto` is off, require manual confirm.
5. Otherwise place the order and write an **audit log** line: item count, total,
   CO₂ saved vs supermarket, distance.

## Stop / escalate conditions (non-negotiable)
- Kill switch on → BLOCKED.
- Basket over the cap → ESCALATED (never auto-placed).
- Auto-approve off → NEEDS_CONFIRM.
- Recipe fails schema or dietary check → rejected, offline fallback used.

## Failure handling
| Step | Failure | Action |
|------|---------|--------|
| Recipe | model unreachable / no key | offline recipe used; app shows a clear message |
| Recipe | unparseable / invalid JSON | reject, offline fallback |
| Recipe | dietary violation | reject, offline fallback |
| Order | over cap | escalate, no spend |
| Order | kill switch | block everything |

## Examples
See `examples/happy_path.json` and `examples/low_cap_escalation.json`.
