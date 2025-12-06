import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const NANO_BANANA_VERSION = "d05a591283da31be3eea28d5634ef9e26989b351718b6489bd308426ebd0a3e8";

// Current deployed prompt (too aggressive, loses identity)
const CURRENT_PROMPT = `Portrait in the style of Tamara de Lempicka, 1929.

Render the subject with polished Carrara marble skin - smooth, cool, idealized with no visible pores.
Apply single dramatic light source from upper left at 45 degrees creating hard-edged shadows and
Hollywood glamour lighting. Skin has pale ochre base with rose madder undertones, shadows in
violet-blue tones.

Sculpt the figure with soft Cubist geometry: cylindrical arms, angular cheekbones and jaw meeting
sensual curves. Hair rendered as heavy sculptural waves with lacquered shine, not wispy.

Use her signature palette: emerald viridian green, cool silver-gray, ivory (not pure white),
cadmium vermillion red on lips only. Background is simplified Art Deco architecture in cool grays.

Low angle monumental composition - subject appears powerful, confident, 10 feet tall.
Direct challenging gaze. Elongated elegant fingers.

Oil painting technique with smooth continuous tonal transitions, never posterized.`;

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
  results.current = await callReplicate(CURRENT_PROMPT, dataUri, "CURRENT (loses identity)");
  console.log("Result:", results.current);

  // Test balanced prompt
  results.balanced = await callReplicate(BALANCED_PROMPT, dataUri, "BALANCED (preserves identity)");
  console.log("Result:", results.balanced);

  // Test preservation prompt
  results.preservation = await callReplicate(PRESERVATION_PROMPT, dataUri, "PRESERVATION FOCUS");
  console.log("Result:", results.preservation);

  console.log("\n=== RESULTS SUMMARY ===");
  console.log("\nCurrent prompt (loses identity):");
  console.log(results.current);
  console.log("\nBalanced prompt:");
  console.log(results.balanced);
  console.log("\nPreservation focus prompt:");
  console.log(results.preservation);
}

main().catch(console.error);
