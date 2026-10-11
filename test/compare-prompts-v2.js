import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { LEMPICKA_PROMPT, NANO_BANANA_VERSION } from "../src/prompt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Baseline: the prompt the Worker ships (src/prompt.js), not a copy of it.
// When this experiment first ran, production was the pre-v2 prompt recorded in
// PROMPT_CHANGELOG.md.
const PRODUCTION_PROMPT = LEMPICKA_PROMPT;

// New balanced prompt - preserves identity while applying style
const BALANCED_PROMPT = `Paint this person as a Tamara de Lempicka portrait, 1929.

PRESERVE the subject's face exactly - their bone structure, features, gender, ethnicity, and likeness must remain recognizable. This is a commissioned portrait of THIS specific person.

APPLY Lempicka's style to the surface and lighting:
- Smooth, polished skin like glazed porcelain with imperceptible brushstrokes
- Dramatic chiaroscuro: single light source from upper left, sculptural shadows
- Her color palette: warm flesh tones, cool gray shadows, accent red on lips only
- Soft Cubist simplification of forms without distorting identity
- Art Deco geometric background in muted grays and greens

The subject should look like themselves painted by Lempicka - elevated, glamorous, idealized, but unmistakably the same person. Oil painting technique.`;

// Alternative - even more explicit about preservation
const PRESERVATION_PROMPT = `Transform into a Tamara de Lempicka oil portrait while keeping the subject's exact likeness.

CRITICAL: Preserve the person's facial features, ethnicity, gender, and identity completely intact. They must be recognizable as themselves.

Apply ONLY these Lempicka stylistic elements:
- Polished, luminous skin with smooth gradients and no visible pores
- Strong directional lighting creating dramatic shadows (chiaroscuro)
- Limited palette: warm ochre flesh, cool violet-gray shadows, vermillion red lips
- Simplified geometric forms in clothing and background only
- Art Deco architectural background elements
- Luxurious, glossy finish like enamel

The result should look like Lempicka painted a portrait commission of this exact person.`;

async function callReplicate(prompt, imageBase64, label) {
  console.log(`\n--- ${label} ---`);
  console.log(`Prompt: "${prompt.substring(0, 60)}..."`);

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

  const imagePath = join(__dirname, "test-small.jpg");
  const imageBuffer = readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const dataUri = `data:image/jpeg;base64,${base64Image}`;

  console.log("=== LEMPICKA PROMPT COMPARISON V2 ===");
  console.log("Goal: Preserve identity while applying Lempicka style\n");

  const results = {};

  // Test current prompt
  results.production = await callReplicate(PRODUCTION_PROMPT, dataUri, "PRODUCTION (src/prompt.js)");
  console.log("Result:", results.production);

  // Test balanced prompt
  results.balanced = await callReplicate(BALANCED_PROMPT, dataUri, "BALANCED (preserves identity)");
  console.log("Result:", results.balanced);

  // Test preservation prompt
  results.preservation = await callReplicate(PRESERVATION_PROMPT, dataUri, "PRESERVATION FOCUS");
  console.log("Result:", results.preservation);

  console.log("\n=== RESULTS SUMMARY ===");
  console.log("\nProduction prompt:");
  console.log(results.production);
  console.log("\nBalanced prompt:");
  console.log(results.balanced);
  console.log("\nPreservation focus prompt:");
  console.log(results.preservation);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
