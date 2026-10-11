import HTML from "./index.html";
import { LEMPICKA_PROMPT, NANO_BANANA_VERSION } from "./prompt.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve frontend
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "")) {
      return new Response(HTML, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Transform endpoint
    if (request.method === "POST" && (url.pathname === "/" || url.pathname === "/transform")) {
      return handleTransform(request, env);
    }

    // Health check endpoint
    if (request.method === "GET" && url.pathname === "/health") {
      return handleHealthCheck(env);
    }

    // Gallery feed endpoint
    if (request.method === "GET" && url.pathname === "/feed") {
      return handleFeed(env);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};

async function handleTransform(request, env) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let imageBase64;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("image");
      if (!file) {
        return new Response(JSON.stringify({ error: "No image provided" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const mimeType = file.type || "image/jpeg";
      imageBase64 = `data:${mimeType};base64,${base64}`;
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      if (!body.image) {
        return new Response(JSON.stringify({ error: "No image provided" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      imageBase64 = body.image;
    } else {
      return new Response(JSON.stringify({ error: "Unsupported content type" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Create prediction on Replicate
    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: NANO_BANANA_VERSION,
        input: {
          prompt: LEMPICKA_PROMPT,
          image_input: [imageBase64],
          aspect_ratio: "match_input_image",
          output_format: "jpg",
        },
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      return new Response(JSON.stringify({ error: "Replicate API error", details: error }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const prediction = await createResponse.json();

    // Poll for completion
    let result = prediction;
    while (result.status !== "succeeded" && result.status !== "failed") {
      await new Promise((r) => setTimeout(r, 1000));
      const pollResponse = await fetch(result.urls.get, {
        headers: { Authorization: `Bearer ${env.REPLICATE_API_TOKEN}` },
      });
      result = await pollResponse.json();
    }

    if (result.status === "failed") {
      return new Response(JSON.stringify({ error: "Generation failed", details: result.error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Save to gallery feed
    if (env.GALLERY) {
      try {
        const entry = {
          output: result.output,
          timestamp: Date.now(),
        };
        // Get existing feed
        const feedData = await env.GALLERY.get("feed", { type: "json" });
        const feed = feedData || [];
        // Add new entry at the beginning, keep only 10
        feed.unshift(entry);
        if (feed.length > 10) feed.length = 10;
        await env.GALLERY.put("feed", JSON.stringify(feed));
      } catch {
        // Ignore gallery errors, don't fail the transform
      }
    }

    return new Response(JSON.stringify({ output: result.output }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleHealthCheck(env) {
  const checks = {
    worker: true,
    replicate: false,
  };

  // Check Replicate API connection
  if (env.REPLICATE_API_TOKEN) {
    try {
      const response = await fetch("https://api.replicate.com/v1/account", {
        headers: { Authorization: `Bearer ${env.REPLICATE_API_TOKEN}` },
      });
      checks.replicate = response.ok;
    } catch {
      checks.replicate = false;
    }
  }

  const allOk = checks.worker && checks.replicate;

  return new Response(JSON.stringify({ ok: allOk, checks }), {
    status: allOk ? 200 : 503,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleFeed(env) {
  try {
    const feed = await env.GALLERY.get("feed", { type: "json" }) || [];

    // Filter out expired images (Replicate URLs expire after 1 hour)
    const FIFTY_FIVE_MINUTES = 55 * 60 * 1000;
    const now = Date.now();
    const validFeed = feed.filter(item => (now - item.timestamp) < FIFTY_FIVE_MINUTES);

    return new Response(JSON.stringify({ images: validFeed }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response(JSON.stringify({ images: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
