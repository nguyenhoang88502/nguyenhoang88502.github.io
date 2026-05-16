const WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbx3gpYGoOY81E3J85TvZNllrmc6fBzessoQVicZr18G5uornSqX7Cgk_TGZ1D_-XUTS/exec";
const STORAGE_KEY = "npiWarehouseTotal.v2";

const dashboardState = {
  inventory: loadJson(STORAGE_KEY, []),
  weekIndex: [],
  inboundSkuLastWeek: 0,
  selectedItem: null,
  selectedShelfKey: "",
  isLoading: false,
};

const dashboardElements = {
  refreshBtn: document.querySelector("#dashboardRefreshBtn"),
  refreshMeta: document.querySelector("#dashboardRefreshMeta"),
  skuCount: document.querySelector("#dashboardSkuCount"),
  unitCount: document.querySelector("#dashboardUnitCount"),
  inboundSkuLastWeek: document.querySelector("#dashboardInboundSkuLastWeek"),
  searchInput: document.querySelector("#dashboardSearchInput"),
  result: document.querySelector("#dashboardResult"),
  layoutGrid: document.querySelector("#warehouseLayoutGrid"),
  matchBadge: document.querySelector("#layoutMatchBadge"),
};

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveInventory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboardState.inventory));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
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

function stockOnHand(item) {
  return Number(item.total || item.quantity) || 0;
}

function activeStockRows() {
  return dashboardState.inventory.filter((item) => stockOnHand(item) !== 0);
}

function normalizeKey(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function layoutShelfCodeSet() {
  return new Set((window.NPI_WAREHOUSE_LAYOUT?.shelfCodes || []).map(normalizeKey));
}

function parentSections() {
  return [
    { label: "B", rowStart: 4, rowEnd: 8, colStart: 1, colEnd: 2 },
    { label: "D", rowStart: 4, rowEnd: 8, colStart: 5, colEnd: 6 },
    { label: "F", rowStart: 4, rowEnd: 8, colStart: 6, colEnd: 7 },
    { label: "H", rowStart: 4, rowEnd: 8, colStart: 10, colEnd: 11 },
    { label: "K", rowStart: 4, rowEnd: 8, colStart: 11, colEnd: 12 },
    { label: "M", rowStart: 4, rowEnd: 8, colStart: 15, colEnd: 16 },
    { label: "O", rowStart: 4, rowEnd: 8, colStart: 16, colEnd: 17 },
    { label: "A", rowStart: 8, rowEnd: 12, colStart: 1, colEnd: 2 },
    { label: "C", rowStart: 8, rowEnd: 12, colStart: 5, colEnd: 6 },
    { label: "E", rowStart: 8, rowEnd: 12, colStart: 6, colEnd: 7 },
    { label: "G", rowStart: 8, rowEnd: 12, colStart: 10, colEnd: 11 },
    { label: "I", rowStart: 8, rowEnd: 12, colStart: 11, colEnd: 12 },
    { label: "L", rowStart: 8, rowEnd: 12, colStart: 15, colEnd: 16 },
    { label: "N", rowStart: 8, rowEnd: 12, colStart: 16, colEnd: 17 },
  ];
}

function skippedParentCells() {
  const skipped = new Set([
    "3:5",
    "3:6",
    "3:10",
    "3:11",
    "3:15",
    "3:16",
    "8:5",
    "8:6",
    "8:10",
    "8:11",
    "8:15",
    "8:16",
  ]);

  parentSections().forEach((section) => {
    for (let row = section.rowStart; row < section.rowEnd; row += 1) {
      for (let column = section.colStart; column < section.colEnd; column += 1) {
        skipped.add(`${row}:${column}`);
      }
    }
  });

  return skipped;
}

function itemShelfCode(item) {
  const shelfCodes = layoutShelfCodeSet();
  const location = normalizeKey(item?.location);
  const shelf = normalizeKey(item?.shelf);
  const combined = `${location}${shelf}`;

  if (shelfCodes.has(shelf)) {
    return item.shelf;
  }

  if (location && shelf && shelfCodes.has(combined)) {
    return combined;
  }

  return item?.shelf || item?.location || "";
}

function renderMetrics() {
  const rows = activeStockRows();
  dashboardElements.skuCount.textContent = formatNumber(rows.length);
  dashboardElements.unitCount.textContent = formatNumber(rows.reduce((sum, item) => sum + stockOnHand(item), 0));
  dashboardElements.inboundSkuLastWeek.textContent = formatNumber(dashboardState.inboundSkuLastWeek);
}

function renderLayout() {
  const rows = (window.NPI_WAREHOUSE_LAYOUT?.rows || [])
    .slice(0, 13)
    .map((row) => row.slice(0, 17));
  const shelfCodes = layoutShelfCodeSet();
  const selectedShelf = dashboardState.selectedShelfKey || normalizeKey(itemShelfCode(dashboardState.selectedItem));
  const columnCount = rows[0]?.length || 1;
  const skipped = skippedParentCells();
  const parentMarkup = parentSections()
    .map(
      (section) => `
        <div
          class="layout-cell parent"
          style="grid-row:${section.rowStart} / ${section.rowEnd}; grid-column:${section.colStart} / ${section.colEnd};"
        >${section.label}</div>
      `,
    )
    .join("");
  const cellMarkup = rows
    .map((row, rowIndex) =>
      row
        .map((value, columnIndex) => {
          const rowNumber = rowIndex + 1;
          const columnNumber = columnIndex + 1;

          if (skipped.has(`${rowNumber}:${columnNumber}`)) {
            return "";
          }

          const key = normalizeKey(value);
          const classes = ["layout-cell"];
          if (!value) {
            classes.push("empty");
          } else if (shelfCodes.has(key)) {
            classes.push("shelf");
          } else {
            classes.push("label");
          }
          if (selectedShelf && key === selectedShelf) {
            classes.push("highlight");
          }

          const tag = shelfCodes.has(key) ? "button" : "div";
          const type = shelfCodes.has(key) ? ' type="button"' : "";
          return `<${tag}${type} class="${classes.join(" ")}" data-shelf-key="${key}" style="grid-row:${rowNumber}; grid-column:${columnNumber};">${escapeHtml(value)}</${tag}>`;
        })
        .join(""),
    )
    .join("");

  dashboardElements.layoutGrid.style.setProperty("--layout-columns", columnCount);
  dashboardElements.layoutGrid.style.setProperty("--layout-rows", rows.length);
  dashboardElements.layoutGrid.innerHTML = parentMarkup + cellMarkup;

  dashboardElements.layoutGrid.querySelectorAll(".layout-cell.shelf").forEach((cell) => {
    cell.addEventListener("click", () => selectShelf(cell.dataset.shelfKey));
  });
}

function itemsForShelf(shelfKey) {
  const normalizedShelf = normalizeKey(shelfKey);
  return activeStockRows().filter((item) => normalizeKey(itemShelfCode(item)) === normalizedShelf);
}

function selectShelf(shelfKey) {
  dashboardState.selectedShelfKey = normalizeKey(shelfKey);
  const items = itemsForShelf(dashboardState.selectedShelfKey);
  dashboardState.selectedItem = items[0] || null;
  renderShelfResult(dashboardState.selectedShelfKey, items);
  renderLayout();
}

function renderShelfResult(shelfKey, items) {
  const shelfLabel = shelfKey || "-";

  if (!items.length) {
    dashboardElements.result.innerHTML = `
      <span>Selected shelf</span>
      <strong>${escapeHtml(shelfLabel)}</strong>
      <p class="shelf-empty">No SKUs assigned to this shelf in the loaded stock.</p>
    `;
    dashboardElements.matchBadge.textContent = `${shelfLabel}: empty in loaded stock`;
    return;
  }

  dashboardElements.result.innerHTML = `
    <span>Selected shelf</span>
    <strong>${escapeHtml(shelfLabel)}</strong>
    <div class="shelf-sku-list">
      <table>
        <thead>
          <tr><th>SKU</th><th>Quantity</th></tr>
        </thead>
        <tbody>
        ${items
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.itemNumber)}</td>
                <td><strong>${formatNumber(stockOnHand(item))}</strong></td>
              </tr>
            `,
          )
          .join("")}
        </tbody>
      </table>
    </div>
  `;
  dashboardElements.matchBadge.textContent = `${shelfLabel}: ${formatNumber(items.length)} SKU${items.length === 1 ? "" : "s"}`;
}

function renderSearchResult() {
  const item = dashboardState.selectedItem;

  if (!item) {
    dashboardState.selectedShelfKey = "";
    dashboardElements.result.innerHTML = `<span>Search an item number to highlight its shelf.</span>`;
    dashboardElements.matchBadge.textContent = "No shelf selected";
    renderLayout();
    return;
  }

  const shelf = itemShelfCode(item);
  dashboardState.selectedShelfKey = normalizeKey(shelf);
  dashboardElements.result.innerHTML = `
    <span>Matched item</span>
    <strong>${escapeHtml(item.itemNumber)}</strong>
    <dl>
      <div><dt>Product</dt><dd>${escapeHtml(item.productName || "-")}</dd></div>
      <div><dt>FG ID</dt><dd>${escapeHtml(item.finishGoodId || "-")}</dd></div>
      <div><dt>Available</dt><dd>${formatNumber(stockOnHand(item))}</dd></div>
      <div><dt>Location</dt><dd>${escapeHtml(item.location || "-")}</dd></div>
      <div><dt>Shelf</dt><dd>${escapeHtml(item.shelf || "-")}</dd></div>
    </dl>
  `;
  dashboardElements.matchBadge.textContent = shelf ? `Highlighting ${shelf}` : "No shelf on stock row";
  renderLayout();
}

function handleSearch() {
  const query = dashboardElements.searchInput.value.trim();

  if (!query) {
    dashboardState.selectedItem = null;
    dashboardState.selectedShelfKey = "";
    renderSearchResult();
    return;
  }

  const normalizedQuery = normalizeKey(query);
  const rows = activeStockRows();
  dashboardState.selectedItem =
    rows.find((item) => normalizeKey(item.itemNumber) === normalizedQuery) ||
    rows.find((item) => normalizeKey(item.finishGoodId) === normalizedQuery) ||
    rows.find((item) => normalizeKey(item.itemNumber).includes(normalizedQuery));

  if (!dashboardState.selectedItem) {
    dashboardState.selectedShelfKey = "";
    dashboardElements.result.innerHTML = `<span>No matching item found in loaded stock.</span>`;
    dashboardElements.matchBadge.textContent = "No shelf selected";
    renderLayout();
    return;
  }

  renderSearchResult();
}

function countInboundSkusLastWeek(weekIndex) {
  const seen = new Set();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  weekIndex.forEach((week) => {
    (Array.isArray(week.inbound) ? week.inbound : []).forEach((entry) => {
      const entryDate = new Date(entry.date);
      if (Number.isNaN(entryDate.getTime()) || entryDate < sevenDaysAgo || entryDate > now || !entry.itemNumber) {
        return;
      }
      seen.add(String(entry.itemNumber).trim());
    });
  });

  return seen.size;
}

async function loadStock({ silent = false } = {}) {
  if (dashboardState.isLoading) {
    return;
  }

  dashboardState.isLoading = true;
  dashboardElements.refreshBtn.disabled = true;
  dashboardElements.refreshMeta.textContent = "Refreshing...";

  try {
    const data = await fetchStockJson();
    applyStockPayload(data);
  } catch (error) {
    try {
      const data = await fetchStockJsonp();
      applyStockPayload(data);
    } catch (jsonpError) {
      console.info("Dashboard stock load failed.", error, jsonpError);
      dashboardElements.refreshMeta.textContent = dashboardState.inventory.length
        ? "Showing cached stock"
        : "Stock unavailable";
      if (!silent) {
        renderMetrics();
        handleSearch();
      }
    }
  } finally {
    dashboardState.isLoading = false;
    dashboardElements.refreshBtn.disabled = false;
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
    const callbackName = `npiDashboardCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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

function applyStockPayload(data) {
  if (!data.ok) {
    throw new Error(data.error || "Stock endpoint returned an error.");
  }

  const sourceRows = Array.isArray(data.total) ? data.total : data.stock;
  dashboardState.inventory = Array.isArray(sourceRows)
    ? sourceRows.map(normalizeStockRow).filter((item) => stockOnHand(item) !== 0)
    : [];
  dashboardState.weekIndex = Array.isArray(data.weekIndex) ? data.weekIndex : [];
  dashboardState.inboundSkuLastWeek = Number(
    data.metrics?.inboundSkuLastWeek || data.inboundSkuLastWeek || countInboundSkusLastWeek(dashboardState.weekIndex),
  );
  saveInventory();
  dashboardElements.refreshMeta.textContent = `Last updated ${new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}`;
  renderMetrics();
  handleSearch();
}

dashboardElements.searchInput.addEventListener("input", handleSearch);
dashboardElements.refreshBtn.addEventListener("click", () => loadStock());

renderMetrics();
renderLayout();
handleSearch();
loadStock();

if (window.lucide) {
  window.lucide.createIcons();
}
