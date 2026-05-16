const WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbx3gpYGoOY81E3J85TvZNllrmc6fBzessoQVicZr18G5uornSqX7Cgk_TGZ1D_-XUTS/exec";
const STORAGE_KEY = "npiWarehouseTotal.v2";

const dashboardState = {
  inventory: loadJson(STORAGE_KEY, []),
  weekIndex: [],
  inboundSkuLastWeek: 0,
  selectedItem: null,
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

function layoutShelfCodeSet() {
  return new Set((window.NPI_WAREHOUSE_LAYOUT?.shelfCodes || []).map(normalizeKey));
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
  const selectedShelf = normalizeKey(itemShelfCode(dashboardState.selectedItem));
  const columnCount = rows[0]?.length || 1;

  dashboardElements.layoutGrid.style.setProperty("--layout-columns", columnCount);
  dashboardElements.layoutGrid.innerHTML = rows
    .map((row) =>
      row
        .map((value) => {
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
          return `<div class="${classes.join(" ")}" data-shelf-key="${key}">${value || ""}</div>`;
        })
        .join(""),
    )
    .join("");

  const highlightedCell = dashboardElements.layoutGrid.querySelector(".layout-cell.highlight");
  if (highlightedCell) {
    highlightedCell.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  }
}

function renderSearchResult() {
  const item = dashboardState.selectedItem;

  if (!item) {
    dashboardElements.result.innerHTML = `<span>Search an item number to highlight its shelf.</span>`;
    dashboardElements.matchBadge.textContent = "No shelf selected";
    renderLayout();
    return;
  }

  const shelf = itemShelfCode(item);
  dashboardElements.result.innerHTML = `
    <span>Matched item</span>
    <strong>${item.itemNumber}</strong>
    <dl>
      <div><dt>Product</dt><dd>${item.productName || "-"}</dd></div>
      <div><dt>FG ID</dt><dd>${item.finishGoodId || "-"}</dd></div>
      <div><dt>Available</dt><dd>${formatNumber(stockOnHand(item))}</dd></div>
      <div><dt>Location</dt><dd>${item.location || "-"}</dd></div>
      <div><dt>Shelf</dt><dd>${item.shelf || "-"}</dd></div>
    </dl>
  `;
  dashboardElements.matchBadge.textContent = shelf ? `Highlighting ${shelf}` : "No shelf on stock row";
  renderLayout();
}

function handleSearch() {
  const query = dashboardElements.searchInput.value.trim();

  if (!query) {
    dashboardState.selectedItem = null;
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
