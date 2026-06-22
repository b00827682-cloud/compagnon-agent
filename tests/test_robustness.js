/*
 * tests/test_robustness.js (7.1)
 * Exercises the app's real guardrails: spend cap, kill switch, auto-approve,
 * recipe schema/dietary validation, and adversarial/over-scope inputs.
 */
const fs = require("fs");
const path = require("path");
const core = require("../agent/core");

const cases = [];
function check(id, category, fn, expect) {
  let pass = false, detail = "";
  try { const out = fn(); pass = expect(out); detail = JSON.stringify(out).slice(0, 120); }
  catch (e) { detail = "THREW: " + e.message; pass = false; }
  cases.push({ id, category, pass, detail });
}

// --- spend cap: an over-cap basket must NOT place ---
check("cap_01", "spend_cap",
  () => core.decideOrder({ cap: 5, auto: true }),
  o => o.status === "ESCALATED" && o.reason === "over_cap");

// --- kill switch blocks even a valid, under-cap order ---
check("kill_01", "kill_switch",
  () => core.decideOrder({ killed: true, cap: 40, auto: true }),
  o => o.status === "BLOCKED" && o.reason === "kill_switch");

// --- auto-approve off: under cap still needs confirmation ---
check("auto_01", "auto_approve",
  () => core.decideOrder({ cap: 40, auto: false }),
  o => o.status === "NEEDS_CONFIRM");

// --- happy path places within cap ---
check("happy_01", "happy_path",
  () => core.decideOrder({ cap: 40, auto: true }),
  o => o.status === "PLACED" && o.total <= 40);

// --- adversarial: a recipe smuggling a non-vegan item must be rejected for vegan ---
check("adv_diet_01", "adversarial_dietary",
  () => core.dietViolation({ ingredients: [{ name: "Parmesan cheese" }, { name: "Spinach" }] }, "vegan"),
  v => v === "cheese");

// --- adversarial: gluten item rejected for gluten-free ---
check("adv_diet_02", "adversarial_dietary",
  () => core.dietViolation({ ingredients: [{ name: "Sourdough loaf" }] }, "gluten-free"),
  v => v === "sourdough");

// --- schema: malformed recipe rejected ---
check("schema_01", "schema_validation",
  () => core.recipeValid({ title: "x", ingredients: "not-an-array", steps: [] }, "none"),
  ok => ok === false);

// --- schema: empty object rejected ---
check("schema_02", "schema_validation",
  () => core.recipeValid({}, "none"),
  ok => ok === false);

// --- grounding: a hallucinated ingredient not in the fridge is flagged false ---
check("ground_01", "grounding",
  () => {
    const rec = { ingredients: [{ name: "Spinach" }, { name: "Truffle oil" }] };
    core.groundIngredients(rec, [{ name: "Baby spinach" }, { name: "Eggs" }]);
    return rec.ingredients;
  },
  ings => ings[0].fromFridge === true && ings[1].fromFridge === false);

// --- edge: empty proposal places a €0 order within any cap (no crash) ---
check("edge_01", "edge_case",
  () => core.decideOrder({ cap: 40, auto: true, proposal: [] }),
  o => o.status === "PLACED" && o.total === 0);

const passed = cases.filter(c => c.pass).length;
const byCat = {};
cases.forEach(c => { byCat[c.category] = byCat[c.category] || [0, 0]; byCat[c.category][0] += c.pass ? 1 : 0; byCat[c.category][1]++; });

const report = { n: cases.length, passed, pass_rate: +(passed / cases.length).toFixed(3),
  by_category: Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, { passed: v[0], n: v[1] }])),
  rows: cases };

fs.mkdirSync(path.join(__dirname, "results"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "results", "robustness.json"), JSON.stringify(report, null, 2));
console.log(`ROBUSTNESS: ${passed}/${cases.length} passed (${Math.round(passed / cases.length * 100)}%)`);
Object.entries(report.by_category).forEach(([k, v]) => console.log(`  ${k.padEnd(22)} ${v.passed}/${v.n}`));
if (passed < cases.length) cases.filter(c => !c.pass).forEach(c => console.log(`  FAIL ${c.id}: ${c.detail}`));
