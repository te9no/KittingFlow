KittingFlow
===========

This project contains a React frontend that talks to a Google Apps Script (GAS) web app for authentication and picking-progress APIs. Netlify hosts the frontend, while the GAS project lives in `backend_gas/`.

Project Structure
-----------------

- `frontend/` – Vite + React application deployed to Netlify.
- `backend_gas/` – GAS source managed with `clasp`. Provides the `/exec` web endpoint the frontend calls.
- `scripts/`, `src/` (top-level) – legacy automation; not touched in the current flow.

Prerequisites
-------------

- Node.js 18+ with npm.
- Google account with access to the target Spreadsheet and Apps Script.
- `@google/clasp` installed globally (`npm i -g @google/clasp`).
- Netlify account for hosting the frontend.

Environment Variables
---------------------

| Variable | Where | Description |
| -------- | ----- | ----------- |
| `VITE_GAS_URL` | Netlify frontend | The published Apps Script web-app URL ending in `/exec`. |
| `VITE_GOOGLE_CLIENT_ID` | Netlify frontend | OAuth 2.0 Web client ID created in Google Cloud Console. |
| `ALLOW_ORIGIN` (optional) | GAS Script Properties | Explicit CORS allowlist. Defaults to `*` when unset. |
| `ALLOWED_USERS` | Spreadsheet `Settings` sheet | Comma-separated list of email addresses permitted to sign in. |

Frontend Setup
--------------

```bash
cd frontend
npm install
npm run dev        # local preview on http://localhost:5173
npm run build      # production bundle (used by Netlify)
```

Ensure `.env.local` (for local dev) or Netlify environment variables define:

```
VITE_GAS_URL=https://script.google.com/macros/s/xxx/exec
VITE_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
```

Backend (GAS) Setup
-------------------

1. Log in once with `clasp login`.
2. Update the spreadsheet ID inside `.clasp.json` if necessary.
3. Push the current sources and create a deployment:
   ```bash
   cd backend_gas
   clasp push
   clasp deploy --description "Initial deploy"
   ```
4. In the Apps Script UI choose **Deploy → Manage deployments → Edit**:
   - Execute as: **Me (the developer)**
   - Who has access: **Anyone**
   - Copy the new `/exec` URL and store it in Netlify as `VITE_GAS_URL`.
5. Optional: set `ALLOW_ORIGIN` in **Project Settings → Script properties** to restrict CORS.

Spreadsheet Layout
------------------

Create sheets with the exact names below:

- `Settings` – two columns (`Key`, `Value`). Example keys: `ALLOWED_USERS`, `ALERT_THRESHOLD`, `LABEL_PREFIX`.
- `Parts` – contains part catalogue rows with headers (e.g. `部品ID`, `部品名`, `必要数`, `画像URL`, `在庫`).
- `Progress` – cell `A2` (status), `B2` (current part ID), `C2` (product ID). The script updates `A2/B2`.

The sidebar (`backend_gas/SettingsSidebar.html`) helps maintain the `Settings` sheet.

Self Tests
----------

The GAS project exposes a lightweight health check and self-test:

- HTTP: `GET ${VITE_GAS_URL}?action=health` returns sheet presence and current settings.
- `clasp run runSelfTest` prints the same information in the terminal.

CSV Import / Export
-------------------

- Export any sheet to CSV:

  ```
  GET ${VITE_GAS_URL}?action=export&target=parts    # or progress, settings
  ```

  The response downloads a CSV file with headers taken from the sheet.

- Import CSV data (completely replaces the sheet contents):

  ```
  POST ${VITE_GAS_URL}
  action=import&target=parts&csv=<url-encoded CSV string>
  ```

  Targets: `settings`, `parts`, `progress`. The first row must contain column headers. Use UTF-8 when encoding the CSV body.

Troubleshooting
---------------

- **CORS error / login wall** – Redeploy the Apps Script web app with “Anyone” access and ensure Netlify uses the latest `/exec` URL.
- **`認証成功` never returned** – Confirm the Google OAuth client ID matches `VITE_GOOGLE_CLIENT_ID` and that the spreadsheet `ALLOWED_USERS` list contains the tester’s email.
- **`400 invalid_request` from Google** – Usually caused by mismatched OAuth client settings or missing authorized JavaScript origin.
- **Netlify build fails (`Could not resolve entry module "index.html"`)** – Verify that `frontend/index.html` exists in the repo root; Netlify runs the build from `frontend/`.

Deployment Flow
---------------

1. Update GAS code (`backend_gas/`), run `clasp push`, then publish a new deployment.
2. Update Netlify environment variables if the `/exec` URL changed.
3. Re-deploy the frontend (`git push` to the Netlify-connected branch or `netlify deploy`).
4. Confirm the app loads and health check succeeds.

For manual verification, run:

```powershell
# From any terminal
Invoke-WebRequest -Method Get "$env:VITE_GAS_URL?action=health"
```

You should receive JSON with `"ok": true` and sheet statuses marked `"ok"`.
