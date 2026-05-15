const DB_NAME = "dataset-indexer";
const DB_VERSION = 1;
const STORE_NAME = "folder-indexes";
const LATEST_CACHE_ID = "latest";
const RENDER_LIMIT = 5000;

const state = {
  rows: [],
  filteredRows: [],
  currentFolderHandle: null,
  currentFolderName: "",
  lastCache: null,
  renderLimit: RENDER_LIMIT,
};

const el = {
  selectFolderBtn: document.getElementById("selectFolderBtn"),
  fallbackFolderBtn: document.getElementById("fallbackFolderBtn"),
  folderInput: document.getElementById("folderInput"),
  refreshBtn: document.getElementById("refreshBtn"),
  loadCacheBtn: document.getElementById("loadCacheBtn"),
  clearCacheBtn: document.getElementById("clearCacheBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  quickFind: document.getElementById("quickFind"),
  quickMode: document.getElementById("quickMode"),
  quickScope: document.getElementById("quickScope"),
  batchFind: document.getElementById("batchFind"),
  batchMode: document.getElementById("batchMode"),
  batchScope: document.getElementById("batchScope"),
  folderName: document.getElementById("folderName"),
  indexedCount: document.getElementById("indexedCount"),
  visibleCount: document.getElementById("visibleCount"),
  cacheState: document.getElementById("cacheState"),
  resultBody: document.getElementById("resultBody"),
  rowTemplate: document.getElementById("rowTemplate"),
  resultSummary: document.getElementById("resultSummary"),
  cacheSummary: document.getElementById("cacheSummary"),
  progressArea: document.getElementById("progressArea"),
  progressText: document.getElementById("progressText"),
  progressMeta: document.getElementById("progressMeta"),
  progressBar: document.getElementById("progressBar"),
};

init();

function init() {
  el.selectFolderBtn.addEventListener("click", selectFolder);
  el.fallbackFolderBtn.addEventListener("click", () => el.folderInput.click());
  el.folderInput.addEventListener("change", indexFallbackFiles);
  el.refreshBtn.addEventListener("click", refreshCurrentFolder);
  el.loadCacheBtn.addEventListener("click", loadLatestCache);
  el.clearCacheBtn.addEventListener("click", clearCache);
  el.exportCsvBtn.addEventListener("click", exportCsv);
  el.clearFiltersBtn.addEventListener("click", clearFilters);

  for (const control of [el.quickFind, el.quickMode, el.quickScope, el.batchFind, el.batchMode, el.batchScope]) {
    control.addEventListener("input", applyFilters);
    control.addEventListener("change", applyFilters);
  }

  updateCacheBadge();
  applyFilters();
}

async function selectFolder() {
  if (!("showDirectoryPicker" in window)) {
    el.folderInput.click();
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({ mode: "read" });
    state.currentFolderHandle = handle;
    state.currentFolderName = handle.name || "Selected folder";
    await indexFromDirectoryHandle(handle, "Folder selected");
  } catch (error) {
    if (error && error.name === "AbortError") {
      return;
    }
    setResultSummary(`Folder selection failed: ${error.message || error}`);
  }
}

async function refreshCurrentFolder() {
  if (!state.currentFolderHandle) {
    setResultSummary("Select a folder first, then refresh data.");
    return;
  }
  await indexFromDirectoryHandle(state.currentFolderHandle, "Refresh data");
}

async function indexFromDirectoryHandle(handle, actionLabel) {
  const previousCache = await readCache(LATEST_CACHE_ID);
  const previousRows = mapRowsByPath(previousCache ? previousCache.rows : []);
  const previousSignatures = previousCache ? previousCache.signatures || {} : {};
  const rows = [];
  const signatures = {};
  const stats = { scanned: 0, reused: 0, changed: 0 };

  showProgress(`${actionLabel}: scanning folder metadata`, 0, "");

  try {
    for await (const entry of walkDirectory(handle)) {
      stats.scanned += 1;
      const row = rowFromFile(entry.file, entry.path);
      const cachedRow = previousRows.get(row.path);

      signatures[row.path] = row.signature;
      if (cachedRow && previousSignatures[row.path] === row.signature) {
        rows.push(cachedRow);
        stats.reused += 1;
      } else {
        rows.push(stripPrivateFields(row));
        stats.changed += 1;
      }

      if (stats.scanned % 100 === 0) {
        showProgress(`${actionLabel}: scanning folder metadata`, null, `${stats.scanned.toLocaleString()} files`);
        await yieldFrame();
      }
    }

    rows.sort(sortRows);
    await saveCache({
      id: LATEST_CACHE_ID,
      rootName: handle.name || "Selected folder",
      indexedAt: Date.now(),
      rows,
      signatures,
      source: "directory-picker",
      stats,
    });

    state.rows = rows;
    state.currentFolderName = handle.name || state.currentFolderName;
    state.lastCache = { rootName: state.currentFolderName, indexedAt: Date.now(), stats };
    setFolderBadge(state.currentFolderName);
    setCacheSummary(stats);
    applyFilters();
  } catch (error) {
    setResultSummary(`Indexing failed: ${error.message || error}`);
  } finally {
    hideProgress();
    updateButtons();
    updateCacheBadge();
  }
}

async function indexFallbackFiles(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) {
    return;
  }

  const rootName = inferRootName(files);
  const previousCache = await readCache(LATEST_CACHE_ID);
  const previousRows = mapRowsByPath(previousCache ? previousCache.rows : []);
  const previousSignatures = previousCache ? previousCache.signatures || {} : {};
  const rows = [];
  const signatures = {};
  const stats = { scanned: 0, reused: 0, changed: 0 };

  showProgress("Scanning selected files", 0, `${files.length.toLocaleString()} files`);

  for (const file of files) {
    const relativePath = normalizePath(file.webkitRelativePath || file.name);
    const row = rowFromFile(file, relativePath);
    const cachedRow = previousRows.get(row.path);
    stats.scanned += 1;
    signatures[row.path] = row.signature;

    if (cachedRow && previousSignatures[row.path] === row.signature) {
      rows.push(cachedRow);
      stats.reused += 1;
    } else {
      rows.push(stripPrivateFields(row));
      stats.changed += 1;
    }

    if (stats.scanned % 250 === 0) {
      showProgress("Scanning selected files", stats.scanned / files.length, `${stats.scanned.toLocaleString()} of ${files.length.toLocaleString()}`);
      await yieldFrame();
    }
  }

  rows.sort(sortRows);
  await saveCache({
    id: LATEST_CACHE_ID,
    rootName,
    indexedAt: Date.now(),
    rows,
    signatures,
    source: "file-input",
    stats,
  });

  state.currentFolderHandle = null;
  state.currentFolderName = rootName;
  state.rows = rows;
  state.lastCache = { rootName, indexedAt: Date.now(), stats };
  setFolderBadge(rootName);
  setCacheSummary(stats);
  hideProgress();
  updateButtons();
  updateCacheBadge();
  applyFilters();
  event.target.value = "";
}

async function* walkDirectory(directoryHandle, prefix = "") {
  for await (const [name, handle] of directoryHandle.entries()) {
    const relativePath = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "file") {
      const file = await handle.getFile();
      yield { file, path: normalizePath(relativePath) };
    } else if (handle.kind === "directory") {
      yield* walkDirectory(handle, relativePath);
    }
  }
}

function rowFromFile(file, relativePath) {
  const modifiedMs = Number(file.lastModified || 0);
  const type = getFileType(file.name, file.type);
  const path = normalizePath(relativePath);
  return {
    name: file.name,
    path,
    modified: formatDate(modifiedMs),
    type,
    signature: `${path}\u001f${file.size || 0}\u001f${modifiedMs}\u001f${file.type || ""}`,
  };
}

function stripPrivateFields(row) {
  return {
    name: row.name,
    path: row.path,
    modified: row.modified,
    type: row.type,
  };
}

function getFileType(fileName, mimeType) {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex > -1 && dotIndex < fileName.length - 1) {
    return fileName.slice(dotIndex + 1).toUpperCase();
  }
  return mimeType ? mimeType : "No extension";
}

function formatDate(ms) {
  if (!ms) {
    return "";
  }
  return new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function applyFilters() {
  const quickNeedle = el.quickFind.value.trim();
  const quickMode = el.quickMode.value;
  const quickScope = el.quickScope.value;
  const batchTerms = parseTerms(el.batchFind.value);
  const batchMode = el.batchMode.value;
  const batchScope = el.batchScope.value;

  state.filteredRows = state.rows.filter((row) => {
    const quickTerms = quickMode === "isOneOf" ? parseTerms(quickNeedle) : [quickNeedle];
    const quickOk = !quickNeedle || matches(row, quickTerms, quickMode, quickScope);
    const batchOk = batchTerms.length === 0 || matches(row, batchTerms, batchMode, batchScope);
    return quickOk && batchOk;
  });

  renderRows();
  updateCounts();
  updateButtons();
}

function matches(row, rawTerms, mode, scope) {
  const terms = rawTerms.map(normalizeTerm).filter(Boolean);
  if (!terms.length) {
    return true;
  }

  const fields = getScopedValues(row, scope).map(normalizeTerm);

  if (mode === "containsAll") {
    return terms.every((term) => fields.some((value) => value.includes(term)));
  }

  if (mode === "contains") {
    return terms.some((term) => fields.some((value) => value.includes(term)));
  }

  if (mode === "exact" || mode === "isOneOf") {
    return terms.some((term) => fields.some((value) => value === term));
  }

  return false;
}

function getScopedValues(row, scope) {
  if (scope === "all") {
    return [row.name, row.path, row.modified, row.type];
  }
  return [row[scope] || ""];
}

function parseTerms(value) {
  return value
    .split(/[\n\r,;\t]+/g)
    .map((term) => term.trim())
    .filter(Boolean);
}

function normalizeTerm(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function renderRows() {
  el.resultBody.textContent = "";

  if (!state.rows.length) {
    renderEmpty("Select a folder or load the last cache.");
    setResultSummary("No data loaded");
    return;
  }

  if (!state.filteredRows.length) {
    renderEmpty("No matching files.");
    setResultSummary("No matches");
    return;
  }

  const fragment = document.createDocumentFragment();
  const rowsToRender = state.filteredRows.slice(0, state.renderLimit);

  for (const row of rowsToRender) {
    const tr = el.rowTemplate.content.firstElementChild.cloneNode(true);
    tr.querySelector('[data-field="name"]').textContent = row.name;
    tr.querySelector('[data-field="path"]').textContent = row.path;
    tr.querySelector('[data-field="modified"]').textContent = row.modified;
    tr.querySelector('[data-field="type"]').textContent = row.type;
    fragment.appendChild(tr);
  }

  el.resultBody.appendChild(fragment);

  const extra = state.filteredRows.length > state.renderLimit
    ? `, showing first ${state.renderLimit.toLocaleString()}`
    : "";
  setResultSummary(`${state.filteredRows.length.toLocaleString()} result${state.filteredRows.length === 1 ? "" : "s"}${extra}`);
}

function renderEmpty(message) {
  const tr = document.createElement("tr");
  tr.className = "empty-row";
  const td = document.createElement("td");
  td.colSpan = 4;
  td.textContent = message;
  tr.appendChild(td);
  el.resultBody.appendChild(tr);
}

async function loadLatestCache() {
  const cache = await readCache(LATEST_CACHE_ID);
  if (!cache || !Array.isArray(cache.rows)) {
    setResultSummary("No cached index found.");
    return;
  }

  state.rows = cache.rows;
  state.currentFolderName = cache.rootName || "Cached folder";
  state.lastCache = cache;
  setFolderBadge(`${state.currentFolderName} (cache)`);
  setCacheSummary(cache.stats || null, cache.indexedAt);
  applyFilters();
  updateButtons();
  updateCacheBadge();
}

async function clearCache() {
  await deleteCache(LATEST_CACHE_ID);
  state.lastCache = null;
  el.cacheSummary.textContent = "";
  await updateCacheBadge();
}

function clearFilters() {
  el.quickFind.value = "";
  el.quickMode.value = "contains";
  el.quickScope.value = "all";
  el.batchFind.value = "";
  el.batchMode.value = "exact";
  el.batchScope.value = "all";
  applyFilters();
}

function exportCsv() {
  if (!state.filteredRows.length) {
    return;
  }

  const header = ["Name", "Path", "Date modified", "File type"];
  const lines = [header.map(csvCell).join(",")];
  for (const row of state.filteredRows) {
    lines.push([row.name, row.path, row.modified, row.type].map(csvCell).join(","));
  }

  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.href = url;
  link.download = `dataset-index-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value || "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function mapRowsByPath(rows) {
  const map = new Map();
  for (const row of rows || []) {
    map.set(row.path, row);
  }
  return map;
}

function sortRows(a, b) {
  return a.path.localeCompare(b.path, undefined, { sensitivity: "base", numeric: true });
}

function normalizePath(path) {
  return String(path || "").replace(/\\/g, "/");
}

function inferRootName(files) {
  const firstPath = files[0] && files[0].webkitRelativePath;
  if (firstPath && firstPath.includes("/")) {
    return firstPath.split("/")[0] || "Selected files";
  }
  return "Selected files";
}

function setFolderBadge(name) {
  el.folderName.textContent = name || "No folder selected";
}

function updateCounts() {
  el.indexedCount.textContent = `${state.rows.length.toLocaleString()} file${state.rows.length === 1 ? "" : "s"}`;
  el.visibleCount.textContent = `${state.filteredRows.length.toLocaleString()} file${state.filteredRows.length === 1 ? "" : "s"}`;
}

function updateButtons() {
  el.refreshBtn.disabled = !state.currentFolderHandle;
  el.exportCsvBtn.disabled = state.filteredRows.length === 0;
}

function setResultSummary(text) {
  el.resultSummary.textContent = text;
}

function setCacheSummary(stats, indexedAt) {
  const parts = [];
  if (stats) {
    parts.push(`${Number(stats.reused || 0).toLocaleString()} reused`);
    parts.push(`${Number(stats.changed || 0).toLocaleString()} new/changed`);
  }
  const stamp = indexedAt ? new Date(indexedAt).toLocaleString() : new Date().toLocaleString();
  parts.push(`cached ${stamp}`);
  el.cacheSummary.textContent = parts.join(" | ");
}

async function updateCacheBadge() {
  const cache = await readCache(LATEST_CACHE_ID);
  if (cache && Array.isArray(cache.rows)) {
    el.cacheState.textContent = `${cache.rows.length.toLocaleString()} files`;
  } else {
    el.cacheState.textContent = "Empty";
  }
}

function showProgress(text, fraction, meta) {
  el.progressArea.hidden = false;
  el.progressText.textContent = text;
  el.progressMeta.textContent = meta || "";
  if (typeof fraction === "number") {
    const bounded = Math.max(0, Math.min(1, fraction));
    el.progressBar.style.width = `${Math.round(bounded * 100)}%`;
  } else {
    el.progressBar.style.width = "55%";
  }
}

function hideProgress() {
  el.progressArea.hidden = true;
  el.progressBar.style.width = "0%";
}

function yieldFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCache(id) {
  const db = await openDb();
  return transactionRequest(db, "readonly", (store) => store.get(id));
}

async function saveCache(payload) {
  const db = await openDb();
  return transactionRequest(db, "readwrite", (store) => store.put(payload));
}

async function deleteCache(id) {
  const db = await openDb();
  return transactionRequest(db, "readwrite", (store) => store.delete(id));
}

function transactionRequest(db, mode, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = operation(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
