/*
 * tests/test_carbon.js (7.3)
 * Counts tokens for one full agent run (recipe generation is the only model
 * call; the order step is pure code) and converts to energy + gCO2eq.
 * Reference numbers cited in REPORT.md.
 */
const fs = require("fs");
const path = require("path");
const { run } = require("../agent/run");
const { TOKEN_LOG } = require("../agent/model_client");

const KWH_PER_1K = 0.0005;          // frontier LLM, per 1k tokens
const GRID = { france_g_per_kwh: 60, eu_avg_g_per_kwh: 250 };
const MAU = 600000;                  // Year-3 from the deck
const RUNS_PER_USER_MONTH = 8;

(async () => {
  TOKEN_LOG.length = 0;
  await run({ diet: "none" });

  const tin = TOKEN_LOG.reduce((s, t) => s + t.input_tokens, 0);
  const tout = TOKEN_LOG.reduce((s, t) => s + t.output_tokens, 0);
  const total = tin + tout;
  const kwh = total / 1000 * KWH_PER_1K;
  const gFr = kwh * GRID.france_g_per_kwh;
  const gEu = kwh * GRID.eu_avg_g_per_kwh;
  const monthlyKgFr = gFr * MAU * RUNS_PER_USER_MONTH / 1000;

  const report = {
    note: "Recipe generation is the single model call; the replenishment decision is pure code (zero tokens).",
    per_run: { model_calls: TOKEN_LOG.length, input_tokens: tin, output_tokens: tout,
      total_tokens: total, kwh: +kwh.toFixed(8),
      gco2eq_france: +gFr.toFixed(4), gco2eq_eu_avg: +gEu.toFixed(4) },
    year3_projection: { mau: MAU, runs_per_month: MAU * RUNS_PER_USER_MONTH,
      kg_co2eq_per_month_france: +monthlyKgFr.toFixed(1) },
    context: "At 600K users the agent's own footprint (~" + monthlyKgFr.toFixed(0) +
      " kg CO2eq/month) is negligible against the ~27,000 tonnes/yr of food-waste CO2 the product is modelled to avoid.",
  };
  fs.mkdirSync(path.join(__dirname, "results"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "results", "carbon.json"), JSON.stringify(report, null, 2));
  console.log("CARBON");
  console.log(`  tokens/run: ${total} (${TOKEN_LOG.length} model call)`);
  console.log(`  gCO2eq/run: ${gFr.toFixed(4)} (France) / ${gEu.toFixed(4)} (EU avg)`);
  console.log(`  Year-3 monthly: ${monthlyKgFr.toFixed(1)} kg CO2eq (France grid)`);
})();
