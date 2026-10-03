// Hermetic Worker tests: src/index.js runs in workerd (via Miniflare) with a
// real local KV namespace. Only the network is replaced: every outbound fetch
// goes to `replicate` below, so no test calls Replicate or costs money.
// Run with `npm run test:worker`.
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";

const MINUTE = 60 * 1000;
const PREDICTIONS = "https://api.replicate.com/v1/predictions";
const POLL_URL = `${PREDICTIONS}/p-123`;

// Outbound handler for the current test, and every request the Worker made.
let replicate;
let calls;

// Replicate's prediction object, reduced to the fields the Worker reads
// (https://replicate.com/docs/reference/http#predictions.create).
const prediction = (fields) => Response.json({ id: "p-123", urls: { get: POLL_URL }, ...fields });

// Default upstream: create returns "starting", the first poll succeeds.
function succeedsAfterOnePoll(output) {
  return (request) =>
    request.url === PREDICTIONS
      ? prediction({ status: "starting" })
      : prediction({ status: "succeeded", output });
}

let mf;
let gallery;

before(async () => {
  mf = new Miniflare({
    scriptPath: "src/index.js",
    modules: true,
    modulesRules: [{ type: "Text", include: ["**/*.html"] }],
    compatibilityDate: "2024-12-01",
    kvNamespaces: ["GALLERY"],
    bindings: { REPLICATE_API_TOKEN: "test-token" },
    outboundService: async (request) => {
      const body = request.method === "POST" ? await request.clone().json() : undefined;
      calls.push({ url: request.url, auth: request.headers.get("authorization"), body });
      return replicate(request);
    },
  });
  gallery = await mf.getKVNamespace("GALLERY");
});

after(() => mf?.dispose());

beforeEach(async () => {
  calls = [];
  replicate = () => {
    throw new Error("unexpected outbound fetch");
  };
  await gallery.delete("feed");
});

const transform = (image) =>
  mf.dispatchFetch("http://localhost/transform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });

const feed = async () => (await (await mf.dispatchFetch("http://localhost/feed")).json()).images;

const seedFeed = (entries) => gallery.put("feed", JSON.stringify(entries));

// Miniflare's fetch does not serialize Node's FormData, so encode it here.
async function multipart(form) {
  const encoded = new Request("http://localhost/", { method: "POST", body: form });
  return { headers: encoded.headers, body: await encoded.arrayBuffer() };
}

describe("POST /transform", () => {
  test("sends the image to Replicate, polls to completion, and returns the output", async () => {
    replicate = succeedsAfterOnePoll("https://replicate.delivery/out.jpg");
    const image = "data:image/jpeg;base64,/9j/AAAA";

    const response = await transform(image);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.deepEqual(await response.json(), { output: "https://replicate.delivery/out.jpg" });

    assert.deepEqual(calls.map((c) => c.url), [PREDICTIONS, POLL_URL]);
    assert.ok(calls.every((c) => c.auth === "Bearer test-token"));
    assert.deepEqual(calls[0].body.input.image_input, [image]);
    assert.match(calls[0].body.version, /^[0-9a-f]{64}$/);
    assert.match(calls[0].body.input.prompt, /Lempicka/);
  });

  test("encodes a multipart upload as a data URI, byte for byte", async () => {
    replicate = succeedsAfterOnePoll("https://replicate.delivery/out.jpg");
    // Bytes above 0x7f catch encoders that treat the upload as text.
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x7f, 0x80, 0xc3, 0xff]);
    const form = new FormData();
    form.append("image", new Blob([bytes], { type: "image/png" }), "photo.png");

    const response = await mf.dispatchFetch("http://localhost/", {
      method: "POST",
      ...(await multipart(form)),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(calls[0].body.input.image_input, [
      `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`,
    ]);
  });

  test("records the result at the front of the gallery feed, keeping the newest 10", async () => {
    const now = Date.now();
    await seedFeed(Array.from({ length: 10 }, (_, i) => ({ output: `old-${i}`, timestamp: now - i * 1000 })));
    replicate = succeedsAfterOnePoll("new");

    assert.equal((await transform("data:image/jpeg;base64,AA")).status, 200);

    assert.deepEqual(
      (await feed()).map((e) => e.output),
      ["new", "old-0", "old-1", "old-2", "old-3", "old-4", "old-5", "old-6", "old-7", "old-8"],
    );
  });

  for (const [name, init, error] of [
    ["a JSON body without an image", { headers: { "Content-Type": "application/json" }, body: "{}" }, "No image provided"],
    ["a multipart body without an image", () => multipart(new FormData()), "No image provided"],
    ["an unsupported content type", { headers: { "Content-Type": "text/plain" }, body: "hello" }, "Unsupported content type"],
  ]) {
    test(`rejects ${name} with 400 and does not call Replicate`, async () => {
      const response = await mf.dispatchFetch("http://localhost/transform", {
        method: "POST",
        ...(typeof init === "function" ? await init() : init),
      });

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error });
      assert.deepEqual(calls, []);
    });
  }

  test("returns 502 with Replicate's error text when the prediction cannot be created", async () => {
    replicate = () => new Response("Invalid version", { status: 422 });

    const response = await transform("data:image/jpeg;base64,AA");

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "Replicate API error", details: "Invalid version" });
    assert.deepEqual(await feed(), []);
  });

  test("returns 500 and leaves the feed alone when generation fails", async () => {
    replicate = () => prediction({ status: "failed", error: "NSFW content detected" });

    const response = await transform("data:image/jpeg;base64,AA");

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "Generation failed", details: "NSFW content detected" });
    assert.deepEqual(await feed(), []);
  });
});

describe("GET /feed", () => {
  test("drops entries older than 55 minutes, before Replicate's 1-hour URLs expire", async () => {
    const now = Date.now();
    await seedFeed([
      { output: "fresh", timestamp: now - 54 * MINUTE },
      { output: "expired", timestamp: now - 56 * MINUTE },
    ]);

    assert.deepEqual((await feed()).map((e) => e.output), ["fresh"]);
  });

  test("is empty when nothing has been generated", async () => {
    assert.deepEqual(await feed(), []);
  });
});

describe("GET /health", () => {
  for (const [upstream, status, ok] of [
    [200, 200, true],
    [401, 503, false],
  ]) {
    test(`reports ${status} when Replicate's account endpoint returns ${upstream}`, async () => {
      replicate = () => new Response("{}", { status: upstream });

      const response = await mf.dispatchFetch("http://localhost/health");

      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), { ok, checks: { worker: true, replicate: ok } });
      assert.deepEqual(calls.map((c) => [c.url, c.auth]), [
        ["https://api.replicate.com/v1/account", "Bearer test-token"],
      ]);
    });
  }
});

describe("routing", () => {
  test("GET / serves the frontend page", async () => {
    const response = await mf.dispatchFetch("http://localhost/");

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/html");
    assert.equal(await response.text(), readFileSync("src/index.html", "utf8"));
  });

  test("OPTIONS answers the CORS preflight for POST", async () => {
    const response = await mf.dispatchFetch("http://localhost/transform", { method: "OPTIONS" });

    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.match(response.headers.get("access-control-allow-methods"), /\bPOST\b/);
  });

  test("unknown paths return a JSON 404", async () => {
    const response = await mf.dispatchFetch("http://localhost/nope");

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Not found" });
  });
});
