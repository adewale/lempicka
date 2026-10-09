import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { LEMPICKA_PROMPT, NANO_BANANA_VERSION } from "../src/prompt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Baseline: the prompt the Worker ships (src/prompt.js), not a copy of it.
// When this experiment first ran, production was v2 in PROMPT_CHANGELOG.md,
// which added red lipstick to men.
const PRODUCTION_PROMPT = LEMPICKA_PROMPT;

// Gender-aware prompt v1
const GENDER_AWARE_V1 = `Paint this person as a Tamara de Lempicka portrait commission, 1929.

PRESERVE the subject's face exactly - their bone structure, features, gender, ethnicity, and likeness must remain recognizable.

APPLY Lempicka's style:
- Smooth, polished skin like glazed porcelain with imperceptible brushstrokes
- Dramatic chiaroscuro: single light source from upper left, sculptural shadows
- Soft Cubist simplification of forms without distorting identity
- Art Deco geometric background in muted grays and greens

COLOR TREATMENT based on subject:
- For women: vermillion red lips as focal point, red nail polish if hands visible
- For men: natural flesh-toned lips (muted pink/brown), NO red lipstick, NO nail polish
- Male subjects should convey elegance through pose and attire, not cosmetic color

Oil painting technique. The subject should look like themselves painted by Lempicka.`;

// Gender-aware prompt v2 (more explicit)
const GENDER_AWARE_V2 = `Tamara de Lempicka oil portrait commission, 1929.

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

// Gender-aware prompt v3 (simplified)
const GENDER_AWARE_V3 = `Paint this person in Tamara de Lempicka's 1929 portrait style.

Keep their exact likeness, gender, and ethnicity intact.

Apply Lempicka's technique:
- Luminous polished skin, dramatic shadows from upper left
- Soft Cubist forms, Art Deco background
- For women: red vermillion lips as focal point
- For men: natural lip color (NO red lipstick - Lempicka never painted men with red lips)

Oil painting, elegant and glamorous while preserving identity.`;

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

  const imagePath = join(__dirname, "test-small.jpg");
  const imageBuffer = readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const dataUri = `data:image/jpeg;base64,${base64Image}`;

  console.log("=== GENDER-AWARE PROMPT TEST ===");
  console.log("Testing male subject - should NOT have red lipstick\n");

  const results = {};

  results.production = await callReplicate(PRODUCTION_PROMPT, dataUri, "PRODUCTION (src/prompt.js)");
  console.log("Result:", results.production);

  results.v1 = await callReplicate(GENDER_AWARE_V1, dataUri, "GENDER-AWARE V1");
  console.log("Result:", results.v1);

  results.v2 = await callReplicate(GENDER_AWARE_V2, dataUri, "GENDER-AWARE V2");
  console.log("Result:", results.v2);

  results.v3 = await callReplicate(GENDER_AWARE_V3, dataUri, "GENDER-AWARE V3 (simplified)");
  console.log("Result:", results.v3);

  console.log("\n=== RESULTS SUMMARY ===");
  console.log("\nProduction:", results.production);
  console.log("\nGender-aware V1:", results.v1);
  console.log("\nGender-aware V2:", results.v2);
  console.log("\nGender-aware V3:", results.v3);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
