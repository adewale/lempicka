import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const NANO_BANANA_VERSION = "d05a591283da31be3eea28d5634ef9e26989b351718b6489bd308426ebd0a3e8";
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

if (!REPLICATE_API_TOKEN) {
  console.error("REPLICATE_API_TOKEN is required. Load .env with `node --env-file=.env <script>` or export it in your shell.");
  process.exit(1);
}

const prompts = [
  {
    name: "Prompt 1 - Marble & Hollywood Lighting",
    text: "Transform into Tamara de Lempicka Art Deco portrait style. Skin like polished Carrara marble with violet-blue shadows and cool pink highlights. Hard-edged dramatic lighting from upper left 45 degrees like 1930s Hollywood. Sculptural hair in heavy organized waves. Sharp angular cheekbones, arched brows, bow lips. Geometric cylindrical forms for body. Rich emerald greens, cobalt blues, burgundy, ivory background. Low angle monumentality. Confident powerful gaze."
  },
  {
    name: "Prompt 2 - Geometric Construction Focus",
    text: "Art Deco portrait in Tamara de Lempicka style. Geometric figure construction - arms as cylinders, angular planes meeting sensual curves. Flesh tones: pale ochre base with rose madder undertones, raw umber and violet shadows. Lacquered sculptural hair waves. Color palette: viridian green, cerulean blue, cadmium vermillion accents. Strong single light source, hard shadows. Simplified geometric background with subtle gradation. Subject projects power and confidence."
  },
  {
    name: "Prompt 3 - Concise Direct",
    text: "Tamara de Lempicka Art Deco portrait. Polished stone skin not plastic. Sculptural waves of hair. Geometric forms and angular planes. Hard dramatic lighting 45 degrees upper left. Violet shadows on cool marble flesh. Emerald, cobalt, burgundy, ivory palette. Monumental low-angle view. Confident direct gaze. Smooth tonal gradients not posterized."
  },
  {
    name: "Prompt 4 - Technical Painting",
    text: "Paint in Tamara de Lempicka style. Skin appears as polished Carrara marble - smooth, cool, idealized. Single hard light source upper left creating dramatic shadows. Sculptural hair organized in heavy lacquered waves. Geometric construction: cylindrical forms, angular cheekbones, tilted almond eyes, bow lips. Color: emerald green, cobalt blue, vermillion red, silver-gray, ivory. Background: simplified geometric shapes. Monumentality through low angle. Powerful confident expression."
  },
  {
    name: "Prompt 5 - Minimal Keywords",
    text: "Tamara de Lempicka Art Deco portrait style. Polished marble skin with violet shadows. Hard 1930s Hollywood lighting. Geometric sculptural forms. Lacquered hair waves. Emerald, cobalt, burgundy palette. Monumental confident pose. Smooth tonal transitions."
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
  console.log(`Prompt: ${prompt.text.substring(0, 80)}...`);

  const startTime = Date.now();

  try {
    const prediction = await createPrediction(dataUri, prompt.text);
    console.log("Prediction created, polling...");

    const result = await pollPrediction(prediction.urls.get);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`Success! Time: ${elapsed}s`);
    console.log("Output URL:", result.output);
    return { name: prompt.name, output: result.output, elapsed };
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

  console.log("Testing prompts directly via Replicate API");
  console.log("Image size:", imageBuffer.length, "bytes");

  const results = [];

  for (const prompt of prompts) {
    const result = await testPrompt(prompt, dataUri);
    results.push(result);
    // Wait a bit between requests
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("\n\n========== SUMMARY ==========");
  for (const r of results) {
    console.log(`\n${r.name}:`);
    if (r.output) {
      console.log(`  Output: ${r.output}`);
      console.log(`  Time: ${r.elapsed}s`);
    } else {
      console.log(`  Error: ${r.error}`);
    }
  }
}

runTests();
