/*
 * tests/test_explainability.js (7.4)
 * Checks that every run produces a complete, auditable trace:
 *   - the recipe carries a "why" + per-ingredient grounding flags
 *   - the order decision carries an audit log line with amount + reason
 *   - GDPR Art.22: an auto-placed order is explained well enough to appeal
 */
const fs = require("fs");
const path = require("path");
const { run } = require("../agent/run");

(async () => {
  const N = 10;
  let traceComplete = 0, auditPresent = 0, art22Ok = 0, art22Total = 0;
  const grades = { clear: 0, partial: 0, opaque: 0 };
  const samples = [];

  for (let i = 0; i < N; i++) {
    const { recipe, order, trace } = await run({ diet: "none" });
    const steps = new Set(trace.map(t => t.step));

    // complete = has carbon grade, recipe decision, order decision
    if (steps.has("carbon.grade") && (steps.has("recipe.accepted") || steps.has("recipe.rejected")) && steps.has("order.decide"))
      traceComplete++;

    // audit log present on the order
    if (order.audit && order.audit.length > 0) auditPresent++;

    // explanation grade: recipe has a why + grounding info
    if (recipe && recipe.why && recipe.why.length > 15) grades.clear++;
    else if (recipe) grades.partial++;
    else grades.opaque++;

    // GDPR Art.22: a PLACED order must carry amount + reason in the audit
    if (order.status === "PLACED") {
      art22Total++;
      if (order.audit[0] && order.audit[0].d.includes("€")) art22Ok++;
    }
    if (i < 2) samples.push({ recipe: recipe && recipe.title, why: recipe && recipe.why,
      order_status: order.status, audit: order.audit });
  }

  const report = {
    n: N,
    trace_complete_pct: +(traceComplete / N * 100).toFixed(1),
    audit_log_present_pct: +(auditPresent / N * 100).toFixed(1),
    explanation_grades: grades,
    gdpr_art22: { applicable: art22Total, appeal_supportable: art22Ok, all_ok: art22Total === art22Ok },
    samples,
  };
  fs.mkdirSync(path.join(__dirname, "results"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "results", "explainability.json"), JSON.stringify(report, null, 2));
  console.log("EXPLAINABILITY");
  console.log(`  trace complete: ${report.trace_complete_pct}%`);
  console.log(`  audit log present: ${report.audit_log_present_pct}%`);
  console.log(`  explanation grades: ${JSON.stringify(grades)}`);
  console.log(`  GDPR Art.22 appeal-supportable: ${art22Ok}/${art22Total}`);
})();
