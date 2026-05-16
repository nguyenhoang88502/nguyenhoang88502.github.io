const SHEETS = {
  OUTBOUND: "Outbound",
  INBOUND: "Inbound",
  TOTAL: "Total",
  DETAIL: "Detailed location",
};

const OUTBOUND = {
  TITLE_CELL: "B2",
  HEADER_ROW: 3,
  FIRST_DATA_ROW: 4,
  FIRST_COL: 1,
  WIDTH: 6,
  HEADERS: ["Date", "Item Number", "Finish Good ID", "Finish Good Name", "Product Name", "Quantity"],
};

const INBOUND = {
  HEADER_ROW: 2,
  FIRST_DATA_ROW: 3,
  FIRST_COL: 1,
  WIDTH: 5,
  HEADERS: ["Date", "Finish Good ID", "Item Number", "Product Name", "Quantity"],
};

const TOTAL = {
  TITLE_CELL: "A1",
  HEADER_ROW: 2,
  FIRST_DATA_ROW: 3,
  FIRST_COL: 1,
  WIDTH: 8,
  HEADERS: ["Finished good ID", "Item number", "Product name", "Quantity", "Location", "Shelf", "Family"],
};

const DETAIL = {
  HEADER_ROW: 1,
  FIRST_DATA_ROW: 2,
  FIRST_COL: 1,
  WIDTH: 6,
  HEADERS: ["Item number", "Product name", "Finish good ID", "Category", "Location", "Shelf"],
};

function doPost(e) {
  try {
    const data = parseRequestBody(e);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = String(data.action || "outbound").trim();

    if (action === "inboundBulk") {
      const result = appendInboundRows(ss, data.rows || []);
      return jsonResponse({
        ok: true,
        mode: "inboundBulk",
        rows: result.rows,
        quantity: result.quantity,
      });
    }

    if (action === "outboundBulk") {
      const result = appendOutboundRows(ss, data.rows || []);
      return jsonResponse({
        ok: true,
        mode: "outboundBulk",
        rows: result.rows,
        quantity: result.quantity,
      });
    }

    if (action === "stockCheck") {
      const result = saveStockCheck(ss, data);
      return jsonResponse({
        ok: true,
        mode: "stockCheck",
        inboundRow: result.inboundRow,
        detailRow: result.detailRow,
        itemNumber: result.itemNumber,
        quantity: result.quantity,
      });
    }

    const result = appendOutbound(ss, data);

    return jsonResponse({
      ok: true,
      mode: "outbound",
      row: result.row,
      itemNumber: result.itemNumber,
      quantity: result.quantity,
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const totalSheet = ss.getSheetByName(SHEETS.TOTAL);

    if (!totalSheet) {
      return outputResponse(e, {
        ok: false,
        error: "Total sheet not found.",
        total: [],
        metrics: { inboundSkuLastWeek: 0 },
        weekIndex: [],
      });
    }

    ensureTotalLayout(totalSheet);
    SpreadsheetApp.flush();

    const total = getTotalRows(totalSheet, ss);
    const metrics = {
      inboundSkuLastWeek: getInboundSkuLastWeek(ss),
    };
    const weekIndex = getWeekIndex(ss);
    const payload = { ok: true, sheet: SHEETS.TOTAL, total: total, metrics: metrics, weekIndex: weekIndex };

    if (e && e.parameter && e.parameter.format === "json") {
      return outputResponse(e, payload);
    }

    return htmlResponse(renderTotalHtml(total, metrics));
  } catch (error) {
    return outputResponse(e, {
      ok: false,
      error: error.message,
      total: [],
      metrics: { inboundSkuLastWeek: 0 },
      weekIndex: [],
    });
  }
}

function appendOutbound(ss, data) {
  const itemNumber = cleanItemNumber(data.itemNumber);
  const quantity = Number(data.quantity);

  if (!itemNumber || Number.isNaN(quantity)) {
    throw new Error("Missing outbound fields: itemNumber, quantity.");
  }

  const sheet = ss.getSheetByName(SHEETS.OUTBOUND) || ss.insertSheet(SHEETS.OUTBOUND);
  ensureOutboundLayout(sheet);

  const row = findNextOutboundRow(sheet);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  ensureRowCapacity(sheet, row);
  sheet.getRange(row, 1, 1, 2).setValues([[today, itemNumber]]);
  sheet.getRange(row, 6).setValue(quantity);

  return { row: row, itemNumber: itemNumber, quantity: quantity };
}

function appendOutboundRows(ss, rows) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error("Missing outbound rows.");
  }

  return rows.reduce(function (result, row) {
    const appended = appendOutbound(ss, row);
    result.rows += 1;
    result.quantity += Number(appended.quantity) || 0;
    return result;
  }, { rows: 0, quantity: 0 });
}

function appendInboundRows(ss, rows) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error("Missing inbound rows.");
  }

  const sheet = ss.getSheetByName(SHEETS.INBOUND) || ss.insertSheet(SHEETS.INBOUND);
  ensureInboundLayout(sheet);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const values = rows.map(function (row) {
    const itemNumber = cleanItemNumber(row.itemNumber);
    const quantity = Number(row.quantity);

    if (!itemNumber || Number.isNaN(quantity)) {
      throw new Error("Each inbound row needs itemNumber and quantity.");
    }

    return [today, itemNumber, quantity];
  });

  const nextRow = findNextInboundRow(sheet);
  const dateValues = values.map(function (row) {
    return [row[0]];
  });
  const itemValues = values.map(function (row) {
    return [row[1]];
  });
  const quantityValues = values.map(function (row) {
    return [row[2]];
  });

  ensureRowCapacity(sheet, nextRow + values.length - 1);
  sheet.getRange(nextRow, 1, values.length, 1).setValues(dateValues);
  sheet.getRange(nextRow, 3, values.length, 1).setValues(itemValues);
  sheet.getRange(nextRow, 5, values.length, 1).setValues(quantityValues);

  return {
    firstRow: nextRow,
    rows: values.length,
    quantity: values.reduce(function (sum, row) {
      return sum + (Number(row[2]) || 0);
    }, 0),
  };
}

function saveStockCheck(ss, data) {
  const itemNumber = cleanItemNumber(data.itemNumber);
  const productName = String(data.productName || lookupProductName(ss, itemNumber) || "").trim();
  const finishGoodId = String(data.finishGoodId || data.fgId || lookupFinishGoodId(ss, itemNumber) || "").trim();
  const quantity = Number(data.quantity);
  const location = String(data.location || "").trim();
  const shelf = String(data.shelf || "").trim();

  if (!itemNumber || Number.isNaN(quantity) || !location || !shelf) {
    throw new Error("Missing stock check fields: itemNumber, quantity, location, shelf.");
  }

  const inbound = appendInboundRows(ss, [{
    itemNumber: itemNumber,
    productName: productName,
    quantity: quantity,
  }]);
  const detailRow = upsertDetailLocation(ss, {
    itemNumber: itemNumber,
    productName: productName,
    finishGoodId: finishGoodId,
    location: location,
    shelf: shelf,
  });

  return {
    inboundRow: inbound.firstRow,
    detailRow: detailRow,
    itemNumber: itemNumber,
    quantity: quantity,
  };
}

function upsertDetailLocation(ss, data) {
  const sheet = ss.getSheetByName(SHEETS.DETAIL) || ss.insertSheet(SHEETS.DETAIL);
  ensureDetailLayout(sheet);

  const row = findDetailRow(sheet, data.itemNumber);

  if (row) {
    sheet.getRange(row, 2).setValue(data.productName);
    sheet.getRange(row, 3).setValue(data.finishGoodId || "");
    sheet.getRange(row, 5).setValue(data.location);
    sheet.getRange(row, 6).setValue(data.shelf);
    return row;
  }

  const nextRow = Math.max(sheet.getLastRow() + 1, DETAIL.FIRST_DATA_ROW);
  ensureRowCapacity(sheet, nextRow);
  sheet.getRange(nextRow, DETAIL.FIRST_COL, 1, DETAIL.WIDTH).setValues([
    [data.itemNumber, data.productName, data.finishGoodId || "", "", data.location, data.shelf],
  ]);

  return nextRow;
}

function getTotalRows(sheet, ss) {
  const lastRow = sheet.getLastRow();

  if (lastRow < TOTAL.FIRST_DATA_ROW) {
    return [];
  }

  const width = Math.max(sheet.getLastColumn(), TOTAL.WIDTH);
  const values = sheet
    .getRange(TOTAL.FIRST_DATA_ROW, TOTAL.FIRST_COL, lastRow - TOTAL.FIRST_DATA_ROW + 1, width)
    .getDisplayValues();

  const header = sheet.getRange(TOTAL.HEADER_ROW, TOTAL.FIRST_COL, 1, width).getDisplayValues()[0];
  const headerMap = buildHeaderMap(header);
  const detailMap = getDetailLookupMap(ss);

  return values
    .filter(function (row) {
      return row.some(function (cell) {
        return String(cell).trim() !== "";
      });
    })
    .map(function (row) {
      const itemNumber = cleanItemNumber(valueByHeader(row, headerMap, ["itemnumber"], 1));
      const sheetFinishGoodId = String(valueByHeader(row, headerMap, ["finishedgoodid", "finishgoodid"], 0) || "").trim();
      const quantity = numberFromDisplay(valueByHeader(row, headerMap, ["quantity"], 3));
      const total = numberFromDisplay(valueByHeader(row, headerMap, ["total"], null));

      return {
        finishGoodId: sheetFinishGoodId || ((detailMap[itemNumber] && detailMap[itemNumber].finishGoodId) || ""),
        itemNumber: itemNumber,
        productName: String(valueByHeader(row, headerMap, ["productname"], 2) || "").trim(),
        quantity: quantity,
        location: String(valueByHeader(row, headerMap, ["location"], 4) || "").trim(),
        shelf: String(valueByHeader(row, headerMap, ["shelf"], 5) || "").trim(),
        total: total || quantity,
        family: String(valueByHeader(row, headerMap, ["family"], 6) || "").trim(),
      };
    })
    .filter(function (item) {
      return item.itemNumber && Number(item.total || item.quantity) !== 0;
    });
}

function getInboundSkuLastWeek(ss) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const seen = {};

  getInboundRows(ss).forEach(function (entry) {
    if (!entry.date || entry.date < sevenDaysAgo || entry.date > now || !entry.itemNumber) {
      return;
    }

    seen[entry.itemNumber] = true;
  });

  return Object.keys(seen).length;
}

function getWeekIndex(ss) {
  const weeks = {};

  getInboundRows(ss).forEach(function (entry) {
    addWeekEntry(weeks, entry, "inbound");
  });

  getOutboundRows(ss).forEach(function (entry) {
    addWeekEntry(weeks, entry, "outbound");
  });

  return Object.keys(weeks)
    .sort()
    .reverse()
    .map(function (weekKey) {
      const week = weeks[weekKey];
      week.inbound.sort(sortByDate);
      week.outbound.sort(sortByDate);
      return week;
    });
}

function getInboundRows(ss) {
  const sheet = ss.getSheetByName(SHEETS.INBOUND);

  if (!sheet || sheet.getLastRow() < INBOUND.FIRST_DATA_ROW) {
    return [];
  }

  const rowCount = sheet.getLastRow() - INBOUND.FIRST_DATA_ROW + 1;
  const values = sheet.getRange(INBOUND.FIRST_DATA_ROW, INBOUND.FIRST_COL, rowCount, INBOUND.WIDTH).getValues();

  return values
    .map(function (row) {
      return {
        date: row[0] instanceof Date ? row[0] : null,
        finishGoodId: String(row[1] || "").trim(),
        itemNumber: cleanItemNumber(row[2]),
        productName: String(row[3] || "").trim(),
        quantity: Number(row[4]) || 0,
      };
    })
    .filter(function (entry) {
      return entry.date && entry.itemNumber && entry.quantity !== 0;
    });
}

function getOutboundRows(ss) {
  const sheet = ss.getSheetByName(SHEETS.OUTBOUND);

  if (!sheet || sheet.getLastRow() < OUTBOUND.FIRST_DATA_ROW) {
    return [];
  }

  const rowCount = sheet.getLastRow() - OUTBOUND.FIRST_DATA_ROW + 1;
  const values = sheet.getRange(OUTBOUND.FIRST_DATA_ROW, OUTBOUND.FIRST_COL, rowCount, OUTBOUND.WIDTH).getValues();

  return values
    .map(function (row) {
      return {
        date: row[0] instanceof Date ? row[0] : null,
        itemNumber: cleanItemNumber(row[1]),
        finishGoodId: String(row[2] || "").trim(),
        productName: String(row[4] || "").trim(),
        quantity: Number(row[5]) || 0,
      };
    })
    .filter(function (entry) {
      return entry.date && entry.itemNumber && entry.quantity !== 0;
    });
}

function addWeekEntry(weeks, entry, flow) {
  const info = getWeekInfo(entry.date);

  if (!weeks[info.weekKey]) {
    weeks[info.weekKey] = {
      weekKey: info.weekKey,
      label: info.label,
      inboundQty: 0,
      outboundQty: 0,
      inbound: [],
      outbound: [],
    };
  }

  const normalizedEntry = {
    date: Utilities.formatDate(entry.date, Session.getScriptTimeZone(), "yyyy-MM-dd"),
    itemNumber: entry.itemNumber,
    finishGoodId: entry.finishGoodId || "",
    productName: entry.productName,
    quantity: entry.quantity,
  };

  if (flow === "inbound") {
    weeks[info.weekKey].inboundQty += entry.quantity;
    weeks[info.weekKey].inbound.push(normalizedEntry);
  } else {
    weeks[info.weekKey].outboundQty += entry.quantity;
    weeks[info.weekKey].outbound.push(normalizedEntry);
  }
}

function getWeekInfo(date) {
  const weekDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = weekDate.getDay() || 7;
  weekDate.setDate(weekDate.getDate() + 4 - day);
  const yearStart = new Date(weekDate.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((weekDate - yearStart) / 86400000) + 1) / 7);
  const year = weekDate.getFullYear();
  const paddedWeek = String(weekNumber).padStart(2, "0");

  return {
    weekKey: year + "-W" + paddedWeek,
    label: "Week " + paddedWeek + " / " + year,
  };
}

function sortByDate(a, b) {
  return String(a.date).localeCompare(String(b.date));
}

function ensureOutboundLayout(sheet) {
  sheet.getRange(OUTBOUND.TITLE_CELL).setValue("WMS — Warehouse Management System");
  sheet.getRange(OUTBOUND.HEADER_ROW, OUTBOUND.FIRST_COL, 1, OUTBOUND.WIDTH).setValues([OUTBOUND.HEADERS]);
}

function findNextOutboundRow(sheet) {
  const maxRows = sheet.getMaxRows();

  if (maxRows < OUTBOUND.FIRST_DATA_ROW) {
    return OUTBOUND.FIRST_DATA_ROW;
  }

  const rowCount = maxRows - OUTBOUND.FIRST_DATA_ROW + 1;
  const dateValues = sheet.getRange(OUTBOUND.FIRST_DATA_ROW, 1, rowCount, 1).getDisplayValues();
  const itemValues = sheet.getRange(OUTBOUND.FIRST_DATA_ROW, 2, rowCount, 1).getDisplayValues();
  const quantityValues = sheet.getRange(OUTBOUND.FIRST_DATA_ROW, 6, rowCount, 1).getDisplayValues();

  for (let i = 0; i < rowCount; i++) {
    const hasActualOutboundData =
      String(dateValues[i][0] || "").trim() !== "" ||
      String(itemValues[i][0] || "").trim() !== "" ||
      String(quantityValues[i][0] || "").trim() !== "";

    if (!hasActualOutboundData) {
      return OUTBOUND.FIRST_DATA_ROW + i;
    }
  }

  return maxRows + 1;
}

function ensureInboundLayout(sheet) {
  sheet.getRange(INBOUND.HEADER_ROW, INBOUND.FIRST_COL, 1, INBOUND.WIDTH).setValues([INBOUND.HEADERS]);
}

function findNextInboundRow(sheet) {
  const maxRows = sheet.getMaxRows();

  if (maxRows < INBOUND.FIRST_DATA_ROW) {
    return INBOUND.FIRST_DATA_ROW;
  }

  const rowCount = maxRows - INBOUND.FIRST_DATA_ROW + 1;
  const dateValues = sheet.getRange(INBOUND.FIRST_DATA_ROW, 1, rowCount, 1).getDisplayValues();
  const itemValues = sheet.getRange(INBOUND.FIRST_DATA_ROW, 3, rowCount, 1).getDisplayValues();
  const quantityValues = sheet.getRange(INBOUND.FIRST_DATA_ROW, 5, rowCount, 1).getDisplayValues();

  for (let i = rowCount - 1; i >= 0; i--) {
    const hasActualInboundData =
      String(dateValues[i][0] || "").trim() !== "" ||
      String(itemValues[i][0] || "").trim() !== "" ||
      String(quantityValues[i][0] || "").trim() !== "";

    if (hasActualInboundData) {
      return INBOUND.FIRST_DATA_ROW + i + 1;
    }
  }

  return INBOUND.FIRST_DATA_ROW;
}

function ensureTotalLayout(sheet) {
  sheet.getRange(TOTAL.TITLE_CELL).setValue("WMS WAREHOUSE");
  sheet.getRange(TOTAL.HEADER_ROW, TOTAL.FIRST_COL).setValue("Finished good ID");
}

function ensureDetailLayout(sheet) {
  sheet.getRange(DETAIL.HEADER_ROW, DETAIL.FIRST_COL, 1, DETAIL.WIDTH).setValues([DETAIL.HEADERS]);
}

function findDetailRow(sheet, itemNumber) {
  const lastRow = sheet.getLastRow();

  if (lastRow < DETAIL.FIRST_DATA_ROW) {
    return null;
  }

  const values = sheet.getRange(DETAIL.FIRST_DATA_ROW, 1, lastRow - DETAIL.FIRST_DATA_ROW + 1, 1).getValues();

  for (let i = 0; i < values.length; i++) {
    if (cleanItemNumber(values[i][0]) === itemNumber) {
      return DETAIL.FIRST_DATA_ROW + i;
    }
  }

  return null;
}

function lookupProductName(ss, itemNumber) {
  const detailSheet = ss.getSheetByName(SHEETS.DETAIL);
  const detailRow = detailSheet ? findDetailRow(detailSheet, itemNumber) : null;

  if (detailSheet && detailRow) {
    const detailName = String(detailSheet.getRange(detailRow, 2).getDisplayValue() || "").trim();
    if (detailName) {
      return detailName;
    }
  }

  const totalSheet = ss.getSheetByName(SHEETS.TOTAL);

  if (!totalSheet || totalSheet.getLastRow() < TOTAL.FIRST_DATA_ROW) {
    return "";
  }

  const values = totalSheet
    .getRange(TOTAL.FIRST_DATA_ROW, 2, totalSheet.getLastRow() - TOTAL.FIRST_DATA_ROW + 1, 2)
    .getDisplayValues();

  for (let i = 0; i < values.length; i++) {
    if (cleanItemNumber(values[i][0]) === itemNumber) {
      return String(values[i][1] || "").trim();
    }
  }

  return "";
}

function lookupFinishGoodId(ss, itemNumber) {
  const detailSheet = ss.getSheetByName(SHEETS.DETAIL);
  const detailRow = detailSheet ? findDetailRow(detailSheet, itemNumber) : null;

  if (detailSheet && detailRow) {
    const detailFinishGoodId = String(detailSheet.getRange(detailRow, 3).getDisplayValue() || "").trim();
    if (detailFinishGoodId) {
      return detailFinishGoodId;
    }
  }

  const totalSheet = ss.getSheetByName(SHEETS.TOTAL);

  if (!totalSheet || totalSheet.getLastRow() < TOTAL.FIRST_DATA_ROW) {
    return "";
  }

  const values = totalSheet
    .getRange(TOTAL.FIRST_DATA_ROW, 1, totalSheet.getLastRow() - TOTAL.FIRST_DATA_ROW + 1, 2)
    .getDisplayValues();

  for (let i = 0; i < values.length; i++) {
    if (cleanItemNumber(values[i][1]) === itemNumber) {
      return String(values[i][0] || "").trim();
    }
  }

  return "";
}

function getDetailLookupMap(ss) {
  const sheet = ss.getSheetByName(SHEETS.DETAIL);
  const map = {};

  if (!sheet || sheet.getLastRow() < DETAIL.FIRST_DATA_ROW) {
    return map;
  }

  const values = sheet
    .getRange(DETAIL.FIRST_DATA_ROW, DETAIL.FIRST_COL, sheet.getLastRow() - DETAIL.FIRST_DATA_ROW + 1, DETAIL.WIDTH)
    .getDisplayValues();

  values.forEach(function (row) {
    const itemNumber = cleanItemNumber(row[0]);

    if (!itemNumber) {
      return;
    }

    map[itemNumber] = {
      productName: String(row[1] || "").trim(),
      finishGoodId: String(row[2] || "").trim(),
      location: String(row[4] || "").trim(),
      shelf: String(row[5] || "").trim(),
    };
  });

  return map;
}

function cleanItemNumber(value) {
  if (typeof value === "number" && isFinite(value)) {
    return String(Math.trunc(value));
  }

  const text = String(value || "").trim();
  return text.replace(/\.0$/, "");
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildHeaderMap(headers) {
  const map = {};

  headers.forEach(function (header, index) {
    const key = normalizeHeader(header);

    if (key) {
      map[key] = index;
    }
  });

  return map;
}

function valueByHeader(row, headerMap, keys, fallbackIndex) {
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    if (Object.prototype.hasOwnProperty.call(headerMap, key)) {
      return row[headerMap[key]];
    }
  }

  if (fallbackIndex === null || fallbackIndex === undefined) {
    return "";
  }

  return row[fallbackIndex];
}

function ensureRowCapacity(sheet, neededLastRow) {
  const maxRows = sheet.getMaxRows();

  if (neededLastRow > maxRows) {
    sheet.insertRowsAfter(maxRows, neededLastRow - maxRows);
  }
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Missing POST body.");
  }

  return JSON.parse(e.postData.contents);
}

function outputResponse(e, payload) {
  if (e && e.parameter && e.parameter.callback) {
    const callback = String(e.parameter.callback).replace(/[^\w.$]/g, "");
    return ContentService
      .createTextOutput(callback + "(" + JSON.stringify(payload) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return jsonResponse(payload);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function htmlResponse(html) {
  return HtmlService.createHtmlOutput(html).setTitle("WMS Total Stock");
}

function renderTotalHtml(total, metrics) {
  const rows = total.map(function (item) {
    return (
      "<tr>" +
      "<td>" + escapeHtml(item.finishGoodId) + "</td>" +
      "<td>" + escapeHtml(item.itemNumber) + "</td>" +
      "<td>" + escapeHtml(item.productName) + "</td>" +
      "<td>" + escapeHtml(item.quantity) + "</td>" +
      "<td>" + escapeHtml(item.location) + "</td>" +
      "<td>" + escapeHtml(item.shelf) + "</td>" +
      "<td>" + escapeHtml(item.total) + "</td>" +
      "<td>" + escapeHtml(item.family) + "</td>" +
      "</tr>"
    );
  }).join("");

  return (
    "<!doctype html><html><head>" +
    "<meta name='viewport' content='width=device-width, initial-scale=1'>" +
    "<style>" +
    "body{font-family:Segoe UI,Arial,sans-serif;margin:24px;background:#f3f2f1;color:#201f1e}" +
    "h1{font-weight:600;margin:0 0 8px}" +
    "p{margin:0 0 16px;color:#605e5c}" +
    "table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #edebe9}" +
    "th,td{border-top:1px solid #edebe9;padding:9px 12px;text-align:left;white-space:nowrap}" +
    "th{background:#0078d4;color:#fff;font-size:12px}" +
    "tr:nth-child(even){background:#faf9f8}" +
    "</style></head><body>" +
    "<h1>WMS Total Stock</h1>" +
    "<p>Inbound SKUs last week: " + escapeHtml(metrics.inboundSkuLastWeek) + "</p>" +
    "<table><thead><tr>" +
    "<th>Finish good ID</th><th>Item number</th><th>Product name</th><th>Quantity</th>" +
    "<th>Location</th><th>Shelf</th><th>Total</th><th>Family</th>" +
    "</tr></thead><tbody>" + rows + "</tbody></table>" +
    "</body></html>"
  );
}

function numberFromDisplay(value) {
  const cleaned = String(value || "").replace(/,/g, "").trim();
  const number = Number(cleaned);
  return Number.isNaN(number) ? 0 : number;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
