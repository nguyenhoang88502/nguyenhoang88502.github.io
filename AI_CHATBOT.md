# Portfolio AI Chatbot — Technical Documentation

A lightweight AI assistant embedded in the portfolio website. Visitors open a chat widget, ask questions about the portfolio, and receive AI-generated answers. The browser never sees an API key — all AI provider calls go through a Vercel serverless proxy.

## Architecture

```
Browser (chat-widget.js)
    |
    | POST /api/chat  { messages: [...] }
    v
Vercel Serverless Function (api/chat.js)
    |
    | Reads OPENAI_API_KEY from Vercel env
    | Validates origin, method, message count, message length
    | Injects system prompt (portfolio context)
    v
AI Provider API (OpenAI / Anthropic / etc.)
    |
    | Returns response text
    v
Vercel Function returns JSON { text: "..." }
    |
    v
chat-widget.js renders markdown → HTML in the chat panel
```

**Why the proxy?** The AI provider requires a secret API key. Putting that key in browser JavaScript would expose it to anyone who opens DevTools. The Vercel Function owns the key and the browser only talks to the proxy.

## Frontend: Chat Widget

**Files:** `assets/chat-widget.js`, `assets/chat-widget.css`

Both files are self-contained. Each page that needs the assistant loads them before `</body>`:

```html
<link rel="stylesheet" href="assets/chat-widget.css" />
<script src="assets/chat-widget.js" defer></script>
```

Currently loaded on `index.html` and `tool.html`.

### Widget Lifecycle

1. **Init** — `initChatWidget()` runs on `DOMContentLoaded`. Creates the entire widget DOM from JavaScript (no HTML templates needed in the page). Guards against double-initialization by checking for an existing `.portfolio-chat` element.

2. **Open** — Clicking the launcher button toggles `is-open` on the root element, which reveals the chat panel via CSS. The input is auto-focused.

3. **Suggested prompts** — Three or four pre-written questions are rendered as pill buttons. Clicking one fills the input and submits the form immediately.

4. **Send** — On form submit (Enter or click):
   - User message is appended to the panel and pushed into `chatState.messages`
   - A "Thinking..." status bubble appears
   - `sendToAssistant()` POSTs the last 12 messages to the proxy
   - On success, the status bubble is replaced by the assistant response (rendered as markdown)
   - On failure, the status bubble shows "Sorry, the AI is currently offline."

5. **Compact history** — Only the last 12 messages (`MAX_HISTORY_MESSAGES`) are sent to the API. This keeps requests small and avoids token waste.

### State Management

```js
const chatState = {
  messages: [],    // { role: "user"|"assistant", content: "..." }
  isSending: false // prevents double-submit
};
```

No persistence. Messages live only in memory for the current page session. Close the tab, lose the history. This avoids privacy concerns with localStorage chat logs.

### Markdown Rendering

The assistant response is plain text with markdown formatting. The widget parses it into HTML client-side using a custom zero-dependency renderer — no marked.js, no showdown, no CDN library.

#### Rendering pipeline

1. **HTML-escape the raw text** — All `&`, `<`, `>` become entities. This is the XSS foundation: nothing from the AI response is ever treated as raw HTML.

2. **Extract fenced code blocks** — Triple-backtick blocks are replaced with placeholders (`%%CODEBLOCK_0%%`) and stored in an array. This prevents any markdown inside code blocks from being processed.

3. **Inline formatting** — Bold (`**`, `__`), italic (`*`, `_`), bold+italic (`***`), strikethrough (`~~`), inline code (`` ` ``), and links (`[text](url)`) are converted to their HTML equivalents.

4. **Links: safe protocols only** — The URL in `[text](url)` must start with `https:`, `http:`, or `mailto:`. Anything else (like `javascript:`) is left as raw markdown. URLs are attribute-escaped to prevent quote-breakout.

5. **Block-level parsing** — The text is split line-by-line and each line is classified:
   - `#` through `######` → headings
   - `- ` or `* ` → unordered list items (grouped into `<ul>`)
   - `1. `, `2. ` etc. → ordered list items (grouped into `<ol>`)
   - `> ` → blockquotes
   - `---`, `***`, `___` → horizontal rules

6. **Paragraph wrapping** — Remaining text blocks separated by blank lines are wrapped in `<p>`. Single newlines inside paragraphs become `<br>`.

7. **Restore code blocks** — Placeholders are swapped back to `<pre><code>...</code></pre>`.

#### Design decisions

| Decision | Rationale |
|---|---|
| No markdown library | Zero dependencies. The widget is a single JS file loaded on every portfolio page. |
| HTML-escape first, then transform | Prevents any raw AI output from becoming executable HTML. |
| Code block placeholders | Code blocks can contain markdown syntax (e.g. `**kwargs`). Placeholders prevent false matches. |
| Line-by-line block parsing | Simpler than regex-based block matching across multi-line spans. List continuity is tracked with `inList`/`listType` state. |
| Protocol whitelist on links | Even though the text is escaped, `[text](javascript:...)` would survive escaping. The protocol check blocks XSS via links. |

#### CSS for markdown elements

All markdown output is scoped under `.portfolio-chat__message--assistant` so it never leaks into other parts of the page. The styling matches the portfolio's dark navy/gold theme:

- Headings (h1–h6): Cormorant-like sizing, cream color, tight margins
- Inline code: gold text, dark navy background, monospace font stack
- Code blocks: scrollable `<pre>`, darker background, smaller type
- Lists: gold bullet markers, compact spacing
- Blockquotes: left gold border, subtle gold background
- Links: blue with underline, gold on hover
- Horizontal rules: single gold-tinted line

### Widget CSS Architecture

Class naming follows a BEM-like convention: `.portfolio-chat__{element}--{modifier}`.

Key layout decisions:
- The widget is `position: fixed` at bottom-right
- The panel uses CSS Grid (`grid-template-rows: auto 1fr auto`) for header / messages / form
- Messages use flexbox column with `align-self` for user (right) vs assistant (left) alignment
- Mobile breakpoint at 560px collapses the launcher text and adjusts panel sizing
- All colors use CSS custom properties (`--chat-navy`, `--chat-gold`, etc.) for consistent theming

## Backend: Vercel Serverless Proxy

**Deployed at:** `https://portfolio-ai-proxy.vercel.app/api/chat`

The proxy is a single Vercel Function. It is deployed separately from the GitHub Pages site — this is the "split deployment" model described in the root README.

### Request flow

```
POST /api/chat
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "What is the WMS project?" }
  ]
}
```

### Proxy responsibilities

1. **Method check** — Only `POST` is accepted. Other methods return 405.

2. **Origin validation** — The `Origin` header is checked against `ALLOWED_ORIGIN` from Vercel environment variables. Mismatched origins get a 403.

3. **Message validation** — Messages must be an array, non-empty, and at most 20 entries. Each message content is truncated to 4000 characters.

4. **System prompt injection** — A concise system instruction defines the assistant's persona: portfolio-aware, helpful, concise, refuses private data requests.

5. **AI provider call** — The function forwards validated messages to the AI provider using the server-side API key.

6. **Response** — Returns `{ text: "..." }` as JSON. The current version is non-streaming.

### Environment variables

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | AI provider API key (never sent to browser) |
| `OPENAI_MODEL` | Model identifier (e.g. `gpt-4o`) |
| `ALLOWED_ORIGIN` | CORS origin to accept requests from |

### Why Vercel?

- Free tier covers portfolio traffic
- Environment variables for secrets
- No server to maintain
- Global edge deployment (low latency from Vietnam)
- Works with the OpenAI SDK natively

## Security Model

| Threat | Mitigation |
|---|---|
| API key exposure | Key lives only in Vercel env vars, never in client code |
| Cross-origin abuse | `ALLOWED_ORIGIN` check on every request |
| Prompt injection via user messages | Messages are role-tagged; system prompt sets boundaries |
| XSS via AI output | HTML-escaped before markdown rendering; link protocol whitelist |
| Request flooding | Message count limit (20); content length limit (4000 chars/message) |
| Information disclosure | No stack traces in error responses; metadata-only logging |

### What the assistant refuses

The system prompt instructs the assistant to decline:
- Requests for private data, secrets, or API keys
- Attempts to change the assistant's behavior (jailbreaking)
- Questions unrelated to the portfolio

## Adding Context

The assistant combines the deployed portfolio's live text with the structured
public context in the separate `portfolio-ai-proxy` repository:

1. **Update `data/site-context.json`** with verified public facts, calculations,
   project order, and privacy rules
2. **Update the system instructions** in `api/chat.js` only when the assistant's
   behavior or boundaries need to change
3. **Update `suggestedQuestions`** in `chat-widget.js` to add a relevant prompt button
4. **Update the intro message** in `chat-widget.js` so visitors know the assistant covers the new topic

The context file is loaded by the Vercel Function and injected into the system
prompt. Keep it public-safe: exclude private relationships, precise locations,
internal paths, confidential company data, product identifiers, and unsupported
claims.

## Streaming (Future)

The current implementation returns the full response as one JSON payload. For longer answers, streaming via Server-Sent Events would improve perceived responsiveness:

1. Vercel Function uses the AI provider's streaming API
2. Response headers set `Content-Type: text/event-stream`
3. `chat-widget.js` uses `EventSource` or `fetch` with `ReadableStream` to consume the stream
4. The message bubble appends text incrementally

This is not yet implemented. The non-streaming version is simpler to debug and moderate.

## Files Summary

```
assets/
  chat-widget.js     Frontend widget (DOM creation, state, markdown, API calls)
  chat-widget.css    Widget styling (BEM classes, custom properties, responsive)

api/
  chat.js            Vercel serverless proxy (validation, system prompt, AI call)

AI_CHATBOT.md        This document
```

## Quick Start (Development)

```powershell
# Run the site locally
python -m http.server 8000

# In a separate terminal, run the Vercel Function locally
cd api
npx vercel dev
```

Set `ALLOWED_ORIGIN=http://localhost:8000` in `.env` for local development.

For production, the proxy is deployed to Vercel and GitHub Pages serves the static frontend. The widget points to the Vercel URL via the `CHAT_API_URL` constant.
