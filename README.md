# Lempicka

Lempicka is a Cloudflare Worker that turns uploaded photos into portraits inspired by Tamara de Lempicka. It serves a small web app, sends images to Replicate for image-to-image generation, and keeps a short-lived gallery of recent results in Cloudflare KV.

This is a deployable app, not an npm library. Use it when you want a single Worker that handles the UI, API, Replicate calls, and recent-image feed.

## What it does

- Accepts image uploads from drag-and-drop, file picker, or camera capture
- Sends images to Replicate with a tuned Lempicka portrait prompt
- Preserves subject identity, gender presentation, ethnicity, and glasses where possible
- Shows the original and generated image side by side
- Stores the 10 most recent generated image URLs in KV
- Filters gallery entries after 55 minutes because Replicate output URLs expire
- Exposes `/health` for checking Worker and Replicate connectivity

## Requirements

| Requirement | Why it is needed |
| --- | --- |
| Node.js `>=20.6.0` | Runs the local scripts and supports `node --env-file` |
| npm | Installs Wrangler |
| Cloudflare account | Hosts the Worker and KV namespace |
| Replicate account | Runs the image-to-image model |
| Replicate API token | Authenticates Worker requests to Replicate |

Cloudflare Workers and KV can run within Cloudflare free-tier limits for light use. Replicate usage is billed separately by Replicate.

## Cloudflare services

| Service | Binding / config | Purpose |
| --- | --- | --- |
| Workers | `main = src/index.js` in `wrangler.jsonc` | Serves the frontend and API |
| KV | `GALLERY` | Stores recent generated image URLs |
| Worker secrets | `REPLICATE_API_TOKEN` | Stores the production Replicate token |

## Quick start

From a local checkout of this repository:

```sh
npm install
cp .env.example .env
cp .env.example .dev.vars
```

Edit `.env` and `.dev.vars`:

```sh
REPLICATE_API_TOKEN=your_replicate_api_token_here
```

Create a KV namespace and put its ID into `wrangler.jsonc`:

```sh
npx wrangler kv namespace create GALLERY
```

Start the Worker locally:

```sh
npm run dev
```

Open the URL printed by Wrangler, usually:

```txt
http://localhost:8787
```

## Configuration

### Replicate token

Local Worker development reads secrets from `.dev.vars`:

```sh
REPLICATE_API_TOKEN=your_replicate_api_token_here
```

Direct Node prompt-tuning scripts read `.env` through `node --env-file=.env`.

For production, store the token as a Cloudflare secret:

```sh
npx wrangler secret put REPLICATE_API_TOKEN
```

Do not commit `.env`, `.dev.vars`, or real tokens.

### KV namespace

`wrangler.jsonc` expects a KV namespace bound as `GALLERY`:

```jsonc
"kv_namespaces": [
  { "binding": "GALLERY", "id": "your_namespace_id" }
]
```

Create your own namespace with:

```sh
npx wrangler kv namespace create GALLERY
```

Then replace the `id` in `wrangler.jsonc` with the value returned by Wrangler.

## API routes

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Serves the web UI |
| `POST` | `/transform` | Accepts JSON or multipart image input and returns the Replicate output URL |
| `POST` | `/` | Same transform behavior as `/transform` |
| `GET` | `/feed` | Returns recent gallery images from KV |
| `GET` | `/health` | Checks Worker and Replicate API connectivity |
| `OPTIONS` | any path | Handles CORS preflight for transform requests |

Example transform request against a local Worker, using the committed small test image:

```sh
node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';

const image = `data:image/jpeg;base64,${readFileSync('test/test-small.jpg').toString('base64')}`;
const response = await fetch('http://localhost:8787/transform', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ image }),
});

console.log(await response.text());
NODE
```

Successful response:

```json
{
  "output": "https://replicate.delivery/.../output.jpg"
}
```

## Development commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts Wrangler dev server |
| `npm run deploy` | Deploys the Worker |
| `npm run test:worker` | Runs the Worker in workerd with local KV and a stubbed Replicate; no token or network needed |
| `npm test` | Posts `test/test-small.jpg` to a running Worker |
| `npm run test:prompts` | Runs direct Replicate prompt comparisons |
| `npm run test:iteration2` | Runs the second prompt-iteration script |

`npm test` targets `http://localhost:8787` by default. To test a deployed Worker:

```sh
WORKER_URL=https://your-worker.example.workers.dev npm test
```

The direct Replicate scripts require `.env`:

```sh
npm run test:prompts
npm run test:iteration2
```

## Deployment

Before deploying, make sure `wrangler.jsonc` contains your own KV namespace ID.

```sh
npx wrangler secret put REPLICATE_API_TOKEN
npm run deploy
```

After deployment, check:

```sh
curl https://your-worker.example.workers.dev/health
```

A healthy deployment returns:

```json
{
  "ok": true,
  "checks": {
    "worker": true,
    "replicate": true
  }
}
```

## Prompt notes

The production prompt and model version are in `src/prompt.js`; the Worker and
the prompt-experiment scripts in `test/` both import them. Its evolution is
documented in:

- `PROMPT_CHANGELOG.md` — concise production prompt history
- `Prompt_autotuning.md` — longer notes from prompt experiments

Prompt experiments call the real Replicate API and may incur cost. Each script
exits non-zero when any request fails, so a run that produced nothing is never
mistaken for a completed comparison.

## Security

- Keep real tokens in `.env`, `.dev.vars`, or Cloudflare secrets only.
- Revoke any token that has been committed or shared.
- Do not expose private photos through a public Worker unless that is intended.
- The gallery stores Replicate output URLs, not uploaded source images.

## License

ISC. See [`LICENSE`](./LICENSE).
