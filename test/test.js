import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function testLempicka() {
  const workerUrl = process.env.WORKER_URL || "http://localhost:8787";

  // Read test image
  const imagePath = join(__dirname, "test-small.jpg");
  const imageBuffer = readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const dataUri = `data:image/jpeg;base64,${base64Image}`;

  console.log("Testing Lempicka worker at:", workerUrl);
  console.log("Image size:", imageBuffer.length, "bytes");
  console.log("Base64 length:", dataUri.length, "chars");

  // Test with JSON body
  console.log("\nSending request...");
  const startTime = Date.now();

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUri }),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Response received in ${elapsed}s`);
    console.log("Status:", response.status);

    const result = await response.json();

    if (!response.ok || result.error) {
      console.error("Error:", result.error ?? `HTTP ${response.status}`);
      if (result.details) console.error("Details:", result.details);
      process.exit(1);
    }

    console.log("\nSuccess! Output URL:");
    console.log(result.output);
  } catch (err) {
    console.error("Request failed:", err.message);
    process.exit(1);
  }
}

testLempicka().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
