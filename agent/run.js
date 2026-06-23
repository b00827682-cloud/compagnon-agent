/*
 * agent/run.js — headless reproduction of the Compagnon agent trajectory.
 *
 * The shipping UI is app/compagnon.html. This runner exercises the same two
 * agentic steps without a browser so they can be traced and tested:
 *   1. Recipe engine  : call the model, validate schema, enforce dietary
 *                       filter, ground ingredients to the fridge.
 *   2. Replenishment  : decide the local order under kill switch / spend cap /
 *                       auto-approve guardrails, writing an audit log.
 *
 * Usage:  node agent/run.js
 *         AGENT_MOCK=1 node agent/run.js   (force offline; no key)
 */
const fs = require("fs");
const path = require("path");
const core = require("./core");
const { callClaude, mockEnabled, MODEL } = require("./model_client");

const TRACE = [];
function trace(step, data) {
  TRACE.push({ step, ...data });
  const brief = JSON.stringify(data);
  console.log(`  [${step}] ${brief.length > 150 ? brief.slice(0, 150) + "…" : brief}`);
}

const SAMPLE_FRIDGE = [
  { name: "Strawberries", k: "Fruit", days: 2, co2: 0.7, wkg: 0.25 },
  { name: "Baby spinach", k: "Vegetables", days: 3, co2: 0.5, wkg: 0.40 },
  { name: "Eggs", k: "Protein", days: 14, co2: 2.1, wkg: 0.60 },
  { name: "Fresh milk", k: "Dairy", days: 5, co2: 1.4, wkg: 1.00 },
  { name: "Cheese", k: "Dairy", days: 18, co2: 9.8, wkg: 0.20 },
  { name: "Tomatoes", k: "Vegetables", days: 6, co2: 1.1, wkg: 0.40 },
];

async function recipeStep(inv, diet) {
  const sorted = [...inv].sort((a, b) => a.days - b.days);
  const show = sorted.filter(i => i.days <= 6).slice(0, 5);
  trace("recipe.rescue", { items: show.map(i => i.name), diet });

  const sys = "You are the Recipe Engine. Return ONLY JSON.";
  const user = `Inventory: ${inv.map(i => i.name).join(", ")}\nDietary: ${diet}`;
  const data = await callClaude({ model: MODEL, max_tokens: 1300, system: sys,
    messages: [{ role: "user", content: user }] });
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");

  let recipe;
  try { recipe = JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch (e) { trace("recipe.error", { reason: "unparseable" }); return null; }

  // GUARDRAIL: schema + dietary + grounding (the app's accept test)
  if (!core.recipeValid(recipe, diet)) {
    trace("recipe.rejected", { reason: "schema_or_dietary" });
    return null;
  }
  core.groundIngredients(recipe, inv);
  const grounded = recipe.ingredients.filter(i => i.fromFridge).length;
  trace("recipe.accepted", { title: recipe.title,
    grounding: `${grounded}/${recipe.ingredients.length}`,
    dietary_ok: !core.dietViolation(recipe, diet) });
  return recipe;
}

function orderStep(opts) {
  const r = core.decideOrder(opts);
  trace("order.decide", { status: r.status, total: r.total, co2Saved: r.co2Saved, reason: r.reason });
  return r;
}

async function run({ diet = "none", killed = false, cap = 40, auto = true } = {}) {
  TRACE.length = 0;
  console.log(`\n=== Compagnon agent (${mockEnabled() ? "offline/mock" : "live Claude"}) :: diet=${diet} cap=€${cap} killed=${killed} ===`);
  trace("carbon.grade", { grade: core.gradeOf(core.intensity(SAMPLE_FRIDGE).avg) });
  const recipe = await recipeStep(SAMPLE_FRIDGE, diet);
  const order = orderStep({ killed, cap, auto });
  return { recipe, order, trace: [...TRACE] };
}

if (require.main === module) {
  run().then(({ recipe, order }) => {
    // persist a sanitised sample trace for /traces
    fs.writeFileSync(path.join(__dirname, "..", "traces", "sample_run.json"),
      JSON.stringify(TRACE, null, 2));
    console.log("\nRESULT:", JSON.stringify({
      recipe: recipe && recipe.title, order_status: order.status, order_total: order.total,
    }, null, 2));
  });
}

module.exports = { run, SAMPLE_FRIDGE };
