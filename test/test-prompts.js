import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

async function testPrompt(prompt, dataUri, workerUrl) {
  console.log(`\n=== Testing ${prompt.name} ===`);
  console.log(`Prompt: ${prompt.text.substring(0, 80)}...`);

  const startTime = Date.now();

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUri, prompt: prompt.text }),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Response received in ${elapsed}s`);

    const result = await response.json();

    if (result.error) {
      console.error("Error:", result.error);
      if (result.details) console.error("Details:", result.details);
      return { name: prompt.name, error: result.error, details: result.details };
    }

    console.log("Success! Output URL:", result.output);
    return { name: prompt.name, output: result.output, elapsed };
  } catch (err) {
    console.error("Request failed:", err.message);
    return { name: prompt.name, error: err.message };
  }
}

async function runTests() {
  const workerUrl = process.env.WORKER_URL || "http://localhost:8787";

  // Read test image
  const imagePath = join(__dirname, "test-small.jpg");
  const imageBuffer = readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const dataUri = `data:image/jpeg;base64,${base64Image}`;

  console.log("Testing prompts at:", workerUrl);
  console.log("Image size:", imageBuffer.length, "bytes");

  const results = [];

  for (const prompt of prompts) {
    const result = await testPrompt(prompt, dataUri, workerUrl);
    results.push(result);
    // Wait a bit between requests
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("\n\n=== SUMMARY ===");
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
