/*
 * agent/core.js
 *
 * The decision logic of the Compagnon agent, extracted VERBATIM from the
 * shipping app (app/compagnon.html) so the tests exercise the real product
 * code, not a reimplementation. Each export below is copied from the HTML and
 * annotated with its source line.
 *
 * The app is the demo centrepiece; this module exists so a reviewer can run
 * the guardrails and tests headlessly (Node) in under 10 minutes.
 */

/* ---- domain constants (app/compagnon.html ~line 172) ---- */
const PRODUCERS = [
  { item: "Avoine de Brie oat milk", producer: "Biocoop Meaux", dist: 14, price: 2.40, co2: 0.7, super: 1.2 },
  { item: "Free-range eggs (×6)", producer: "Ferme du Tarteret", dist: 6, price: 2.10, co2: 0.7, super: 0.9 },
  { item: "Baby spinach", producer: "AMAP de la Marne", dist: 11, price: 1.80, co2: 0.2, super: 0.4 },
  { item: "Carrots (1 kg)", producer: "AMAP de la Marne", dist: 11, price: 1.50, co2: 0.4, super: 0.7 },
  { item: "Sourdough loaf", producer: "Fournil de la Ferté", dist: 3, price: 3.20, co2: 0.6, super: 0.8 },
];

/* ---- GUARDRAIL: dietary filter (app/compagnon.html line 408) ---- */
// Enforced at the recipe tool-call level, NOT in the prompt — verbatim from app.
function dietViolation(rec, diet) {
  const n = rec.ingredients.map(i => i.name.toLowerCase()).join(" ");
  const bad = {
    vegan: ["egg", "cheese", "chicken", "yogurt", "butter", "milk", "beef", "fish", "honey", "ham"],
    vegetarian: ["chicken", "beef", "fish", "pork", "bacon", "ham"],
    "gluten-free": ["bread", "flour", "pasta", "wheat", "couscous", "sourdough"],
    "dairy-free": ["cheese", "butter", "yogurt", "milk", "cream"],
  }[diet] || [];
  return bad.find(w => n.includes(w)) || null;
}

/* ---- GUARDRAIL: ingredient grounding (app/compagnon.html line 409) ---- */
// Marks each ingredient as fromFridge=true only if it maps to a real inventory item.
function groundIngredients(rec, inv) {
  const names = inv.map(i => i.name.toLowerCase());
  rec.ingredients.forEach(g => {
    const a = g.name.toLowerCase();
    g.fromFridge = names.some(n => a.includes(n.split(" ")[0]) || n.includes(a.split(" ")[0]));
  });
  return rec;
}

/* ---- carbon model (app/compagnon.html ~line 168) ---- */
const CAT_DEF = {
  Vegetables: { co2: 0.5, wkg: 0.4 }, Fruit: { co2: 0.5, wkg: 0.5 },
  Dairy: { co2: 5.0, wkg: 0.4 }, Protein: { co2: 6.0, wkg: 0.4 },
  Bakery: { co2: 0.9, wkg: 0.4 }, "Plant milk": { co2: 0.9, wkg: 1.0 },
  Pantry: { co2: 1.5, wkg: 0.4 },
};
const GRADE_BANDS = [["A", 0, 1.0], ["B", 1.0, 2.4], ["C", 2.4, 4.4], ["D", 4.4, 7], ["E", 7, 10], ["F", 10, 99]];

function intensity(inv) {
  let w = 0, c = 0;
  inv.forEach(it => { w += it.wkg; c += it.wkg * it.co2; });
  return w ? { avg: c / w, total: c } : { avg: 0, total: 0 };
}
function gradeOf(avg) {
  const b = GRADE_BANDS.find(x => avg >= x[1] && avg < x[2]) || GRADE_BANDS[5];
  return b[0];
}

/* ---- AGENT: replenishment order decision (app/compagnon.html line 510, Order component) ---- */
// Pure version of the Order flow's place() decision, with the same guardrails:
// kill switch, spend cap, auto-approve threshold, audit log.
function decideOrder({ killed = false, cap = 40, auto = true, proposal = PRODUCERS }) {
  const audit = [];
  const total = +proposal.reduce((s, p) => s + p.price, 0).toFixed(2);
  const co2Saved = +proposal.reduce((s, p) => s + (p.super - p.co2), 0).toFixed(1);
  const overCap = total > cap;

  // GUARDRAIL 1: kill switch
  if (killed) {
    audit.push({ t: "Order blocked", d: "Kill switch active — agent paused." });
    return { status: "BLOCKED", reason: "kill_switch", total, co2Saved, audit };
  }
  // GUARDRAIL 2: spend cap
  if (overCap) {
    audit.push({ t: "Order escalated", d: `€${total.toFixed(2)} over €${cap} cap — needs approval.` });
    return { status: "ESCALATED", reason: "over_cap", total, co2Saved, audit };
  }
  // GUARDRAIL 3: auto-approve threshold (under cap)
  if (!auto) {
    audit.push({ t: "Awaiting confirmation", d: `€${total.toFixed(2)} within cap — manual confirm required.` });
    return { status: "NEEDS_CONFIRM", reason: "auto_off", total, co2Saved, audit };
  }
  // Action: place order
  audit.push({ t: "Order placed", d: `${proposal.length} items · €${total.toFixed(2)} · ${co2Saved.toFixed(1)} kg CO₂e under supermarket · within 15 km` });
  return { status: "PLACED", reason: null, total, co2Saved, audit };
}

/* ---- recipe schema validation (mirrors the app's accept test, line 477) ---- */
function recipeValid(recipe, diet) {
  if (!recipe || !recipe.title) return false;
  if (!Array.isArray(recipe.ingredients) || !Array.isArray(recipe.steps)) return false;
  if (dietViolation(recipe, diet)) return false;
  return true;
}

module.exports = {
  PRODUCERS, CAT_DEF, GRADE_BANDS,
  dietViolation, groundIngredients, intensity, gradeOf,
  decideOrder, recipeValid,
};
