import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { NANO_BANANA_VERSION } from "../src/prompt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Goal: ONLY add glasses preservation, keep all other behavior the same
// (formal portrait transformation, suit, etc.)
//
// This is a closed experiment: every variant is an edit to prompt v3, and
// variant A shipped as v4 (PROMPT_CHANGELOG.md). The baseline is therefore a
// frozen copy of v3, not the shipped prompt; for comparisons against the
// shipped prompt, import LEMPICKA_PROMPT from src/prompt.js as the other
// experiment scripts do.
const PROMPT_V3 = `Tamara de Lempicka oil portrait commission, 1929.

CRITICAL - PRESERVE IDENTITY: Keep the subject's exact face, bone structure, gender, ethnicity, and features. They must be recognizable.

LEMPICKA STYLE ELEMENTS:
- Polished, luminous skin with smooth gradients
- Strong directional lighting from upper left creating sculptural shadows
- Art Deco architectural background in cool grays
- Soft Cubist geometry in forms

GENDER-SPECIFIC COLOR (as Lempicka did):
- FEMALE subjects: Apply signature vermillion red lips, red nails - these are compositional focal points
- MALE subjects: Render lips in NATURAL flesh tones only (muted browns/pinks matching skin). Lempicka did NOT use red lips on men (see Portrait of Dr. Boucard, Marquis d'Afflito). Male elegance comes from pose and attire, not cosmetics.

This is a portrait of THIS specific person in Lempicka's style.`;

// String.prototype.replace returns its input unchanged when the anchor is
// missing, which would silently rerun the baseline under a variant's name.
function edit(prompt, anchor, replacement) {
  if (!prompt.includes(anchor)) {
    throw new Error(`Variant anchor not found in baseline prompt: ${JSON.stringify(anchor)}`);
  }
  return prompt.replace(anchor, replacement);
}

// Variant A: Minimal - just add "and glasses" to identity line
const MINIMAL_A = edit(PROMPT_V3,
  "ethnicity, and features",
  "ethnicity, features, and glasses (if worn)"
);

// Variant B: Add glasses to identity + brief note
const MINIMAL_B = edit(PROMPT_V3,
  "They must be recognizable.",
  "They must be recognizable. If wearing glasses, preserve them with their exact frame shape."
);

// Variant C: Single line addition at end of identity section
const MINIMAL_C = edit(PROMPT_V3,
  "LEMPICKA STYLE ELEMENTS:",
  "EYEWEAR: If subject wears glasses, keep them - same frame shape and style.\n\nLEMPICKA STYLE ELEMENTS:"
);

// Variant D: Inline in identity, very brief
const MINIMAL_D = edit(PROMPT_V3,
  "Keep the subject's exact face, bone structure, gender, ethnicity, and features.",
  "Keep the subject's exact face, bone structure, gender, ethnicity, features, and eyewear."
);

// Variant E: Add to end, don't touch identity section
const MINIMAL_E = edit(PROMPT_V3,
  "This is a portrait of THIS specific person in Lempicka's style.",
  "If subject wears glasses, preserve them exactly (frame shape and style).\n\nThis is a portrait of THIS specific person in Lempicka's style."
);

const PROMPTS = [
  { name: "V3 (baseline)", prompt: PROMPT_V3 },
  { name: "A - 'and glasses (if worn)'", prompt: MINIMAL_A },
  { name: "B - 'preserve with exact frame shape'", prompt: MINIMAL_B },
  { name: "C - Separate EYEWEAR line", prompt: MINIMAL_C },
  { name: "D - 'and eyewear' inline", prompt: MINIMAL_D },
  { name: "E - Note at end", prompt: MINIMAL_E },
];

async function callReplicate(prompt, imageBase64, label) {
  console.log(`\n--- ${label} ---`);

  const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: NANO_BANANA_VERSION,
      input: {
        prompt: prompt,
        image_input: [imageBase64],
        aspect_ratio: "match_input_image",
        output_format: "jpg",
      },
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Replicate API error: ${error}`);
  }

  const prediction = await createResponse.json();
  let result = prediction;

  process.stdout.write("Waiting");
  while (result.status !== "succeeded" && result.status !== "failed") {
    await new Promise((r) => setTimeout(r, 2000));
    process.stdout.write(".");
    const pollResponse = await fetch(result.urls.get, {
      headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
    });
    result = await pollResponse.json();
  }
  console.log(" done!");

  if (result.status === "failed") {
    throw new Error(`Generation failed: ${result.error}`);
  }

  return result.output;
}

async function main() {
  if (!REPLICATE_API_TOKEN) {
    console.error("Please set REPLICATE_API_TOKEN");
    process.exit(1);
  }

  const testImageArg = process.argv[2];
  const imagePath = testImageArg || join(__dirname, "test-glasses.jpg");

  let imageBuffer;
  try {
    imageBuffer = readFileSync(imagePath);
  } catch (err) {
    console.error(`\nError: Could not read test image at ${imagePath}`);
    process.exit(1);
  }

  const base64Image = imageBuffer.toString("base64");
  const dataUri = `data:image/jpeg;base64,${base64Image}`;

  console.log("=== GLASSES PRESERVATION TEST V2 (Minimal Changes) ===");
  console.log(`Image: ${imagePath}`);
  console.log("\nGoal: ONLY preserve glasses, keep formal portrait behavior\n");

  const results = {};

  let failures = 0;

  for (const { name, prompt } of PROMPTS) {
    try {
      results[name] = await callReplicate(prompt, dataUri, name);
      console.log("Result:", results[name]);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      results[name] = `ERROR: ${err.message}`;
      failures++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("RESULTS SUMMARY");
  console.log("=".repeat(60));

  for (const [name, url] of Object.entries(results)) {
    console.log(`\n${name}:`);
    console.log(`  ${url}`);
  }

  console.log("\n\nEvaluation: All should look like formal Lempicka portraits");
  console.log("(suit, Art Deco background) but WITH glasses preserved.");

  if (failures > 0) {
    console.error(`\n${failures} of ${PROMPTS.length} prompts failed.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
