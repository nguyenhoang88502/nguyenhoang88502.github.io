const WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbx0ucg3vn1V8LU9jLOIvLdpU1Bo9I1wfuKdUegltOHjyh00SAI1A4zVFGFjX3bQlwcn/exec";

const STORAGE_KEY = "npiWarehouseInventory.v1";
const HISTORY_KEY = "npiWarehouseHistory.v1";
const LOW_STOCK_LEVEL = 50;

const state = {
  inventory: loadJson(STORAGE_KEY, []),
  history: loadJson(HISTORY_KEY, []),
  stockStatus: "Loading stock...",
  stockSource: "live stock",
  search: "",
  fgFilter: "All",
};

const elements = {
  adjustmentForm: document.querySelector("#adjustmentForm"),
  clearBtn: document.querySelector("#clearBtn"),
  clearHistoryBtn: document.querySelector("#clearHistoryBtn"),
  copyPayloadBtn: document.querySelector("#copyPayloadBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  refreshBtn: document.querySelector("#refreshBtn"),
  fgFilter: document.querySelector("#fgFilter"),
  historyList: document.querySelector("#historyList"),
  inventoryBody: document.querySelector("#inventoryBody"),
  payloadPreview: document.querySelector("#payloadPreview"),
  searchInput: document.querySelector("#searchInput"),
  skuCount: document.querySelector("#skuCount"),
  fgCount: document.querySelector("#fgCount"),
  unitCount: document.querySelector("#unitCount"),
  lowStockCount: document.querySelector("#lowStockCount"),
  stockSource: document.querySelector("#stockSource"),
  submitBtn: document.querySelector("#submitBtn"),
  submitStatus: document.querySelector("#submitStatus"),
};

function loadJson(key, fallback) {
  try {
    const storedValue = localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.inventory));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
}

function getFormPayload() {
  const formData = new FormData(elements.adjustmentForm);
  return {
    itemNumber: String(formData.get("itemNumber") || "").trim(),
    fg: String(formData.get("fg") || "Yes"),
    fgName: String(formData.get("fgName") || "").trim(),
    productName: String(formData.get("productName") || "").trim(),
    quantity: Number(formData.get("quantity") || 0),
  };
}

function setStatus(message, type = "") {
  elements.submitStatus.textContent = message;
  elements.submitStatus.className = `submit-status ${type}`.trim();
}

function normalizeStockRow(item) {
  return {
    itemNumber: String(item.itemNumber || "").trim(),
    fg: String(item.fg || "").trim() || "No",
    fgName: String(item.fgName || "").trim(),
    productName: String(item.productName || "").trim(),
    quantity: Number(item.quantity) || 0,
  };
}

async function loadStockFromWebhook() {
  state.stockStatus = "Loading stock from Google Sheets...";
  renderInventory();

  try {
    const data = await fetchStockJson();
    applyStockPayload(data, "Live Google Sheet");
  } catch (error) {
    try {
      const data = await fetchStockJsonp();
      applyStockPayload(data, "Live Google Sheet");
    } catch (jsonpError) {
      console.info("Live stock endpoint was unavailable.", error, jsonpError);
      state.stockSource = state.inventory.length ? "cached stock" : "not loaded";
      state.stockStatus = state.inventory.length
        ? "Showing cached stock. Refresh again after updating the Apps Script doGet JSONP support."
        : "Stock could not be loaded. Update the Apps Script doGet code to return JSON or JSONP.";
      render();
      setStatus(state.stockStatus, "error");
    }
  }
}

async function fetchStockJson() {
  const response = await fetch(`${WEBHOOK_URL}?format=json&_=${Date.now()}`, {
    method: "GET",
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    throw new Error(`Stock endpoint returned ${response.status}`);
  }

  if (!contentType.includes("json")) {
    throw new Error("Stock endpoint did not return JSON.");
  }

  return response.json();
}

function fetchStockJsonp() {
  return new Promise((resolve, reject) => {
    const callbackName = `npiStockCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("JSONP stock request timed out."));
    }, 12000);

    function cleanup() {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("JSONP stock request failed."));
    };

    script.src = `${WEBHOOK_URL}?format=json&callback=${encodeURIComponent(callbackName)}&_=${Date.now()}`;
    document.body.append(script);
  });
}

function applyStockPayload(data, source) {
  const stock = Array.isArray(data.stock) ? data.stock.map(normalizeStockRow) : [];

  if (!data.ok) {
    throw new Error(data.error || "Stock endpoint returned an error.");
  }

  state.inventory = stock;
  state.stockSource = source;
  state.stockStatus = stock.length ? "" : "Connected to the stock endpoint, but no stock rows were returned.";
  saveState();
  render();
  setStatus(stock.length ? "Read-only stock loaded from the Google Sheet." : state.stockStatus, "success");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function renderMetrics() {
  const totalUnits = state.inventory.reduce((sum, item) => sum + Number(item.quantity), 0);
  const fgTotal = state.inventory.filter((item) => item.fg === "Yes").length;
  const lowStockTotal = state.inventory.filter((item) => item.quantity < LOW_STOCK_LEVEL).length;

  elements.skuCount.textContent = formatNumber(state.inventory.length);
  elements.fgCount.textContent = `${formatNumber(fgTotal)} finished goods`;
  elements.unitCount.textContent = formatNumber(totalUnits);
  elements.lowStockCount.textContent = formatNumber(lowStockTotal);
  elements.stockSource.textContent = state.stockSource;
}

function renderInventory() {
  const query = state.search.toLowerCase();
  const filteredInventory = state.inventory.filter((item) => {
    const searchableText = `${item.itemNumber} ${item.fgName} ${item.productName}`.toLowerCase();
    const matchesQuery = searchableText.includes(query);
    const matchesFg = state.fgFilter === "All" || item.fg === state.fgFilter;
    return matchesQuery && matchesFg;
  });

  elements.inventoryBody.innerHTML = "";

  if (!filteredInventory.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="6">${state.stockStatus || "No stock records match the current view."}</td>`;
    elements.inventoryBody.append(row);
    return;
  }

  filteredInventory.forEach((item) => {
    const isLow = item.quantity < LOW_STOCK_LEVEL;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="item-code">${item.itemNumber}</span></td>
      <td><span class="pill ${item.fg === "No" ? "no" : ""}">${item.fg}</span></td>
      <td>${item.fgName}</td>
      <td>${item.productName}</td>
      <td><strong>${formatNumber(item.quantity)}</strong></td>
      <td><span class="stock-status ${isLow ? "low" : ""}">${isLow ? "Low" : "Healthy"}</span></td>
    `;
    elements.inventoryBody.append(row);
  });
}

function renderHistory() {
  elements.historyList.innerHTML = "";

  if (!state.history.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "No adjustments submitted yet.";
    elements.historyList.append(emptyState);
    return;
  }

  state.history.slice(0, 8).forEach((entry) => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <div>
        <strong>${entry.itemNumber} set to ${formatNumber(entry.quantity)}</strong>
        <span>${entry.productName} / ${entry.fgName}</span>
      </div>
      <span>${new Date(entry.createdAt).toLocaleString()}</span>
    `;
    elements.historyList.append(item);
  });
}

function renderPayloadPreview() {
  elements.payloadPreview.textContent = JSON.stringify(getFormPayload(), null, 2);
}

function render() {
  renderMetrics();
  renderInventory();
  renderHistory();
  renderPayloadPreview();
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

async function postAdjustment(payload) {
  const body = JSON.stringify(payload);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }

    return "confirmed";
  } catch (error) {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body,
    });
    console.info("Webhook JSON response was unavailable; sent fallback POST.", error);
    return "sent";
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const payload = getFormPayload();

  if (!payload.itemNumber || !payload.fgName || !payload.productName || Number.isNaN(payload.quantity)) {
    setStatus("Fill every field before submitting.", "error");
    return;
  }

  elements.submitBtn.disabled = true;
  setStatus("Submitting adjustment...");

  try {
    const result = await postAdjustment(payload);
    state.history.unshift({ ...payload, createdAt: new Date().toISOString(), result });
    saveState();
    render();
    setStatus(
      result === "confirmed"
        ? "Adjustment submitted and confirmed by the webhook."
        : "Adjustment sent. The browser could not read the webhook response, but the POST was dispatched.",
      "success",
    );
    window.setTimeout(loadStockFromWebhook, 900);
  } catch (error) {
    setStatus(`Submission failed: ${error.message}`, "error");
  } finally {
    elements.submitBtn.disabled = false;
  }
}

function clearForm() {
  elements.adjustmentForm.reset();
  elements.adjustmentForm.quantity.value = "";
  renderPayloadPreview();
  setStatus("Form cleared.");
}

function exportInventoryCsv() {
  const header = ["itemNumber", "fg", "fgName", "productName", "quantity"];
  const rows = state.inventory.map((item) =>
    header.map((key) => `"${String(item[key]).replaceAll('"', '""')}"`).join(","),
  );
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `npi-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

elements.adjustmentForm.addEventListener("input", renderPayloadPreview);
elements.adjustmentForm.addEventListener("change", renderPayloadPreview);
elements.adjustmentForm.addEventListener("submit", handleSubmit);
elements.clearBtn.addEventListener("click", clearForm);
elements.exportBtn.addEventListener("click", exportInventoryCsv);
elements.refreshBtn.addEventListener("click", loadStockFromWebhook);
elements.copyPayloadBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(elements.payloadPreview.textContent);
  setStatus("Payload copied.");
});
elements.clearHistoryBtn.addEventListener("click", () => {
  state.history = [];
  saveState();
  renderHistory();
});
elements.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderInventory();
});
elements.fgFilter.addEventListener("change", (event) => {
  state.fgFilter = event.target.value;
  renderInventory();
});

render();
loadStockFromWebhook();
