/* tests/run_all.js — run all four suites (mock mode, no key needed). */
const { execSync } = require("child_process");
const path = require("path");
process.env.AGENT_MOCK = process.env.AGENT_MOCK || "1";
const suites = ["test_robustness.js", "test_bias.js", "test_carbon.js", "test_explainability.js"];
console.log("Running all suites (mock mode, no API key needed)\n");
for (const s of suites) {
  console.log("-".repeat(58));
  try { console.log(execSync(`node ${path.join(__dirname, s)}`, { encoding: "utf8" })); }
  catch (e) { console.log(e.stdout || e.message); }
}
console.log("-".repeat(58));
console.log("\nResults in tests/results/*.json · report in tests/results/REPORT.md");
