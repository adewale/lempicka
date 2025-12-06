import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const NANO_BANANA_VERSION = "d05a591283da31be3eea28d5634ef9e26989b351718b6489bd308426ebd0a3e8";

// Historical context: Lempicka deliberately removed glasses from subjects
// (e.g., André Gide was painted "unfettered by glasses" despite wearing them IRL)
// We're overriding this to preserve modern identity markers.

// Current production prompt (likely removes glasses per Lempicka's actual practice)
const CURRENT_PROMPT = `Tamara de Lempicka oil portrait commission, 1929.

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

// Variant A: Simple addition to identity section
const GLASSES_V1 = `Tamara de Lempicka oil portrait commission, 1929.

CRITICAL - PRESERVE IDENTITY: Keep the subject's exact face, bone structure, gender, ethnicity, features, and EYEWEAR. If wearing glasses, keep their exact frame shape and style - glasses are part of their identity. They must be recognizable.

LEMPICKA STYLE ELEMENTS:
- Polished, luminous skin with smooth gradients
- Strong directional lighting from upper left creating sculptural shadows
- Art Deco architectural background in cool grays
- Soft Cubist geometry in forms

GENDER-SPECIFIC COLOR (as Lempicka did):
- FEMALE subjects: Apply signature vermillion red lips, red nails - these are compositional focal points
- MALE subjects: Render lips in NATURAL flesh tones only (muted browns/pinks matching skin). Lempicka did NOT use red lips on men (see Portrait of Dr. Boucard, Marquis d'Afflito). Male elegance comes from pose and attire, not cosmetics.

This is a portrait of THIS specific person in Lempicka's style.`;

// Variant B: Dedicated eyewear section with explicit override
const GLASSES_V2 = `Tamara de Lempicka oil portrait commission, 1929.

CRITICAL - PRESERVE IDENTITY: Keep the subject's exact face, bone structure, gender, ethnicity, and features. They must be recognizable.

MODERN ADAPTATION - EYEWEAR: Unlike historical Lempicka (who removed glasses from subjects like André Gide), PRESERVE the subject's glasses if present. Keep their exact frame shape, style, and proportions - do NOT remove or redesign them. Glasses are a key part of modern identity.

LEMPICKA STYLE ELEMENTS:
- Polished, luminous skin with smooth gradients
- Strong directional lighting from upper left creating sculptural shadows
- Art Deco architectural background in cool grays
- Soft Cubist geometry in forms

GENDER-SPECIFIC COLOR (as Lempicka did):
- FEMALE subjects: Apply signature vermillion red lips, red nails - these are compositional focal points
- MALE subjects: Render lips in NATURAL flesh tones only (muted browns/pinks matching skin). Lempicka did NOT use red lips on men (see Portrait of Dr. Boucard, Marquis d'Afflito). Male elegance comes from pose and attire, not cosmetics.

This is a portrait of THIS specific person in Lempicka's style.`;

// Variant C: Strongest language with explicit DO NOT REMOVE
const GLASSES_V3 = `Tamara de Lempicka oil portrait commission, 1929.

CRITICAL - PRESERVE IDENTITY INCLUDING GLASSES: Keep the subject's exact face, bone structure, gender, ethnicity, and features. If wearing glasses, DO NOT REMOVE THEM - preserve their exact frame shape and style as a key identity marker. They must be recognizable as themselves.

LEMPICKA STYLE ELEMENTS:
- Polished, luminous skin with smooth gradients
- Strong directional lighting from upper left creating sculptural shadows
- Art Deco architectural background in cool grays
- Soft Cubist geometry in forms

GENDER-SPECIFIC COLOR (as Lempicka did):
- FEMALE subjects: Apply signature vermillion red lips, red nails - these are compositional focal points
- MALE subjects: Render lips in NATURAL flesh tones only (muted browns/pinks matching skin). Lempicka did NOT use red lips on men (see Portrait of Dr. Boucard, Marquis d'Afflito). Male elegance comes from pose and attire, not cosmetics.

GLASSES OVERRIDE: Preserve eyewear exactly as worn - same frame shape, style, and position. Do not convert to vintage frames or remove.

This is a portrait of THIS specific person in Lempicka's style.`;

// Variant D: Concise but firm
const GLASSES_V4 = `Tamara de Lempicka oil portrait commission, 1929.

CRITICAL - PRESERVE IDENTITY: Keep the subject's exact face, bone structure, gender, ethnicity, features, and glasses (if worn). NEVER remove glasses - they define the person. Keep their exact frame shape and style.

LEMPICKA STYLE ELEMENTS:
- Polished, luminous skin with smooth gradients
- Strong directional lighting from upper left creating sculptural shadows
- Art Deco architectural background in cool grays
- Soft Cubist geometry in forms

GENDER-SPECIFIC COLOR (as Lempicka did):
- FEMALE subjects: Apply signature vermillion red lips, red nails - these are compositional focal points
- MALE subjects: Render lips in NATURAL flesh tones only (muted browns/pinks matching skin). Lempicka did NOT use red lips on men (see Portrait of Dr. Boucard, Marquis d'Afflito). Male elegance comes from pose and attire, not cosmetics.

This is a portrait of THIS specific person in Lempicka's style.`;

const PROMPTS = [
  { name: "CURRENT (may remove glasses)", prompt: CURRENT_PROMPT },
  { name: "V1 - Simple addition", prompt: GLASSES_V1 },
  { name: "V2 - Historical override", prompt: GLASSES_V2 },
  { name: "V3 - Strongest + dedicated section", prompt: GLASSES_V3 },
  { name: "V4 - Concise but firm", prompt: GLASSES_V4 },
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

  // Check for custom test image or use default
  const testImageArg = process.argv[2];
  const imagePath = testImageArg || join(__dirname, "test-glasses.jpg");

  let imageBuffer;
  try {
    imageBuffer = readFileSync(imagePath);
  } catch (err) {
    console.error(`\nError: Could not read test image at ${imagePath}`);
    console.error("\nTo run this test, provide an image of someone wearing glasses:");
    console.error("  node test/test-glasses-prompt.js /path/to/glasses-photo.jpg");
    console.error("\nOr save a test image as test/test-glasses.jpg");
    process.exit(1);
  }

  const base64Image = imageBuffer.toString("base64");
  const dataUri = `data:image/jpeg;base64,${base64Image}`;

  console.log("=== GLASSES PRESERVATION TEST ===");
  console.log(`Image: ${imagePath} (${imageBuffer.length} bytes)`);
  console.log("\nHistorical context: Lempicka removed glasses from subjects");
  console.log("(e.g., André Gide painted 'unfettered by glasses')");
  console.log("Goal: Override this to preserve glasses as modern identity markers\n");

  const results = {};

  for (const { name, prompt } of PROMPTS) {
    try {
      results[name] = await callReplicate(prompt, dataUri, name);
      console.log("Result:", results[name]);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      results[name] = `ERROR: ${err.message}`;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("RESULTS SUMMARY");
  console.log("=".repeat(60));
  console.log("\nCompare these outputs to see which preserves glasses best:\n");

  for (const [name, url] of Object.entries(results)) {
    console.log(`${name}:`);
    console.log(`  ${url}\n`);
  }

  console.log("\nEvaluation criteria:");
  console.log("  1. Are glasses preserved? (pass/fail)");
  console.log("  2. Is frame shape/style maintained? (critical)");
  console.log("  3. Is Lempicka style still applied? (check skin, lighting, etc.)");
  console.log("  4. Overall identity preservation");
}

main().catch(console.error);
