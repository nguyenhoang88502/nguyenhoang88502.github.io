const CHAT_API_URL = "https://portfolio-ai-proxy.vercel.app/api/chat";
const MAX_HISTORY_MESSAGES = 12;

const chatState = {
  messages: [],
  isSending: false
};

const suggestedQuestions = [
  "What projects best show Hoang's manufacturing analytics work?",
  "Summarize Hoang's NPI internship experience.",
  "Which project should a recruiter look at first?"
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
          I can help visitors understand Hoang's portfolio, from production analytics and SPC to NPI workflow tools, Power BI dashboards, and assembly-line simulation.
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

    if (chat.classList.contains("is-open")) {
      input.focus();
    }
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
