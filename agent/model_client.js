/*
 * agent/model_client.js
 *
 * Mirrors the app's callClaude (app/compagnon.html line 130): same endpoint,
 * same model (claude-sonnet-4-6), same bring-your-own-key behaviour. Adds an
 * offline MOCK path so the tests run with no key (the app shows a clear message
 * and falls back to its offline recipe in the same situation).
 */
const MODEL = "claude-sonnet-4-6";
const TOKEN_LOG = [];

// Minimal .env loader (no dependency): reads KEY=value lines if .env exists.
(function loadEnv() {
  try {
    const fs = require("fs");
    const path = require("path");
    const envPath = path.join(__dirname, "..", ".env");
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
        if (m && !line.trim().startsWith("#") && !process.env[m[1]]) {
          process.env[m[1]] = m[2].trim();
        }
      }
    }
  } catch (e) { /* ignore */ }
})();

// The placeholder from .env.example is NOT a real key — treat it as unset.
const PLACEHOLDER = "insert-api-key-here";
function hasRealKey() {
  const k = process.env.ANTHROPIC_API_KEY;
  return !!k && k !== PLACEHOLDER && k.length > 10;
}

function mockEnabled() {
  return process.env.AGENT_MOCK === "1" || !hasRealKey();
}

function approxTokens(s) { return Math.max(1, Math.ceil(s.length / 4)); }

async function callClaude(body) {
  const sys = body.system || "";
  const user = JSON.stringify(body.messages || "");

  if (mockEnabled()) {
    const text = mockRecipeJSON();
    TOKEN_LOG.push({ model: body.model || MODEL, mode: "mock",
      input_tokens: approxTokens(sys + user), output_tokens: approxTokens(text) });
    return { content: [{ type: "text", text }] };
  }

  // REAL path — identical headers to the app
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  };
  const r = await fetch("https://api.anthropic.com/v1/messages",
    { method: "POST", headers, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok || data.type === "error")
    throw new Error((data.error && data.error.message) || ("HTTP " + r.status));
  const u = data.usage || {};
  TOKEN_LOG.push({ model: body.model || MODEL, mode: "real",
    input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0 });
  return data;
}

// Deterministic recipe used in mock mode — passes schema + grounding + dietary checks.
function mockRecipeJSON() {
  return JSON.stringify({
    title: "Spinach & egg frittata",
    why: "Uses the eggs and spinach closest to expiry.",
    servings: 2, time_min: 22,
    ingredients: [
      { name: "Eggs", amount: "6", fromFridge: true },
      { name: "Baby spinach", amount: "1 handful", fromFridge: true },
      { name: "Olive oil", amount: "1 tbsp", fromFridge: false },
      { name: "Salt & pepper", amount: "to taste", fromFridge: false },
    ],
    steps: ["Soften the spinach in an oiled oven-proof pan.",
            "Whisk the eggs with salt and pepper.",
            "Pour over the spinach and cook 3 minutes.",
            "Finish under the grill 6 minutes until set."],
    macros: { kcal: 300, protein_g: 21, carbs_g: 7, fat_g: 20 },
    co2e_per_serving_kg: 0.6,
  });
}

module.exports = { MODEL, TOKEN_LOG, callClaude, mockEnabled };
