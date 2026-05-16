const WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbx3gpYGoOY81E3J85TvZNllrmc6fBzessoQVicZr18G5uornSqX7Cgk_TGZ1D_-XUTS/exec";

const STORAGE_KEY = "npiWarehouseTotal.v2";
const HISTORY_KEY = "npiWarehouseHistory.v1";

const state = {
  inventory: loadJson(STORAGE_KEY, []),
  history: loadJson(HISTORY_KEY, []),
  inboundUploadRows: [],
  outboundUploadRows: [],
  weekIndex: [],
  selectedWeek: "",
  inboundSkuLastWeek: 0,
  isLoadingStock: false,
  lastUpdatedAt: "",
  stockStatus: "Loading stock...",
  stockSource: "live stock",
  search: "",
};

const elements = {
  adjustmentForm: document.querySelector("#adjustmentForm"),
  checkFinishGoodId: document.querySelector("#checkFinishGoodId"),
  checkItemNumber: document.querySelector("#checkItemNumber"),
  checkProductName: document.querySelector("#checkProductName"),
  checkStatus: document.querySelector("#checkStatus"),
  clearCheckBtn: document.querySelector("#clearCheckBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  clearHistoryBtn: document.querySelector("#clearHistoryBtn"),
  clearOutboundUploadBtn: document.querySelector("#clearOutboundUploadBtn"),
  clearUploadBtn: document.querySelector("#clearUploadBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  refreshBtn: document.querySelector("#refreshBtn"),
  historyList: document.querySelector("#historyList"),
  inboundTemplateBtn: document.querySelector("#inboundTemplateBtn"),
  inventoryBody: document.querySelector("#inventoryBody"),
  itemLookup: document.querySelector("#itemLookup"),
  itemNumber: document.querySelector("#itemNumber"),
  finishGoodId: document.querySelector("#finishGoodId"),
  searchInput: document.querySelector("#searchInput"),
  outboundTemplateBtn: document.querySelector("#outboundTemplateBtn"),
  outboundUploadPreview: document.querySelector("#outboundUploadPreview"),
  outboundUploadStatus: document.querySelector("#outboundUploadStatus"),
  outboundXlsxDropZone: document.querySelector("#outboundXlsxDropZone"),
  outboundXlsxInput: document.querySelector("#outboundXlsxInput"),
  skuCount: document.querySelector("#skuCount"),
  sendCheckBtn: document.querySelector("#sendCheckBtn"),
  sendInboundBtn: document.querySelector("#sendInboundBtn"),
  sendOutboundBtn: document.querySelector("#sendOutboundBtn"),
  unitCount: document.querySelector("#unitCount"),
  inboundSkuLastWeek: document.querySelector("#inboundSkuLastWeek"),
  refreshMeta: document.querySelector("#refreshMeta"),
  stockSource: document.querySelector("#stockSource"),
  submitBtn: document.querySelector("#submitBtn"),
  submitStatus: document.querySelector("#submitStatus"),
  stockCheckForm: document.querySelector("#stockCheckForm"),
  uploadPreview: document.querySelector("#uploadPreview"),
  uploadStatus: document.querySelector("#uploadStatus"),
  weekBody: document.querySelector("#weekBody"),
  weekInboundQty: document.querySelector("#weekInboundQty"),
  weekOutboundQty: document.querySelector("#weekOutboundQty"),
  weekSelect: document.querySelector("#weekSelect"),
  xlsxDropZone: document.querySelector("#xlsxDropZone"),
  xlsxInput: document.querySelector("#xlsxInput"),
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
    action: "outbound",
    itemNumber: String(formData.get("itemNumber") || "").trim(),
    finishGoodId: String(formData.get("finishGoodId") || "").trim(),
    quantity: Number(formData.get("quantity") || 0),
  };
}

function setStatus(message, type = "") {
  elements.submitStatus.textContent = message;
  elements.submitStatus.className = `submit-status ${type}`.trim();
}

function setPanelStatus(element, message, type = "") {
  element.textContent = message;
  element.className = `submit-status ${type}`.trim();
}

function normalizeStockRow(item) {
  const quantity = Number(item.quantity ?? item.quantily ?? 0) || 0;
  const total = Number(item.total ?? quantity) || 0;

  return {
    finishGoodId: String(item.finishGoodId ?? item.fgId ?? item.stt ?? "").trim(),
    itemNumber: String(item.itemNumber || "").trim(),
    productName: String(item.productName || "").trim(),
    quantity,
    location: String(item.location ?? "").trim(),
    shelf: String(item.shelf ?? "").trim(),
    total,
    family: String(item.family ?? "").trim(),
  };
}

async function loadStockFromWebhook({ silent = false } = {}) {
  if (state.isLoadingStock) {
    return;
  }

  state.isLoadingStock = true;
  elements.refreshBtn.disabled = true;

  if (!silent) {
    state.stockStatus = "Loading stock from Google Sheets...";
    renderInventory();
    renderRefreshMeta();
  }

  try {
    const data = await fetchStockJson();
    applyStockPayload(data, "", silent);
  } catch (error) {
    try {
      const data = await fetchStockJsonp();
      applyStockPayload(data, "", silent);
    } catch (jsonpError) {
      console.info("Live stock endpoint was unavailable.", error, jsonpError);
      state.stockSource = state.inventory.length ? "cached stock" : "not loaded";
      state.stockStatus = state.inventory.length
        ? "Showing cached stock. Refresh again after updating the Apps Script doGet JSONP support."
        : "Stock could not be loaded. Update the Apps Script doGet code to return JSON or JSONP.";
      render();
      if (!silent) {
        setStatus(state.stockStatus, "error");
      }
    }
  } finally {
    state.isLoadingStock = false;
    elements.refreshBtn.disabled = false;
    renderRefreshMeta();
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

function applyStockPayload(data, source, silent = false) {
  const sourceRows = Array.isArray(data.total) ? data.total : data.stock;
  const stock = Array.isArray(sourceRows)
    ? sourceRows.map(normalizeStockRow).filter((item) => Number(item.total || item.quantity) !== 0)
    : [];

  if (!data.ok) {
    throw new Error(data.error || "Stock endpoint returned an error.");
  }

  state.inventory = stock;
  state.weekIndex = Array.isArray(data.weekIndex) ? data.weekIndex : [];
  if (!state.selectedWeek || !state.weekIndex.some((week) => week.weekKey === state.selectedWeek)) {
    state.selectedWeek = state.weekIndex[0]?.weekKey || "";
  }
  state.inboundSkuLastWeek = Number(
    data.metrics?.inboundSkuLastWeek || data.inboundSkuLastWeek || countInboundSkusLastWeek(state.weekIndex),
  );
  state.lastUpdatedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  state.stockSource = source;
  state.stockStatus = stock.length ? "" : "Connected to the stock endpoint, but no stock rows were returned.";
  saveState();
  render();
  if (!silent) {
    setStatus(stock.length ? "Total sheet loaded from the Google Sheet." : state.stockStatus, "success");
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function activeStockRows() {
  return state.inventory.filter((item) => Number(item.total || item.quantity) !== 0);
}

function stockOnHand(item) {
  return Number(item.total || item.quantity) || 0;
}

function countInboundSkusLastWeek(weekIndex) {
  const seen = new Set();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  weekIndex.forEach((week) => {
    (Array.isArray(week.inbound) ? week.inbound : []).forEach((entry) => {
      const entryDate = new Date(entry.date);

      if (Number.isNaN(entryDate.getTime()) || entryDate < sevenDaysAgo || entryDate > now) {
        return;
      }

      if (entry.itemNumber) {
        seen.add(String(entry.itemNumber).trim());
      }
    });
  });

  return seen.size;
}

function renderMetrics() {
  const stockRows = activeStockRows();
  const totalUnits = stockRows.reduce((sum, item) => sum + stockOnHand(item), 0);

  elements.skuCount.textContent = formatNumber(stockRows.length);
  elements.unitCount.textContent = formatNumber(totalUnits);
  elements.inboundSkuLastWeek.textContent = formatNumber(state.inboundSkuLastWeek);
  elements.stockSource.textContent = state.stockSource;
}

function renderRefreshMeta() {
  if (!elements.refreshMeta) {
    return;
  }

  if (state.isLoadingStock) {
    elements.refreshMeta.textContent = "Refreshing...";
    return;
  }

  elements.refreshMeta.textContent = state.lastUpdatedAt
    ? `Auto-refresh every 10s / Last updated ${state.lastUpdatedAt}`
    : "Auto-refresh every 10s";
}

function renderInventory() {
  const query = state.search.toLowerCase();
  const filteredInventory = activeStockRows().filter((item) => {
    const searchableText =
      `${item.finishGoodId} ${item.itemNumber} ${item.productName} ${item.location} ${item.shelf} ${item.family}`.toLowerCase();
    return searchableText.includes(query);
  });

  elements.inventoryBody.innerHTML = "";

  if (!filteredInventory.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="7">${state.stockStatus || "No Total sheet rows match the current view."}</td>`;
    elements.inventoryBody.append(row);
    return;
  }

  filteredInventory.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.finishGoodId}</td>
      <td><button class="item-code" type="button" data-item-number="${item.itemNumber}">${item.itemNumber}</button></td>
      <td>${item.productName}</td>
      <td><strong>${formatNumber(stockOnHand(item))}</strong></td>
      <td>${item.location}</td>
      <td>${item.shelf}</td>
      <td>${item.family ? `<span class="pill">${item.family}</span>` : ""}</td>
    `;
    elements.inventoryBody.append(row);
  });

  elements.inventoryBody.querySelectorAll("[data-item-number]").forEach((button) => {
    button.addEventListener("click", () => selectItem(button.dataset.itemNumber));
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
        <span>${entry.finishGoodId || entry.productName || "warehouse adjustment"}</span>
      </div>
      <span>${new Date(entry.createdAt).toLocaleString()}</span>
    `;
    elements.historyList.append(item);
  });
}

function renderWeekIndex() {
  if (!elements.weekSelect || !elements.weekBody) {
    return;
  }

  elements.weekSelect.innerHTML = "";

  if (!state.weekIndex.length) {
    elements.weekSelect.innerHTML = `<option value="">No weeks found</option>`;
    elements.weekInboundQty.textContent = "0";
    elements.weekOutboundQty.textContent = "0";
    elements.weekBody.innerHTML = `<tr><td colspan="5">No inbound or outbound records found.</td></tr>`;
    return;
  }

  state.weekIndex.forEach((week) => {
    const option = document.createElement("option");
    option.value = week.weekKey;
    option.textContent = week.label || week.weekKey;
    option.selected = week.weekKey === state.selectedWeek;
    elements.weekSelect.append(option);
  });

  const selectedWeek = state.weekIndex.find((week) => week.weekKey === state.selectedWeek) || state.weekIndex[0];
  const inbound = Array.isArray(selectedWeek.inbound) ? selectedWeek.inbound : [];
  const outbound = Array.isArray(selectedWeek.outbound) ? selectedWeek.outbound : [];
  const rows = [
    ...inbound.map((row) => ({ ...row, flow: "Inbound" })),
    ...outbound.map((row) => ({ ...row, flow: "Outbound" })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  elements.weekInboundQty.textContent = formatNumber(Number(selectedWeek.inboundQty) || 0);
  elements.weekOutboundQty.textContent = formatNumber(Number(selectedWeek.outboundQty) || 0);
  elements.weekBody.innerHTML = "";

  if (!rows.length) {
    elements.weekBody.innerHTML = `<tr><td colspan="5">No records for this week.</td></tr>`;
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.date || ""}</td>
      <td><span class="flow-pill ${row.flow.toLowerCase()}">${row.flow}</span></td>
      <td><span class="item-code">${row.itemNumber || ""}</span></td>
      <td>${row.productName || ""}</td>
      <td><strong>${formatNumber(Number(row.quantity) || 0)}</strong></td>
    `;
    elements.weekBody.append(tr);
  });
}

function renderItemLookup() {
  const itemNumber = elements.itemNumber.value.trim();

  if (!itemNumber) {
    elements.itemLookup.innerHTML = `<span class="muted-line">Scan or type an item number to see stock and shelf.</span>`;
    return;
  }

  const exactItem = findStockItem(itemNumber);

  if (exactItem) {
    elements.itemLookup.innerHTML = itemLookupMarkup(exactItem);
    return;
  }

  const matches = state.inventory
    .filter((item) => Number(item.total || item.quantity) !== 0)
    .filter((item) => item.itemNumber.toLowerCase().includes(itemNumber.toLowerCase()))
    .slice(0, 5);

  if (!matches.length) {
    elements.itemLookup.innerHTML = `<span class="muted-line">No matching stock row found.</span>`;
    return;
  }

  elements.itemLookup.innerHTML = matches
    .map(
      (item) => `
        <button class="lookup-result" type="button" data-item-number="${item.itemNumber}">
          <strong>${item.itemNumber}</strong>
          <span>${item.productName}</span>
          <span>${formatNumber(stockOnHand(item))} units / FG ${item.finishGoodId || "-"} / Loc ${item.location || "-"} / Shelf ${item.shelf || "-"}</span>
        </button>
      `,
    )
    .join("");

  elements.itemLookup.querySelectorAll("[data-item-number]").forEach((button) => {
    button.addEventListener("click", () => selectItem(button.dataset.itemNumber));
  });
}

function itemLookupMarkup(item) {
  return `
    <div class="lookup-card">
      <span>Warehouse amount</span>
      <strong>${formatNumber(stockOnHand(item))}</strong>
      <dl>
        <div><dt>Location</dt><dd>${item.location || "-"}</dd></div>
        <div><dt>Shelf</dt><dd>${item.shelf || "-"}</dd></div>
        <div><dt>FG ID</dt><dd>${item.finishGoodId || "-"}</dd></div>
        <div><dt>Product</dt><dd>${item.productName || "-"}</dd></div>
      </dl>
    </div>
  `;
}

function findStockItem(itemNumber) {
  return activeStockRows().find((item) => item.itemNumber.toLowerCase() === itemNumber.toLowerCase());
}

function selectItem(itemNumber) {
  const item = findStockItem(itemNumber);

  if (!item) {
    return;
  }

  elements.adjustmentForm.itemNumber.value = item.itemNumber;
  elements.adjustmentForm.finishGoodId.value = item.finishGoodId || "";

  renderItemLookup();
  setStatus(`${item.itemNumber}: ${formatNumber(stockOnHand(item))} units at location ${item.location || "-"}, shelf ${item.shelf || "-"}.`);
}

function render() {
  renderMetrics();
  renderRefreshMeta();
  renderInventory();
  renderWeekIndex();
  renderHistory();
  renderItemLookup();
  renderInboundUploadPreview();
  renderOutboundUploadPreview();
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

async function postJson(payload) {
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

async function postAdjustment(payload) {
  return postJson(payload);
}

async function handleSubmit(event) {
  event.preventDefault();

  const payload = getFormPayload();

  if (!payload.itemNumber || Number.isNaN(payload.quantity)) {
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
  renderItemLookup();
  setStatus("Form cleared.");
}

function getStockCheckPayload() {
  const formData = new FormData(elements.stockCheckForm);
  fillStockCheckFromItem();

  return {
    action: "stockCheck",
    itemNumber: String(formData.get("itemNumber") || "").trim(),
    productName: String(formData.get("productName") || "").trim(),
    finishGoodId: String(formData.get("finishGoodId") || "").trim(),
    quantity: Number(formData.get("quantity") || 0),
    location: String(formData.get("location") || "").trim(),
    shelf: String(formData.get("shelf") || "").trim(),
  };
}

async function handleStockCheckSubmit(event) {
  event.preventDefault();

  const payload = getStockCheckPayload();

  if (
    !payload.itemNumber ||
    Number.isNaN(payload.quantity) ||
    !payload.location ||
    !payload.shelf
  ) {
    setPanelStatus(elements.checkStatus, "Fill every actual stock field before submitting.", "error");
    return;
  }

  elements.sendCheckBtn.disabled = true;
  setPanelStatus(elements.checkStatus, "Sending actual stock check...");

  try {
    const result = await postJson(payload);
    state.history.unshift({ ...payload, createdAt: new Date().toISOString(), result });
    saveState();
    renderHistory();
    setPanelStatus(
      elements.checkStatus,
      result === "confirmed"
        ? "Actual stock check saved, inbound row added, and shelf updated."
        : "Actual stock check sent. Refresh after the sheet finishes updating.",
      "success",
    );
    window.setTimeout(loadStockFromWebhook, 900);
  } catch (error) {
    setPanelStatus(elements.checkStatus, `Actual stock check failed: ${error.message}`, "error");
  } finally {
    elements.sendCheckBtn.disabled = false;
  }
}

function clearStockCheckForm() {
  elements.stockCheckForm.reset();
  setPanelStatus(elements.checkStatus, "Actual stock check cleared.");
}

function fillStockCheckFromItem() {
  const itemNumber = elements.checkItemNumber.value.trim();
  const item = itemNumber ? findStockItem(itemNumber) : null;

  if (!item) {
    if (itemNumber) {
      setPanelStatus(elements.checkStatus, "No matching item found yet. Refresh stock, then scan again.", "error");
    }
    return;
  }

  elements.checkProductName.value = item.productName;
  elements.checkFinishGoodId.value = item.finishGoodId || "";
  setPanelStatus(elements.checkStatus, `${item.itemNumber}: ${item.productName || "matched item"} / FG ${item.finishGoodId || "-"}.`);
}

function renderInboundUploadPreview() {
  if (!elements.uploadPreview || !elements.sendInboundBtn) {
    return;
  }

  elements.sendInboundBtn.disabled = !state.inboundUploadRows.length;

  if (!state.inboundUploadRows.length) {
    elements.uploadPreview.innerHTML = `<span class="muted-line">Waiting for workbook.</span>`;
    return;
  }

  elements.uploadPreview.innerHTML = uploadPreviewMarkup(state.inboundUploadRows);
}

function renderOutboundUploadPreview() {
  if (!elements.outboundUploadPreview || !elements.sendOutboundBtn) {
    return;
  }

  elements.sendOutboundBtn.disabled = !state.outboundUploadRows.length;

  if (!state.outboundUploadRows.length) {
    elements.outboundUploadPreview.innerHTML = `<span class="muted-line">Waiting for workbook.</span>`;
    return;
  }

  elements.outboundUploadPreview.innerHTML = uploadPreviewMarkup(state.outboundUploadRows);
}

function uploadPreviewMarkup(rows) {
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const previewRows = rows
    .map(
      (row) => `
        <tr>
          <td>${row.itemNumber}</td>
          <td><strong>${formatNumber(row.quantity)}</strong></td>
        </tr>
      `,
    )
    .join("");

  return `
    <div class="upload-summary">
      <span>${formatNumber(rows.length)} rows</span>
      <strong>${formatNumber(totalQuantity)} total units</strong>
    </div>
    <table class="mini-table">
      <thead>
        <tr>
          <th>Item number</th>
          <th>Quantity</th>
        </tr>
      </thead>
      <tbody>${previewRows}</tbody>
    </table>
  `;
}

async function handleInboundFile(file) {
  if (!file) {
    return;
  }

  if (!window.XLSX) {
    setPanelStatus(elements.uploadStatus, "XLSX parser is still loading. Try again in a moment.", "error");
    return;
  }

  setPanelStatus(elements.uploadStatus, `Reading ${file.name}...`);

  try {
    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "" });
    state.inboundUploadRows = normalizeUploadRows(rows);
    renderInboundUploadPreview();

    if (!state.inboundUploadRows.length) {
      setPanelStatus(elements.uploadStatus, "No valid rows found. The workbook needs Item number and Quantity columns.", "error");
      return;
    }

    setPanelStatus(
      elements.uploadStatus,
      `Ready to send ${formatNumber(state.inboundUploadRows.length)} inbound rows from ${firstSheetName}.`,
      "success",
    );
  } catch (error) {
    state.inboundUploadRows = [];
    renderInboundUploadPreview();
    setPanelStatus(elements.uploadStatus, `Could not read workbook: ${error.message}`, "error");
  }
}

function normalizeInboundRows(rows) {
  return normalizeUploadRows(rows);
}

function normalizeUploadRows(rows) {
  return rows
    .map((row) => {
      const itemNumber = String(
        getColumnValue(row, ["Item number", "Item Number", "item number", "item", "Item"]) || "",
      ).trim();
      const quantity = Number(getColumnValue(row, ["Quantity", "quantity", "Qty", "qty"]) || 0);
      const finishGoodId = String(
        getColumnValue(row, ["Finish good ID", "Finished good ID", "Finish Good ID", "FG ID", "fgId"]) || "",
      ).trim();
      const productName = String(
        getColumnValue(row, ["Product name", "Product Name", "productName"]) || "",
      ).trim();
      const shelf = String(getColumnValue(row, ["Shelf", "shelf", "Shelf location", "shelfLocation"]) || "").trim();

      return { finishGoodId, itemNumber, productName, quantity, shelf };
    })
    .filter((row) => row.itemNumber && !Number.isNaN(row.quantity) && row.quantity !== 0);
}

async function handleOutboundFile(file) {
  if (!file) {
    return;
  }

  if (!window.XLSX) {
    setPanelStatus(elements.outboundUploadStatus, "XLSX parser is still loading. Try again in a moment.", "error");
    return;
  }

  setPanelStatus(elements.outboundUploadStatus, `Reading ${file.name}...`);

  try {
    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "" });
    state.outboundUploadRows = normalizeUploadRows(rows);
    renderOutboundUploadPreview();

    if (!state.outboundUploadRows.length) {
      setPanelStatus(elements.outboundUploadStatus, "No valid rows found. The workbook needs Item number and Quantity columns.", "error");
      return;
    }

    setPanelStatus(
      elements.outboundUploadStatus,
      `Ready to send ${formatNumber(state.outboundUploadRows.length)} outbound rows from ${firstSheetName}.`,
      "success",
    );
  } catch (error) {
    state.outboundUploadRows = [];
    renderOutboundUploadPreview();
    setPanelStatus(elements.outboundUploadStatus, `Could not read workbook: ${error.message}`, "error");
  }
}

function getColumnValue(row, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) {
      return row[name];
    }
  }

  const normalizedNames = names.map(normalizeHeader);
  const matchingKey = Object.keys(row).find((key) => normalizedNames.includes(normalizeHeader(key)));
  return matchingKey ? row[matchingKey] : "";
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function exportDropInTemplate(kind) {
  if (!window.ExcelJS) {
    const statusElement = kind === "inbound" ? elements.uploadStatus : elements.outboundUploadStatus;
    setPanelStatus(statusElement, "Excel template exporter is still loading. Try again in a moment.", "error");
    return;
  }

  const title = kind === "inbound" ? "Inbound" : "Outbound";
  const workbook = new window.ExcelJS.Workbook();
  workbook.creator = "NPI Warehouse Management";
  workbook.created = new Date();

  if (kind === "outbound") {
    buildOutboundTemplate(workbook, title);
  } else {
    buildInboundTemplate(workbook, title);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `npi-${kind}-drop-in-template.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildInboundTemplate(workbook, title) {
  const sheet = workbook.addWorksheet(title);
  sheet.addRow(["Item number", "Quantity", "Shelf"]);
  sheet.columns = [{ width: 18 }, { width: 12 }, { width: 16 }];
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  styleTemplateHeader(sheet);

  const shelfCodes = warehouseShelfCodes();
  const layoutSheet = addLayoutWorksheet(workbook);
  const shelfListSheet = workbook.addWorksheet("ShelfList");
  shelfListSheet.state = "veryHidden";
  shelfCodes.forEach((code, index) => {
    shelfListSheet.getCell(index + 1, 1).value = code;
  });

  if (shelfCodes.length) {
    const formula = `ShelfList!$A$1:$A$${shelfCodes.length}`;
    for (let row = 2; row <= 501; row += 1) {
      sheet.getCell(row, 3).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: true,
        errorTitle: "Choose a shelf",
        error: "Pick a shelf from the warehouse layout list.",
      };
    }
  }

  sheet.getCell("A2").note = "Type or scan the item number.";
  sheet.getCell("B2").note = "Type the inbound quantity.";
  sheet.getCell("C2").note = "Choose the shelf from the dropdown. See the Layout sheet.";
  layoutSheet.getCell("A1").note = "Reference sheet only. Use the Inbound sheet to enter item, quantity, and shelf.";
}

function buildOutboundTemplate(workbook, title) {
  const sheet = workbook.addWorksheet(title);
  sheet.addRow(["Finish good ID", "Item number", "Product name", "available", "Quantity"]);
  activeStockRows().forEach((item) => {
    sheet.addRow([item.finishGoodId || "", item.itemNumber || "", item.productName || "", stockOnHand(item), ""]);
  });
  sheet.columns = [{ width: 18 }, { width: 18 }, { width: 36 }, { width: 12 }, { width: 12 }];
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  styleTemplateHeader(sheet);
}

function styleTemplateHeader(sheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0078D4" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };
}

function warehouseLayoutRows() {
  return window.NPI_WAREHOUSE_LAYOUT?.rows || [];
}

function warehouseShelfCodes() {
  return window.NPI_WAREHOUSE_LAYOUT?.shelfCodes || [];
}

function addLayoutWorksheet(workbook) {
  const sheet = workbook.addWorksheet("Layout");
  const rows = warehouseLayoutRows();
  rows.forEach((row) => sheet.addRow(row));
  sheet.columns = Array.from({ length: rows[0]?.length || 1 }, () => ({ width: 13 }));
  sheet.views = [{ state: "frozen", ySplit: 3 }];

  rows.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      const cell = sheet.getCell(rowIndex + 1, colIndex + 1);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD2D0CE" } },
        left: { style: "thin", color: { argb: "FFD2D0CE" } },
        bottom: { style: "thin", color: { argb: "FFD2D0CE" } },
        right: { style: "thin", color: { argb: "FFD2D0CE" } },
      };

      if (!value) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F8F8" } };
        return;
      }

      if (warehouseShelfCodes().includes(String(value))) {
        cell.font = { bold: true, color: { argb: "FF201F1E" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F2FB" } };
      } else {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF605E5C" } };
      }
    });
  });

  return sheet;
}

async function sendInboundUpload() {
  if (!state.inboundUploadRows.length) {
    setPanelStatus(elements.uploadStatus, "Drop an inbound workbook first.", "error");
    return;
  }

  elements.sendInboundBtn.disabled = true;
  setPanelStatus(elements.uploadStatus, "Sending inbound rows...");

  try {
    const result = await postJson({ action: "inboundBulk", rows: state.inboundUploadRows });
    setPanelStatus(
      elements.uploadStatus,
      result === "confirmed"
        ? `Inbound upload sent: ${formatNumber(state.inboundUploadRows.length)} rows.`
        : "Inbound upload sent. Refresh after the sheet finishes updating.",
      "success",
    );
    state.inboundUploadRows = [];
    elements.xlsxInput.value = "";
    renderInboundUploadPreview();
    window.setTimeout(loadStockFromWebhook, 900);
  } catch (error) {
    setPanelStatus(elements.uploadStatus, `Inbound upload failed: ${error.message}`, "error");
    renderInboundUploadPreview();
  }
}

function clearInboundUpload() {
  state.inboundUploadRows = [];
  elements.xlsxInput.value = "";
  renderInboundUploadPreview();
  setPanelStatus(elements.uploadStatus, "Upload cleared.");
}

async function sendOutboundUpload() {
  if (!state.outboundUploadRows.length) {
    setPanelStatus(elements.outboundUploadStatus, "Drop an outbound workbook first.", "error");
    return;
  }

  elements.sendOutboundBtn.disabled = true;
  setPanelStatus(elements.outboundUploadStatus, "Sending outbound rows...");

  try {
    const result = await postJson({ action: "outboundBulk", rows: state.outboundUploadRows });
    setPanelStatus(
      elements.outboundUploadStatus,
      result === "confirmed"
        ? `Outbound upload sent: ${formatNumber(state.outboundUploadRows.length)} rows.`
        : "Outbound upload sent. Refresh after the sheet finishes updating.",
      "success",
    );
    state.outboundUploadRows = [];
    elements.outboundXlsxInput.value = "";
    renderOutboundUploadPreview();
    window.setTimeout(loadStockFromWebhook, 900);
  } catch (error) {
    setPanelStatus(elements.outboundUploadStatus, `Outbound upload failed: ${error.message}`, "error");
    renderOutboundUploadPreview();
  }
}

function clearOutboundUpload() {
  state.outboundUploadRows = [];
  elements.outboundXlsxInput.value = "";
  renderOutboundUploadPreview();
  setPanelStatus(elements.outboundUploadStatus, "Upload cleared.");
}

function exportInventoryCsv() {
  const header = ["finishGoodId", "itemNumber", "productName", "quantity", "location", "shelf", "total", "family"];
  const rows = activeStockRows().map((item) =>
    header.map((key) => `"${String(item[key]).replaceAll('"', '""')}"`).join(","),
  );
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `npi-total-stock-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

elements.adjustmentForm.addEventListener("input", renderItemLookup);
elements.adjustmentForm.addEventListener("change", renderItemLookup);
elements.adjustmentForm.addEventListener("submit", handleSubmit);
elements.stockCheckForm.addEventListener("submit", handleStockCheckSubmit);
elements.checkItemNumber.addEventListener("input", fillStockCheckFromItem);
elements.checkItemNumber.addEventListener("change", fillStockCheckFromItem);
elements.checkItemNumber.addEventListener("blur", fillStockCheckFromItem);
elements.clearBtn.addEventListener("click", clearForm);
elements.clearCheckBtn.addEventListener("click", clearStockCheckForm);
elements.clearOutboundUploadBtn.addEventListener("click", clearOutboundUpload);
elements.clearUploadBtn.addEventListener("click", clearInboundUpload);
elements.exportBtn.addEventListener("click", exportInventoryCsv);
elements.inboundTemplateBtn.addEventListener("click", () => exportDropInTemplate("inbound"));
elements.outboundTemplateBtn.addEventListener("click", () => exportDropInTemplate("outbound"));
elements.refreshBtn.addEventListener("click", loadStockFromWebhook);
elements.sendInboundBtn.addEventListener("click", sendInboundUpload);
elements.sendOutboundBtn.addEventListener("click", sendOutboundUpload);
elements.xlsxInput.addEventListener("change", (event) => handleInboundFile(event.target.files[0]));
elements.outboundXlsxInput.addEventListener("change", (event) => handleOutboundFile(event.target.files[0]));
elements.xlsxDropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.xlsxDropZone.classList.add("dragging");
});
elements.xlsxDropZone.addEventListener("dragleave", () => {
  elements.xlsxDropZone.classList.remove("dragging");
});
elements.xlsxDropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  elements.xlsxDropZone.classList.remove("dragging");
  handleInboundFile(event.dataTransfer.files[0]);
});
elements.outboundXlsxDropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.outboundXlsxDropZone.classList.add("dragging");
});
elements.outboundXlsxDropZone.addEventListener("dragleave", () => {
  elements.outboundXlsxDropZone.classList.remove("dragging");
});
elements.outboundXlsxDropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  elements.outboundXlsxDropZone.classList.remove("dragging");
  handleOutboundFile(event.dataTransfer.files[0]);
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
elements.weekSelect.addEventListener("change", (event) => {
  state.selectedWeek = event.target.value;
  renderWeekIndex();
});

render();
loadStockFromWebhook();
window.setInterval(() => loadStockFromWebhook({ silent: true }), 10000);
