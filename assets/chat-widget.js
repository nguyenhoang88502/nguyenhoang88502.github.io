const CHAT_API_URL = 'https://portfolio-ai-proxy.vercel.app/api/chat';
const CHAT_PLACEHOLDER_URL = 'https://portfolio-ai-proxy.vercel.app/api/chat';
const MAX_HISTORY_MESSAGES = 10;

const chatState = {
  messages: [],
  isSending: false
};

function createChatElement() {
  const root = document.createElement("div");
  root.className = "portfolio-chat";
  root.innerHTML = `
    <section class="portfolio-chat__panel" aria-label="Portfolio assistant">
      <header class="portfolio-chat__header">
        <div>
          <h2 class="portfolio-chat__title">Ask about Hoang</h2>
          <p class="portfolio-chat__subtitle">Projects, NPI tools, analytics, and simulation.</p>
        </div>
        <button class="portfolio-chat__close" type="button" aria-label="Close chat">×</button>
      </header>
      <div class="portfolio-chat__messages" role="log" aria-live="polite"></div>
      <form class="portfolio-chat__form">
        <textarea class="portfolio-chat__input" rows="1" maxlength="1000" placeholder="Ask a quick question..." aria-label="Message"></textarea>
        <button class="portfolio-chat__send" type="submit" aria-label="Send message">›</button>
      </form>
    </section>
    <button class="portfolio-chat__launcher" type="button" aria-label="Open portfolio assistant">
      <span class="portfolio-chat__launcher-icon" aria-hidden="true">✦</span>
      <span>Ask AI</span>
    </button>
  `;
  return root;
}

function appendMessage(container, role, text) {
  const message = document.createElement("div");
  message.className = `portfolio-chat__message portfolio-chat__message--${role}`;
  message.textContent = text;
  container.append(message);
  container.scrollTop = container.scrollHeight;
  return message;
}

function compactHistory() {
  return chatState.messages.slice(-MAX_HISTORY_MESSAGES);
}

function isChatConfigured() {
  return CHAT_API_URL && CHAT_API_URL !== CHAT_PLACEHOLDER_URL;
}

async function sendToAssistant(userText) {
  if (!isChatConfigured()) {
    return "The AI endpoint is not connected yet. After deploying the Vercel API, update CHAT_API_URL in assets/chat-widget.js.";
  }

  const response = await fetch(CHAT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: compactHistory() })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Chat request failed");
  }

  return data.text || "I could not generate a response right now.";
}

function autosizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
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

  appendMessage(
    messages,
    "assistant",
    "Hi, I can answer questions about Hoang's projects, NPI tools, manufacturing analytics, and simulation work."
  );

  launcher.addEventListener("click", () => {
    chat.classList.toggle("is-open");
    if (chat.classList.contains("is-open")) input.focus();
  });

  closeButton.addEventListener("click", () => {
    chat.classList.remove("is-open");
    launcher.focus();
  });

  input.addEventListener("input", () => autosizeTextarea(input));
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

    chatState.messages.push({ role: "user", content: userText });
    appendMessage(messages, "user", userText);
    const statusMessage = appendMessage(messages, "status", "Thinking...");

    try {
      const assistantText = await sendToAssistant(userText);
      statusMessage.remove();
      chatState.messages.push({ role: "assistant", content: assistantText });
      appendMessage(messages, "assistant", assistantText);
    } catch (error) {
      console.error("Chat error:", error);
      statusMessage.remove();
      appendMessage(messages, "status", "Sorry, the AI is currently offline.");
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
