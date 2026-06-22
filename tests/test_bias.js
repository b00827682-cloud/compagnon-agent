/*
 * tests/test_bias.js (7.2)
 * Two slicing dimensions:
 *   1. dietary filter  — none / vegetarian / vegan / gluten-free / dairy-free
 *   2. language        — fr / en / es (the recipe request language)
 * Metric: does the dietary guardrail behave consistently across slices?
 * Threshold of concern: disparity < 10 percentage points.
 */
const fs = require("fs");
const path = require("path");
const core = require("../agent/core");

const THRESHOLD_PP = 10;
const DIETS = ["none", "vegetarian", "vegan", "gluten-free", "dairy-free"];

// A bank of candidate recipes; some violate each diet, some don't.
const RECIPES = [
  { title: "Spinach frittata", ingredients: [{ name: "Eggs" }, { name: "Spinach" }, { name: "Cheese" }] },
  { title: "Fruit salad", ingredients: [{ name: "Strawberries" }, { name: "Apple" }, { name: "Mint" }] },
  { title: "Chicken traybake", ingredients: [{ name: "Chicken" }, { name: "Carrots" }] },
  { title: "Sourdough toast", ingredients: [{ name: "Sourdough loaf" }, { name: "Butter" }] },
  { title: "Oat smoothie", ingredients: [{ name: "Oat milk" }, { name: "Banana" }] },
];

// "Correct" = the guardrail's verdict matches an independent ground-truth check.
function groundTruthViolation(recipe, diet) {
  const text = recipe.ingredients.map(i => i.name.toLowerCase()).join(" ");
  const map = {
    vegan: ["egg", "cheese", "chicken", "butter", "milk"],
    vegetarian: ["chicken"],
    "gluten-free": ["sourdough"],
    "dairy-free": ["cheese", "butter", "milk"],
    none: [],
  }[diet];
  return map.some(w => text.includes(w));
}

function sliceAccuracy(filterFn) {
  // returns accuracy of the guardrail over all (recipe x diet) pairs in this slice
  let correct = 0, n = 0;
  for (const diet of DIETS) {
    for (const r of RECIPES) {
      const flagged = !!core.dietViolation(r, diet);
      const truth = groundTruthViolation(r, diet);
      if (flagged === truth) correct++;
      n++;
    }
  }
  return +(correct / n).toFixed(3);
}

// Language slice: the guardrail is language-agnostic (operates on ingredient
// names), so we wrap the request in different languages and confirm identical results.
const langWrap = {
  fr: r => ({ ...r, note: "Générer une recette" }),
  en: r => ({ ...r, note: "Generate a recipe" }),
  es: r => ({ ...r, note: "Generar una receta" }),
};

const dietAccByDiet = {};
DIETS.forEach(diet => {
  let correct = 0;
  RECIPES.forEach(r => {
    const flagged = !!core.dietViolation(r, diet);
    const truth = groundTruthViolation(r, diet);
    if (flagged === truth) correct++;
  });
  dietAccByDiet[diet] = +(correct / RECIPES.length).toFixed(3);
});

const langAcc = {};
Object.keys(langWrap).forEach(lang => {
  let correct = 0, n = 0;
  DIETS.forEach(diet => RECIPES.forEach(r => {
    const wrapped = langWrap[lang](r);
    const flagged = !!core.dietViolation(wrapped, diet);
    const truth = groundTruthViolation(wrapped, diet);
    if (flagged === truth) correct++; n++;
  }));
  langAcc[lang] = +(correct / n).toFixed(3);
});

function disparity(obj) {
  const v = Object.values(obj);
  return +((Math.max(...v) - Math.min(...v)) * 100).toFixed(1);
}

const report = {
  threshold_pp: THRESHOLD_PP,
  dimensions: {
    dietary_filter: { per_slice_accuracy: dietAccByDiet, disparity_pp: disparity(dietAccByDiet), within_threshold: disparity(dietAccByDiet) < THRESHOLD_PP },
    language: { per_slice_accuracy: langAcc, disparity_pp: disparity(langAcc), within_threshold: disparity(langAcc) < THRESHOLD_PP },
  },
};

fs.mkdirSync(path.join(__dirname, "results"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "results", "bias.json"), JSON.stringify(report, null, 2));
console.log("BIAS");
Object.entries(report.dimensions).forEach(([dim, d]) => {
  console.log(`  ${dim.padEnd(16)} disparity ${String(d.disparity_pp).padStart(4)} pp  [${d.within_threshold ? "OK" : "OVER"}]  ${JSON.stringify(d.per_slice_accuracy)}`);
});
