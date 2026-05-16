const CHAT_API_URL = "https://portfolio-ai-proxy.vercel.app/api/chat";
const MAX_HISTORY_MESSAGES = 12;

const chatState = {
  messages: [],
  isSending: false
};

const suggestedQuestions = [
  "What are Hoang's core technical skills and areas of expertise?",
  "Tell me about his work as an NPI Intern at Wahl Clipper Vietnam.",
  "Can you explain the architecture behind his Warehouse Management System?",
  "Summarize Hoang's portfolio in 3 sentences."
];

function createChatElement() {
  const root = document.createElement("div");
  root.className = "portfolio-chat";
  root.innerHTML = `
    <div class="portfolio-chat__panel" role="dialog" aria-label="Portfolio assistant">
      <header class="portfolio-chat__header">
        <div class="portfolio-chat__mark" aria-hidden="true">NH</div>
        <div>
          <p class="portfolio-chat__kicker">Portfolio Assistant</p>
          <h2 class="portfolio-chat__title">Ask about Hoang</h2>
          <p class="portfolio-chat__subtitle">Manufacturing analytics, NPI tools, simulation, dashboards, and project fit.</p>
        </div>
        <button class="portfolio-chat__close" type="button" aria-label="Close chat">&times;</button>
      </header>

      <div class="portfolio-chat__messages" role="log" aria-live="polite">
        <div class="portfolio-chat__intro">
          I can help visitors understand Hoang's portfolio, from production analytics and SPC to warehouse management, NPI workflow tools, Power BI dashboards, and assembly-line simulation.
          <div class="portfolio-chat__prompts"></div>
        </div>
      </div>

      <form class="portfolio-chat__form">
        <textarea
          class="portfolio-chat__input"
          rows="1"
          maxlength="1000"
          placeholder="Ask about a project..."
          aria-label="Message"
        ></textarea>

        <button class="portfolio-chat__send" type="submit" aria-label="Send message">&rsaquo;</button>
      </form>
    </div>

    <button class="portfolio-chat__launcher" type="button" aria-label="Open portfolio assistant">
      <span class="portfolio-chat__launcher-icon" aria-hidden="true">AI</span>
      <span>Ask Hoang AI</span>
    </button>
  `;

  return root;
}

function escapeAttr(s) {
  return s.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderMarkdown(text) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Store code blocks before any other processing
  const codeBlocks = [];
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, function (_, lang, code) {
    codeBlocks.push('<pre><code>' + code.trim() + '</code></pre>');
    return '%%CODEBLOCK_' + (codeBlocks.length - 1) + '%%';
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Links (only safe protocols)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, text, url) {
    if (/^(https?:|mailto:)/i.test(url)) {
      return '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener">' + text + '</a>';
    }
    return '[' + text + '](' + url + ')';
  });

  // Process line by line for block-level elements
  var lines = html.split('\n');
  var result = [];
  var inList = false;
  var listType = null;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      if (inList) { result.push('</' + listType + '>'); inList = false; listType = null; }
      result.push('<hr>');
      continue;
    }

    // Heading
    var headingMatch = trimmed.match(/^(#{1,6}) (.+)/);
    if (headingMatch) {
      if (inList) { result.push('</' + listType + '>'); inList = false; listType = null; }
      var level = headingMatch[1].length;
      result.push('<h' + level + '>' + headingMatch[2] + '</h' + level + '>');
      continue;
    }

    // Blockquote
    var bqMatch = trimmed.match(/^> (.+)/);
    if (bqMatch) {
      if (inList) { result.push('</' + listType + '>'); inList = false; listType = null; }
      result.push('<blockquote><p>' + bqMatch[1] + '</p></blockquote>');
      continue;
    }

    // Unordered list
    var ulMatch = trimmed.match(/^[\-\*] (.+)/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) result.push('</' + listType + '>');
        result.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      result.push('<li>' + ulMatch[1] + '</li>');
      continue;
    }

    // Ordered list
    var olMatch = trimmed.match(/^\d+\. (.+)/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) result.push('</' + listType + '>');
        result.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      result.push('<li>' + olMatch[1] + '</li>');
      continue;
    }

    // Not a list item — close open list
    if (inList) {
      result.push('</' + listType + '>');
      inList = false;
      listType = null;
    }

    result.push(line);
  }

  if (inList) {
    result.push('</' + listType + '>');
  }

  html = result.join('\n');

  // Wrap blocks in <p> tags (split on blank lines)
  var paragraphs = html.split(/\n\n+/);
  html = paragraphs.map(function (p) {
    p = p.trim();
    if (!p) return '';
    if (/^<(h[1-6]|ul|ol|pre|hr|blockquote)/.test(p) || /^%%CODEBLOCK_/.test(p)) return p;
    return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
  }).join('');

  // Restore code blocks
  html = html.replace(/%%CODEBLOCK_(\d+)%%/g, function (_, i) {
    return codeBlocks[parseInt(i)];
  });

  return html;
}

function appendMessage(container, role, text) {
  var message = document.createElement("div");
  message.className = 'portfolio-chat__message portfolio-chat__message--' + role;

  if (role === "assistant") {
    message.innerHTML = renderMarkdown(text);
  } else {
    message.textContent = text;
  }

  container.append(message);
  container.scrollTop = container.scrollHeight;

  return message;
}

function compactHistory() {
  return chatState.messages.slice(-MAX_HISTORY_MESSAGES);
}

function isChatConfigured() {
  return typeof CHAT_API_URL === "string" && CHAT_API_URL.startsWith("https://");
}

async function sendToAssistant() {
  if (!isChatConfigured()) {
    return "The AI endpoint is not connected yet.";
  }

  const response = await fetch(CHAT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages: compactHistory()
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Chat request failed");
  }

  return data.text || "I could not generate a response right now.";
}

function autosizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 106)}px`;
}

function submitPrompt(form, input, prompt) {
  input.value = prompt;
  autosizeTextarea(input);
  form.requestSubmit();
}

function initSuggestedPrompts(form, input, promptWrap) {
  suggestedQuestions.forEach((question) => {
    const button = document.createElement("button");
    button.className = "portfolio-chat__prompt";
    button.type = "button";
    button.textContent = question;
    button.addEventListener("click", () => submitPrompt(form, input, question));
    promptWrap.append(button);
  });
}

function initChatWidget() {
  if (document.querySelector(".portfolio-chat")) return;

  const chat = createChatElement();
  document.body.append(chat);

  const launcher = chat.querySelector(".portfolio-chat__launcher");
  const closeButton = chat.querySelector(".portfolio-chat__close");
  const form = chat.querySelector(".portfolio-chat__form");
  const input = chat.querySelector(".portfolio-chat__input");
  const sendButton = chat.querySelector(".portfolio-chat__send");
  const messages = chat.querySelector(".portfolio-chat__messages");
  const promptWrap = chat.querySelector(".portfolio-chat__prompts");

  initSuggestedPrompts(form, input, promptWrap);

  launcher.addEventListener("click", () => {
    chat.classList.toggle("is-open");
  });

  closeButton.addEventListener("click", () => {
    chat.classList.remove("is-open");
    launcher.focus();
  });

  input.addEventListener("input", () => {
    autosizeTextarea(input);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const userText = input.value.trim();

    if (!userText || chatState.isSending) return;

    chatState.isSending = true;
    input.value = "";
    autosizeTextarea(input);
    input.disabled = true;
    sendButton.disabled = true;

    chatState.messages.push({
      role: "user",
      content: userText
    });

    appendMessage(messages, "user", userText);

    const statusMessage = appendMessage(messages, "status", "Thinking...");

    try {
      const assistantText = await sendToAssistant();

      statusMessage.remove();

      chatState.messages.push({
        role: "assistant",
        content: assistantText
      });

      appendMessage(messages, "assistant", assistantText);
    } catch (error) {
      console.error("Chat error:", error);

      statusMessage.remove();

      appendMessage(
        messages,
        "status",
        "Sorry, the AI is currently offline."
      );
    } finally {
      chatState.isSending = false;
      input.disabled = false;
      sendButton.disabled = false;
      input.focus();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initChatWidget);
} else {
  initChatWidget();
}
