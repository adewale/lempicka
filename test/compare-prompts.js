import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const NANO_BANANA_VERSION = "d05a591283da31be3eea28d5634ef9e26989b351718b6489bd308426ebd0a3e8";

const ORIGINAL_PROMPT = `Transform this image into the artistic style of Tamara de Lempicka.
Apply her signature Art Deco aesthetic: bold geometric forms, smooth sculptural surfaces,
dramatic lighting with sharp contrasts, rich saturated colors especially deep greens and
warm flesh tones, and her distinctive way of making subjects appear like polished metal
or porcelain. Maintain the original composition but morph the forms into her cubist-influenced,
glamorous style.`;

const IMPROVED_PROMPT = `Portrait in the style of Tamara de Lempicka, 1929.

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

async function callReplicate(prompt, imageBase64) {
  console.log(`\nTesting prompt: "${prompt.substring(0, 50)}..."`);

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

  process.stdout.write("Waiting for result");
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
    console.error("Please set REPLICATE_API_TOKEN environment variable");
    console.error("Run: export REPLICATE_API_TOKEN=your_token_here");
    process.exit(1);
  }

  // Read test image
  const imagePath = join(__dirname, "test-small.jpg");
  const imageBuffer = readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const dataUri = `data:image/jpeg;base64,${base64Image}`;

  console.log("=== LEMPICKA PROMPT COMPARISON ===");
  console.log(`Image size: ${imageBuffer.length} bytes`);

  // Test original prompt
  console.log("\n--- ORIGINAL PROMPT ---");
  const originalResult = await callReplicate(ORIGINAL_PROMPT, dataUri);
  console.log("Original result:", originalResult);

  // Test improved prompt
  console.log("\n--- IMPROVED PROMPT ---");
  const improvedResult = await callReplicate(IMPROVED_PROMPT, dataUri);
  console.log("Improved result:", improvedResult);

  console.log("\n=== COMPARISON COMPLETE ===");
  console.log("\nOriginal prompt result:");
  console.log(originalResult);
  console.log("\nImproved prompt result:");
  console.log(improvedResult);
}

main().catch(console.error);
