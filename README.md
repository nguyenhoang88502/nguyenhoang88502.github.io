# Nguyen Huy Hoang Portfolio Repository

This repository is the source for `nguyenhoang88502.github.io`, a GitHub Pages portfolio and project archive. It is mostly a static website: HTML, CSS, JavaScript, PDFs, images, dashboards, reports, and small browser tools are organized into project folders and linked from the root portfolio page.

The root experience is the personal portfolio in `index.html`. The `tool.html` page acts as an NPI tool directory, linking to work-oriented utilities such as inspection-standard generation and assembly-line simulation.

## Live Site Model

GitHub Pages serves this repository as static files. Any folder with an `index.html` can be opened as a subpage:

```text
https://nguyenhoang88502.github.io/
https://nguyenhoang88502.github.io/OPF_sim/
https://nguyenhoang88502.github.io/NPI_warehouse_management/
```

Because GitHub Pages is static, it cannot run private backend logic, hide API keys, or execute serverless functions. Any feature that needs a secret key, such as AI chat, must use a backend proxy. The recommended plan in this README uses Vercel Functions as that proxy.

## Root Files

```text
.
|-- index.html
|-- tool.html
|-- favicon.png
|-- resume1.pdf
|-- DSC_4906a (1).jpg
|-- README.md
`-- project folders...
```

### `index.html`

Main portfolio landing page. It includes:

- About / hero section
- Education and certifications
- Skills and tools
- Work experience
- Extracurricular activities
- Project cards
- NPI tool gateway
- Contact links

The page is written as a single static HTML file with embedded CSS and JavaScript. It uses Bootstrap, Bootstrap Icons, and Google Fonts from CDNs.

### `tool.html`

NPI tool directory for Wahl Clipper Vietnam-related workflows. It includes:

- Searchable and filterable tool cards
- English and Vietnamese UI text
- Theme switching
- Links into the inspection standard tool and OPF simulation tool

### Static Assets

- `favicon.png`: site icon.
- `resume1.pdf`: linked from the portfolio.
- `DSC_4906a (1).jpg`: profile or portfolio image asset.

## Repository Structure

```text
.
|-- autocad2d/
|-- BKFC/
|-- bus_sim/
|-- dashboard/
|-- decisionanalysis/
|-- ergonomic/
|-- inspection_standard_tool/
|-- manufacturing-failure-analytics-pipeline/
|-- NPI_warehouse_management/
|-- OPF_sim/
|-- pdftodocx/
|-- systemdesign/
|-- index.html
|-- tool.html
|-- favicon.png
|-- resume1.pdf
`-- README.md
```

Most folders are independent showcase pages or tools. A folder usually has its own `index.html`, and some have supporting PDFs, images, JavaScript files, datasets, or project-specific documentation.

## Folder Guide

### `autocad2d/`

AutoCAD 2D engineering graphics showcase. It contains an `index.html` page plus drawing exports as `.pdf` and `.jpg` files.

Useful files:

- `index.html`: showcase page.
- `*.pdf`: drawing sheets.
- `*.jpg`: drawing previews.
- `favicon.png`: local icon.

### `BKFC/`

Career orientation project page and related admission/poster tooling.

Useful files and folders:

- `index.html`: BK FC Career Orientation Project page.
- `tool.html`: HCMUT admission information tool.
- `BKFC NHC Resource pack.png`: visual resource pack.
- `BKFC post/`: social poster pack, captions, HTML poster pages, PNG assets, and export scripts.

`BKFC/BKFC post/` contains:

- `index.html`: poster library.
- `html/`: one HTML poster per post.
- `captions/`: ready-to-copy caption text files.
- `assets/`: poster images, illustrations, icons, and theme files.
- `tools/`: poster generation/export scripts.
- `schedule.csv`: posting schedule.
- `README.txt`: poster pack instructions.

### `bus_sim/`

Single-page browser simulation for VNU-HCM bus route 50.

Useful file:

- `index.html`: route simulation interface.

### `dashboard/`

Manufacturing performance and downtime dashboard showcase.

Useful files:

- `index.html`: dashboard project page.
- `workshop.pbix`: Power BI file.
- `workshop.jpg`: dashboard preview.
- `Sythetic production data set.zip`: dataset archive.

### `decisionanalysis/`

AHP strategic analysis project for EVLotus customer segmentation and decision support.

Useful files:

- `index.html`: project page.
- `Presentation.pdf`: presentation deck.
- `casestudy.pdf`: case study document.
- `favicon.png`: local icon.

### `ergonomic/`

Ergonomic kitchen workspace design project.

Useful files:

- `index.html`: project page.
- `report.pdf`: report.
- `presentation.pdf`: presentation deck.
- `favicon.png`: local icon.

### `inspection_standard_tool/`

Browser-based inspection standard tool for placing uploaded images or PDF pages into an Excel template.

Useful files:

- `index.html`: built web app.
- `template.xlsx`: Excel template used for output generation.
- `assets/`: built JavaScript/CSS bundles and PDF worker.
- `README.md`: detailed tool documentation.

The app supports manual image assignment, cropping, PDF page extraction, BOM checking, and workbook generation.

### `manufacturing-failure-analytics-pipeline/`

Manufacturing failure analytics project using the AI4I 2020 predictive maintenance dataset. It combines static showcase content, a Python/Streamlit dashboard, ETL scripts, data warehouse SQL, OLAP CSV outputs, and an optional XGBoost model.

Useful files and folders:

- `index.html`: static project showcase page.
- `app.py`: Streamlit dashboard.
- `run_etl.py`: full ETL pipeline runner.
- `main.py`: small Python entry point.
- `pyproject.toml`: Python project dependencies.
- `.streamlit/config.toml`: Streamlit server settings.
- `data/raw/`: raw dataset and exploration script.
- `data/cleaned/`: cleaned dataset and EDA images.
- `etl/`: staging SQL, Pentaho transformation, and load script.
- `dw/`: star schema SQL, OLAP SQL files, OLAP CSV outputs, and documentation.
- `ml/`: XGBoost training script, saved model artifacts, scaler, and plots.
- `picture/`: dashboard screenshots.
- `README.md`: detailed project documentation.

Note: a local `.venv/` folder exists in this project directory. Virtual environments are useful locally but normally should not be committed to a repository.

### `NPI_warehouse_management/`

Static browser app for NPI warehouse stock management and layout visualization. It communicates with a Google Apps Script webhook backed by a Google Sheet.

Useful files:

- `index.html`: warehouse stock and transaction interface.
- `app.js`: main stock, upload, export, cycle count, and webhook behavior.
- `dashboard.html`: warehouse layout dashboard.
- `dashboard.js`: layout rendering, search, metrics, and shelf interaction.
- `styles.css`: shared styling.
- `Layout.xlsx`: source layout workbook.
- `warehouse-layout.js`: generated layout data used by the browser.
- `README.md`: detailed handoff documentation.

Main workflows:

- Review live stock.
- Upload inbound/outbound Excel files.
- Export Excel templates.
- Submit outbound adjustments.
- Check actual stock and cycle count.
- Search warehouse shelves.

### `OPF_sim/`

Trimmer assembly line simulation project. It includes a portfolio page, a Monte Carlo simulation tool, time-study data collection, before/after reports, images, PDFs, Excel files, Arena model files, and process videos.

Useful files:

- `index.html`: DES portfolio page.
- `tool.html`: Monte Carlo / Yamazumi / flow simulation tool.
- `data_collection.html`: time-study data collection page.
- `archive.html`: visual archive.
- `readme.md`: Vietnamese project overview.
- `handover.md`: handoff notes.
- `Before.doe`, `after.doe`: Arena model files.
- `BeforeFitted.xlsx`, `AfterFitted.xlsx`, `temp.xlsx`: analysis workbooks.
- `*.pdf`: reports and slide decks.
- `*.png`: report pages and visuals.
- `*.mp4`: process videos.

### `pdftodocx/`

Single-page document OCR/extraction utility.

Useful file:

- `index.html`: browser tool for extracting text and exporting results.

### `systemdesign/`

Co-working space cafe system design project.

Useful files:

- `index.html`: project page.
- `report.pdf`: report.
- `presentation.pdf`: presentation deck.
- `groundfloorlayout.png`, `floor1layout.png`, `floor2layout.png`: floor-layout visuals.

## Technology Overview

This repository uses several different technology styles:

- Static web pages: HTML, CSS, and JavaScript.
- CDN UI dependencies: Bootstrap, Bootstrap Icons, Google Fonts, Lucide, SheetJS, ExcelJS, and other page-specific libraries.
- Browser storage: `localStorage`, IndexedDB, and client-side cache patterns in the tools.
- Data/report artifacts: PDFs, images, Power BI files, Excel files, CSVs, SQL files, and videos.
- Python analytics: Streamlit, pandas, Plotly, SQLAlchemy, PostgreSQL connector, XGBoost, scikit-learn, and related libraries in `manufacturing-failure-analytics-pipeline/`.
- External integrations: Google Apps Script webhook in `NPI_warehouse_management/`.

## How To Work Locally

For most static pages, no build step is needed. You can open `index.html` directly, but using a local web server is more reliable because browser security rules can block some file behaviors.

From the repository root:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

Examples:

```text
http://localhost:8000/tool.html
http://localhost:8000/OPF_sim/
http://localhost:8000/NPI_warehouse_management/
```

## Running Python Projects

### Manufacturing Failure Analytics Dashboard

From `manufacturing-failure-analytics-pipeline/`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
streamlit run app.py
```

The Streamlit app reads the included OLAP CSV outputs, so PostgreSQL is not required just to view the dashboard.

To rebuild the ETL/data warehouse flow, configure PostgreSQL and set:

```powershell
$env:DATABASE_URL="postgresql://user:password@localhost:5432/database"
python run_etl.py
```

## Deployment Notes

### GitHub Pages

This repository is already shaped for GitHub Pages:

- Root `index.html` becomes the home page.
- Folder `index.html` files become subpages.
- Static assets are served from their relative paths.

GitHub Pages is a good fit for the current public portfolio and static tools.

### Vercel

Vercel is useful if the repository needs serverless functions, especially for AI chat. A Vercel deployment can serve the same static frontend while also exposing backend endpoints under `/api/*`.

Two deployment models are possible:

- Deploy this full repository to Vercel and use `/api/chat` directly from the site.
- Keep GitHub Pages for the public site and deploy only the API proxy to Vercel, then call the Vercel API URL from GitHub Pages with a CORS allowlist.

The first model is simpler. The second model preserves the existing GitHub Pages URL.

## AI Chat Plan With Vercel Serverless Proxy

Goal: add an AI assistant to the portfolio or NPI tool directory without exposing private API keys in browser code.

### Recommended Architecture

```text
Browser chat widget
  |
  | POST /api/chat
  v
Vercel Function proxy
  |
  | Uses OPENAI_API_KEY from Vercel environment variables
  v
AI provider API
  |
  v
Vercel Function returns response or stream to browser
```

The frontend should never call the AI provider directly. The Vercel Function owns the secret key, validates requests, applies rate limits, controls the model, and shapes the assistant behavior.

### What The Chat Should Know

Start with a repo-aware assistant that can answer questions about:

- The portfolio owner and contact links.
- Project summaries from this README.
- How to navigate the project folders.
- NPI tools and their workflows.
- Manufacturing analytics, warehouse management, inspection standards, and OPF simulation.

The first version can embed this context as a short system prompt plus a curated JSON/project summary. Later, it can be upgraded to retrieval over generated documentation chunks.

### Files To Add

```text
api/
`-- chat.js

assets/
|-- chat-widget.css
`-- chat-widget.js

package.json
vercel.json
.env.example
```

Optional:

```text
data/
`-- site-context.json
```

### Step 1: Prepare The Vercel Project

Add a minimal `package.json` at the repository root:

```json
{
  "name": "nguyenhoang88502-github-io",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vercel dev"
  },
  "dependencies": {
    "openai": "latest"
  },
  "devDependencies": {
    "vercel": "latest"
  }
}
```

Add `.env.example`:

```text
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=choose_current_model_here
ALLOWED_ORIGIN=https://nguyenhoang88502.github.io
```

In Vercel, configure the same environment variables in Project Settings.

### Step 2: Add The Serverless Proxy

Create `api/chat.js`.

Responsibilities:

- Accept only `POST`.
- Validate `Origin` against `ALLOWED_ORIGIN`.
- Validate message count and message length.
- Add a concise system instruction for the portfolio assistant.
- Call the AI provider using the server-side API key.
- Return JSON for the first version.
- Later, support streaming responses with Server-Sent Events.

Starter shape:

```js
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
You are the assistant for Nguyen Huy Hoang's portfolio website.
Answer questions about the portfolio, projects, tools, skills, and repository structure.
Be concise, helpful, and clear. If asked for private data or secrets, refuse briefly.
`;

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const origin = request.headers.origin;

  if (allowedOrigin && origin && origin !== allowedOrigin) {
    return response.status(403).json({ error: "Origin not allowed" });
  }

  const { messages = [] } = request.body || {};

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
    return response.status(400).json({ error: "Invalid messages" });
  }

  const safeMessages = messages.map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: String(message.content || "").slice(0, 4000)
  }));

  const result = await client.responses.create({
    model: process.env.OPENAI_MODEL,
    instructions: SYSTEM_PROMPT,
    input: safeMessages
  });

  return response.status(200).json({
    text: result.output_text || ""
  });
}
```

### Step 3: Add The Browser Chat Widget

Create `assets/chat-widget.js` and `assets/chat-widget.css`.

Frontend responsibilities:

- Render a small chat launcher.
- Keep local conversation state in memory.
- POST user messages to `/api/chat`.
- Show loading and error states.
- Keep the UI lightweight so it does not distract from the portfolio.

Load it in `index.html` before `</body>`:

```html
<link rel="stylesheet" href="assets/chat-widget.css" />
<script src="assets/chat-widget.js" defer></script>
```

If the NPI directory also needs chat, load the same files in `tool.html`.

### Step 4: Add Site Context

For better answers, create `data/site-context.json` with curated summaries of the pages and projects.

Example:

```json
{
  "owner": "Nguyen Huy Hoang",
  "site": "Portfolio and NPI tool directory",
  "projects": [
    {
      "name": "Manufacturing Failure Analytics Pipeline",
      "path": "manufacturing-failure-analytics-pipeline/",
      "summary": "ETL, star schema, OLAP, Streamlit dashboard, and optional XGBoost model for machine failure analysis."
    },
    {
      "name": "NPI Warehouse Management",
      "path": "NPI_warehouse_management/",
      "summary": "Static warehouse stock app connected to a Google Apps Script webhook and Google Sheet."
    }
  ]
}
```

The Vercel Function can import this JSON and place a compressed version into the model instructions.

### Step 5: Add Streaming Later

After the JSON version works, upgrade `/api/chat` to stream. Streaming gives users faster feedback for longer answers.

Implementation options:

- Use the AI provider's streaming API in the Vercel Function.
- Return Server-Sent Events to the browser.
- Update `chat-widget.js` to read the response stream and append text as it arrives.

Keep the first release non-streaming unless the UI feels slow. It is easier to debug and safer to moderate.

### Step 6: Add Basic Abuse Protection

Before making the chat public:

- Limit request body size.
- Limit messages per request.
- Limit message length.
- Add per-IP or per-session rate limiting.
- Restrict CORS to the production site.
- Do not expose stack traces in API responses.
- Log only metadata, not full private conversations.
- Add a short privacy note near the chat UI.

For stronger rate limiting, use Vercel KV, Upstash Redis, or another serverless-friendly store.

### Step 7: Deploy

If deploying the full site to Vercel:

```powershell
npm install
npx vercel dev
npx vercel
```

If keeping GitHub Pages as the public frontend:

1. Deploy the Vercel API project.
2. Set `ALLOWED_ORIGIN` to `https://nguyenhoang88502.github.io`.
3. In `chat-widget.js`, call the full Vercel API URL, for example:

```js
const CHAT_API_URL = "https://your-vercel-project.vercel.app/api/chat";
```

### Step 8: Suggested Milestones

1. Add `api/chat.js`, `.env.example`, `package.json`, and a minimal chat widget.
2. Deploy to Vercel and confirm the API key stays server-side.
3. Add `data/site-context.json` for portfolio-aware answers.
4. Add the widget to `index.html`.
5. Add the widget to `tool.html` only if the NPI tools need assistance.
6. Add rate limiting and request validation.
7. Upgrade to streaming if response latency is noticeable.
8. Add feedback buttons so users can flag weak answers.

## Maintenance Notes

- Keep root links relative so the site works on GitHub Pages and local servers.
- Avoid committing local virtual environments, caches, and generated dependency folders.
- Keep project-level READMEs close to the tools they describe.
- For static browser tools, prefer CDN dependencies only when the tool can tolerate external network dependency.
- For any feature requiring secrets, use a backend proxy such as Vercel Functions.
- For Google Apps Script integrations, document the webhook contract beside the browser code that calls it.

## Quick Navigation

- Portfolio: `index.html`
- NPI tool directory: `tool.html`
- Warehouse app: `NPI_warehouse_management/`
- Inspection standard tool: `inspection_standard_tool/`
- OPF simulation: `OPF_sim/`
- Manufacturing failure analytics: `manufacturing-failure-analytics-pipeline/`
- Dashboard showcase: `dashboard/`
- BKFC career orientation project: `BKFC/`
