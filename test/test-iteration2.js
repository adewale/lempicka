import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { NANO_BANANA_VERSION } from "../src/prompt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

if (!REPLICATE_API_TOKEN) {
  console.error("REPLICATE_API_TOKEN is required. Load .env with `node --env-file=.env <script>` or export it in your shell.");
  process.exit(1);
}

// Refined prompts based on first iteration results
const prompts = [
  {
    name: "Iteration 2A - Combined Best Elements",
    text: "Tamara de Lempicka Art Deco portrait. Polished marble skin with cool violet-blue shadows, not plastic. Sculptural lacquered hair in organized waves. Hard dramatic lighting 45 degrees upper left. Geometric architectural background. Emerald green, cobalt blue, burgundy, ivory palette. Monumental low-angle composition. Confident direct gaze. Smooth tonal gradients."
  },
  {
    name: "Iteration 2B - Emphasizing Sculptural Quality",
    text: "Art Deco portrait, Tamara de Lempicka style. Skin like polished Carrara marble - cool, smooth, idealized with violet shadows. Hair in heavy sculptural waves like lacquered metal. Single hard light source upper left. Geometric Art Deco background with architectural forms. Colors: viridian, cobalt, burgundy, ivory. Low angle creates monumentality. Powerful confident expression."
  },
  {
    name: "Iteration 2C - Maximum Concision",
    text: "Tamara de Lempicka Art Deco. Marble skin, violet shadows. Sculptural lacquered hair. Hard dramatic lighting. Geometric architectural background. Emerald, cobalt, burgundy, ivory. Monumental. Confident gaze."
  }
];

async function createPrediction(imageBase64, prompt) {
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate API error: ${error}`);
  }

  return await response.json();
}

async function pollPrediction(predictionUrl) {
  while (true) {
    const response = await fetch(predictionUrl, {
      headers: { "Authorization": `Bearer ${REPLICATE_API_TOKEN}` },
    });
    const result = await response.json();

    if (result.status === "succeeded") {
      return result;
    }
    if (result.status === "failed") {
      throw new Error(`Generation failed: ${result.error}`);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function testPrompt(prompt, dataUri) {
  console.log(`\n=== Testing ${prompt.name} ===`);
  console.log(`Prompt: ${prompt.text}`);

  const startTime = Date.now();

  try {
    const prediction = await createPrediction(dataUri, prompt.text);
    console.log("Prediction created, polling...");

    const result = await pollPrediction(prediction.urls.get);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`Success! Time: ${elapsed}s`);
    console.log("Output URL:", result.output);
    return { name: prompt.name, output: result.output, elapsed, prompt: prompt.text };
  } catch (err) {
    console.error("Error:", err.message);
    return { name: prompt.name, error: err.message };
  }
}

async function runTests() {
  // Read test image
  const imagePath = join(__dirname, "test-small.jpg");
  const imageBuffer = readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const dataUri = `data:image/jpeg;base64,${base64Image}`;

  console.log("Testing iteration 2 prompts directly via Replicate API");
  console.log("Image size:", imageBuffer.length, "bytes");

  const results = [];

  for (const prompt of prompts) {
    const result = await testPrompt(prompt, dataUri);
    results.push(result);
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("\n\n========== ITERATION 2 SUMMARY ==========");
  for (const r of results) {
    console.log(`\n${r.name}:`);
    if (r.output) {
      console.log(`  Output: ${r.output}`);
      console.log(`  Time: ${r.elapsed}s`);
    } else {
      console.log(`  Error: ${r.error}`);
    }
  }

  const failures = results.filter((r) => r.error).length;
  if (failures > 0) {
    console.error(`\n${failures} of ${results.length} prompts failed.`);
    process.exitCode = 1;
  }
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
