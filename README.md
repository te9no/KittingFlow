KittingFlow on Netlify

This repo is set up to host a simple frontend and a Netlify Function that proxies requests to your Google Apps Script Web App.

What you need
- A deployed Apps Script Web App URL ending with `/exec`
- The Script Property `API_TOKEN` set in your Apps Script project (optional, but recommended)
- A Netlify site connected to this repository

Configure environment variables (Netlify)
Set these in Netlify -> Site settings -> Environment variables:

- `GAS_ENDPOINT` — your Apps Script Web App URL (ends with `/exec`)
- `API_TOKEN` — the same value as Apps Script `API_TOKEN` Script Property (optional)
- `ALLOW_ORIGIN` — allowed origin for CORS, e.g. `https://<your-site>.netlify.app` (optional; defaults to `*`)

You can use `.env.example` as a reference.

Deploy steps
1. Push this repo to Git and connect it to Netlify.
2. Set the environment variables above.
3. Deploy the site. The static frontend is served from the repository root (`index.html`).
4. The frontend calls `/.netlify/functions/api` which proxies to Apps Script.

Local development
- Install Netlify CLI (optional): `npm i -g netlify-cli`
- Run locally: `netlify dev` (ensure you export environment variables or create a local `.env` accordingly)

Notes
- CORS headers for functions are configured in `netlify.toml`.
- If `API_TOKEN` is set in Netlify, it is added server-side and never exposed to the browser.
- The Apps Script endpoint should accept the JSON payload with actions like `start`, `snapshot`, `next`, `pause`.
