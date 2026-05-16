# NPI Warehouse Management Web App

## Purpose

This repository contains a browser-based warehouse management app for the NPI warehouse. It connects to a Google Apps Script webhook backed by the NPI Warehouse Management Google Sheet. The app is designed for two main workflows:

- Desktop warehouse administration: review live stock, upload inbound and outbound Excel files, export Excel templates, review week activity, and use the full stock table.
- Mobile outbound and cycle count work: submit outbound quantity adjustments, check actual stock quantity, update shelf information, and open a compact warehouse dashboard.

The app is static HTML, CSS, and JavaScript. It can be hosted from GitHub Pages or opened from a local web server. It does not require a backend server of its own. All data persistence and sheet updates are handled through the Google Apps Script webhook.

## Current Working Directory

All current app work should be done in:

```text
C:\Users\nguyenhoang88502\Documents\GitHub\nguyenhoang88502.github.io\NPI_warehouse_management
```

## Repository Structure

```text
NPI_warehouse_management/
  index.html
  app.js
  dashboard.html
  dashboard.js
  styles.css
  Layout.xlsx
  warehouse-layout.js
  README.md
```

### `index.html`

Main warehouse management interface.

It contains:

- Desktop top bar with refresh and CSV export.
- Mobile-only Dashboard button.
- Metric cards:
  - Total SKUs
  - Total units
  - Inbound SKUs last week
- Desktop inbound XLSX drop-in panel.
- Desktop outbound XLSX drop-in panel.
- Desktop Total sheet inventory table.
- Desktop week index table.
- Outbound adjustment panel.
- Mobile cycle count / actual stock check panel.
- Hidden recent adjustment history panel.

### `app.js`

Main app behavior for `index.html`.

It handles:

- Loading live stock from the Google Apps Script webhook.
- JSON and JSONP fallback fetching.
- Desktop inventory rendering.
- Metric card rendering.
- Week index rendering.
- Outbound adjustment submission.
- Cycle count stock check submission.
- Inbound and outbound Excel drop-in parsing.
- Inbound and outbound template export.
- Inbound shelf dropdown creation in exported Excel templates.
- Local browser cache for stock and recent adjustment history.

### `dashboard.html`

Separate dashboard page for the warehouse layout view.

It contains:

- Back button to the stock app.
- Refresh stock button.
- Dashboard metric cards.
- Item search box.
- Clickable warehouse layout.
- Result panel showing SKUs and quantity for a clicked shelf.

### `dashboard.js`

Dashboard behavior for `dashboard.html`.

It handles:

- Loading live stock from the webhook.
- Rendering metrics.
- Rendering the warehouse layout grid.
- Merging warehouse parent cells visually.
- Searching item number or finished good ID.
- Highlighting the shelf where the searched item is stored.
- Clicking shelf cells to show a scrollable SKU and quantity table.

### `styles.css`

Shared styling for both pages.

It contains:

- D365-inspired visual styling.
- Desktop layout rules.
- Mobile layout rules.
- Upload panel styling.
- Inventory table styling.
- Outbound and cycle count form styling.
- Dashboard layout styling.
- Warehouse map cell styling.
- Mobile dashboard compact styling.

### `Layout.xlsx`

Source workbook for the warehouse layout.

This workbook is not read directly by the browser at runtime. Browsers cannot reliably inspect local Excel files after deployment. Instead, the layout is extracted into `warehouse-layout.js`.

Current dashboard rendering uses only `A1:Q13` from this workbook.

### `warehouse-layout.js`

Generated JavaScript data file created from `Layout.xlsx`.

It exposes:

```js
globalThis.NPI_WAREHOUSE_LAYOUT = {
  source: "Layout.xlsx",
  sheetName: "Sheet1",
  rows: [...],
  shelfCodes: [...]
};
```

Used by:

- `dashboard.js` to draw the warehouse map.
- `app.js` to build the inbound Excel template with a Layout sheet and shelf dropdown list.

### `README.md`

This handoff and maintenance document.

## External Dependencies

The app loads these browser libraries from CDNs:

```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js" defer></script>
```

### Lucide

Used for icons in buttons and search fields.

### SheetJS XLSX

Used to read uploaded `.xlsx` and `.xls` files in the browser.

### ExcelJS

Used to export real Excel templates with formatting, multiple sheets, comments, and dropdown data validation.

## Live Webhook

The app currently uses this webhook in both `app.js` and `dashboard.js`:

```js
const WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbx3gpYGoOY81E3J85TvZNllrmc6fBzessoQVicZr18G5uornSqX7Cgk_TGZ1D_-XUTS/exec";
```

If the Apps Script deployment changes, update `WEBHOOK_URL` in both files:

- `app.js`
- `dashboard.js`

## Google Apps Script Contract

The web app expects the Google Apps Script webhook to support both `GET` and `POST`.

### `GET ?format=json`

The app requests:

```text
WEBHOOK_URL?format=json
```

Expected response:

```json
{
  "ok": true,
  "sheet": "Total",
  "total": [
    {
      "finishGoodId": "FG-001",
      "itemNumber": "1000014",
      "productName": "Housing Bottom Black 9307",
      "quantity": 2342,
      "location": "B",
      "shelf": "1",
      "total": 2342,
      "family": "Housing"
    }
  ],
  "metrics": {
    "inboundSkuLastWeek": 12
  },
  "weekIndex": [
    {
      "weekKey": "2026-W20",
      "label": "Week 20 / 2026",
      "inboundQty": 100,
      "outboundQty": 40,
      "inbound": [],
      "outbound": []
    }
  ]
}
```

### `GET ?format=json&callback=...`

If normal JSON fetch fails because of CORS/content type, the app falls back to JSONP.

Expected response:

```js
callbackName({
  ok: true,
  total: [],
  metrics: {},
  weekIndex: []
});
```

### `POST action: "outbound"`

Used by the outbound adjustment form.

Payload:

```json
{
  "action": "outbound",
  "itemNumber": "1000014",
  "finishGoodId": "FG-001",
  "quantity": 10
}
```

Expected Apps Script behavior:

- Append a row to the Outbound sheet.
- Fill at least:
  - Date
  - Item number
  - Quantity
- Preserve formulas in any lookup columns.

### `POST action: "inboundBulk"`

Used by the inbound XLSX drop-in panel.

Payload:

```json
{
  "action": "inboundBulk",
  "rows": [
    {
      "itemNumber": "1000014",
      "quantity": 50,
      "shelf": "B1"
    }
  ]
}
```

Expected Apps Script behavior:

- Append inbound rows to the Inbound sheet.
- Fill date, item number, and quantity.
- If shelf handling is implemented in Apps Script, use `shelf` to update the related location/detail sheet.

### `POST action: "outboundBulk"`

Used by the outbound XLSX drop-in panel.

Payload:

```json
{
  "action": "outboundBulk",
  "rows": [
    {
      "itemNumber": "1000014",
      "quantity": 25
    }
  ]
}
```

Expected Apps Script behavior:

- Append each outbound row.
- Fill date, item number, and quantity.
- Preserve formulas in lookup columns.

### `POST action: "stockCheck"`

Used by the mobile cycle count form.

Payload:

```json
{
  "action": "stockCheck",
  "itemNumber": "1000014",
  "productName": "Housing Bottom Black 9307",
  "finishGoodId": "FG-001",
  "quantity": 2342,
  "location": "B",
  "shelf": "1"
}
```

Expected Apps Script behavior:

- Log the count as inbound-style stock data.
- Update the detailed location/shelf information for the item.
- Add a new detail location row if the item does not already exist.

## Data Model

### Normalized Stock Row

Both `app.js` and `dashboard.js` normalize stock rows into:

```js
{
  finishGoodId: string,
  itemNumber: string,
  productName: string,
  quantity: number,
  location: string,
  shelf: string,
  total: number,
  family: string
}
```

### Quantity Rules

The app uses this logic:

- `total` is preferred when present.
- `quantity` is used as fallback.
- Rows with zero stock are filtered out of active views.

### Shelf Rules

Dashboard shelf matching supports:

- A direct shelf code, for example `B1`.
- A location plus shelf combination, for example:
  - `location = "B"`
  - `shelf = "1"`
  - combined dashboard shelf = `B1`

This is handled by `itemShelfCode()` in `dashboard.js`.

## Main Page User Guide

Open:

```text
index.html
```

### Desktop Interface

The desktop interface is for inbound/outbound administrators.

#### Refresh Stock

Click **Refresh stock** to reload the Total sheet data from the webhook.

The app also auto-refreshes every 10 seconds.

#### Export Inventory CSV

Click the download icon in the top bar to export the currently loaded non-zero Total stock rows to CSV.

#### Metric Cards

The top metric cards show:

- Total SKUs: count of non-zero stock rows.
- Total units: sum of stock on hand.
- Inbound SKUs last week: unique inbound item numbers received during the last 7 days.

#### Inbound XLSX Drop-In

Used to send inbound rows from an Excel file.

The accepted inbound upload columns are:

- `Item number`
- `Quantity`
- `Shelf` optional

Workflow:

1. Click **Export template** in the Inbound panel.
2. Fill item number, quantity, and shelf in Excel.
3. Use the shelf dropdown to choose the shelf.
4. Use the Layout sheet inside the exported template as a reference.
5. Save the workbook.
6. Drop the workbook into the inbound drop zone.
7. Review the preview table.
8. Click **Send inbound**.

The upload preview only shows:

- Item number
- Quantity

#### Outbound XLSX Drop-In

Used to send outbound rows from an Excel file.

Workflow:

1. Click **Export template** in the Outbound panel.
2. The template is prefilled with:
   - Finish good ID
   - Item number
   - Product name
   - Available quantity
   - Blank Quantity column
3. Fill only the outbound Quantity column.
4. Save the workbook.
5. Drop the workbook into the outbound drop zone.
6. Review the preview table.
7. Click **Send outbound**.

Only item number and quantity are sent to the webhook.

#### Inventory Table

The inventory panel displays the non-zero rows from the Total sheet.

Columns:

- Finish good ID
- Item number
- Product name
- Quantity
- Location
- Shelf
- Family

Use the search bar to filter by item number, product, location, shelf, or family.

Click an item number to populate the outbound adjustment panel.

#### Outbound Adjustment

Used for manual outbound submissions.

Workflow:

1. Enter or scan item number.
2. Confirm lookup details.
3. Enter quantity.
4. Click **Send adjustment**.

The form posts `action: "outbound"` to the webhook.

#### Week Index

Displays inbound and outbound activity grouped by week.

Use the week dropdown to choose a week. The table displays:

- Date
- Flow
- Item number
- Product name
- Quantity

#### Recent Adjustments

The app has a local browser history mechanism, but the history panel is currently hidden by CSS. The code still maintains recent adjustment history in `localStorage`.

### Mobile Interface

The mobile interface is optimized for outbound and cycle count work.

Desktop-only panels are hidden on mobile:

- Inbound XLSX drop-in
- Outbound XLSX drop-in
- Metrics
- Inventory table
- Week index
- Desktop top bar

Visible mobile controls:

- Dashboard button
- Outbound Adjustment
- Check Actual Stocking Quantity

#### Mobile Dashboard Button

The **Dashboard** button opens:

```text
dashboard.html
```

It is intentionally mobile-only on `index.html`.

#### Mobile Outbound Adjustment

Use this for outbound picking.

When typing/scanning an item number, the app attempts to show:

- Warehouse amount
- Location
- Shelf
- Finish good ID
- Product name

#### Mobile Cycle Count

Use **Check Actual Stocking Quantity** to submit a counted quantity and shelf update.

Fields:

- Item number
- Product name, auto-filled
- Finish good ID, auto-filled
- Quantity
- Location
- Shelf

Click **Send check** to post `action: "stockCheck"`.

## Dashboard Page User Guide

Open:

```text
dashboard.html
```

### Desktop Dashboard

The dashboard shows:

- Total SKUs
- Total units
- Inbound SKUs last week
- Search box
- Warehouse layout map
- Click result panel

### Mobile Dashboard

The mobile dashboard uses a compact layout:

- Compact top bar.
- Three small metric cards in one row.
- Search text box.
- Fitted warehouse layout grid.
- Scrollable SKU/quantity result panel.

### Search

Type an item number or finished good ID.

The dashboard:

1. Searches loaded stock.
2. Finds the item's shelf.
3. Highlights the shelf cell on the layout.
4. Shows the matched item details.

### Clicking Shelf Cells

Click a shelf cell such as `B1`.

The result panel displays a scrollable two-column table:

- SKU
- Quantity

If no loaded stock rows are assigned to that shelf, it displays an empty shelf message.

### Warehouse Layout Rendering

The dashboard renders only:

```text
Layout.xlsx range A1:Q13
```

Parent cells are visually merged for these warehouse zones:

```text
A, B, C, D, E, F, G, H, I, K, L, M, N, O
```

Example:

- The parent `B` block covers the same height as `B1`, `B2`, `B3`, and `B4`.
- The same pattern is applied to other parent zones.

## Excel Template Details

### Inbound Template

Exported by the Inbound panel.

Sheets:

1. `Inbound`
2. `Layout`
3. `ShelfList`, hidden

Inbound columns:

```text
Item number | Quantity | Shelf
```

The `Shelf` column uses Excel dropdown validation from the hidden `ShelfList` sheet.

The `Layout` sheet is a reference copy of the warehouse layout.

### Outbound Template

Exported by the Outbound panel.

Columns:

```text
Finish good ID | Item number | Product name | available | Quantity
```

The first four columns are prefilled from the live stock loaded in the browser. Operators fill only the Quantity column.

## Function Reference: `app.js`

### Constants and State

| Name | Purpose |
| --- | --- |
| `WEBHOOK_URL` | Google Apps Script endpoint used for GET and POST. |
| `STORAGE_KEY` | Local storage key for cached Total sheet stock. |
| `HISTORY_KEY` | Local storage key for recent local adjustment history. |
| `state` | Central mutable state for the main page. |
| `elements` | Cached DOM element references for `index.html`. |

### Storage and Utility Functions

| Function | Purpose |
| --- | --- |
| `loadJson(key, fallback)` | Reads JSON from `localStorage`; returns fallback on error. |
| `saveState()` | Saves inventory and history state to `localStorage`. |
| `formatNumber(value)` | Formats numbers using `Intl.NumberFormat`. |
| `setStatus(message, type)` | Updates the outbound adjustment status box. |
| `setPanelStatus(element, message, type)` | Updates a supplied panel status box. |
| `normalizeHeader(value)` | Normalizes an Excel column header for flexible matching. |
| `getColumnValue(row, names)` | Finds a value in an uploaded Excel row by possible header names. |

### Stock Loading

| Function | Purpose |
| --- | --- |
| `normalizeStockRow(item)` | Converts raw webhook stock data into the app's stock row shape. |
| `loadStockFromWebhook({ silent })` | Loads stock from the webhook and refreshes the UI. |
| `fetchStockJson()` | Fetches normal JSON from the webhook. |
| `fetchStockJsonp()` | Fetches JSONP from the webhook if normal fetch fails. |
| `applyStockPayload(data, source, silent)` | Applies loaded stock, metrics, and week index data to state. |
| `activeStockRows()` | Returns non-zero stock rows. |
| `stockOnHand(item)` | Returns the preferred stock number for an item. |
| `countInboundSkusLastWeek(weekIndex)` | Calculates unique inbound SKUs in the last 7 days when the webhook metric is missing. |

### Rendering

| Function | Purpose |
| --- | --- |
| `renderMetrics()` | Updates the three metric cards. |
| `renderRefreshMeta()` | Updates refresh status and last updated text. |
| `renderInventory()` | Renders the desktop Total sheet inventory table. |
| `renderHistory()` | Renders local adjustment history, currently hidden by CSS. |
| `renderWeekIndex()` | Renders weekly inbound/outbound activity. |
| `renderItemLookup()` | Renders stock and shelf information while entering outbound item number. |
| `itemLookupMarkup(item)` | Produces lookup card HTML for a matched stock item. |
| `render()` | Runs all main render functions and refreshes Lucide icons. |

### Item Selection

| Function | Purpose |
| --- | --- |
| `findStockItem(itemNumber)` | Finds a stock row by exact item number. |
| `selectItem(itemNumber)` | Selects an item and populates outbound adjustment fields. |

### Outbound Adjustment

| Function | Purpose |
| --- | --- |
| `getFormPayload()` | Builds outbound adjustment payload from the form. |
| `postJson(payload)` | Sends a POST request to the webhook, with no-CORS fallback. |
| `postAdjustment(payload)` | Wrapper around `postJson()` for outbound adjustment. |
| `handleSubmit(event)` | Handles outbound adjustment form submission. |
| `clearForm()` | Clears outbound adjustment fields. |

### Cycle Count / Actual Stock Check

| Function | Purpose |
| --- | --- |
| `getStockCheckPayload()` | Builds stock check payload from the mobile cycle count form. |
| `handleStockCheckSubmit(event)` | Sends stock check data to the webhook. |
| `clearStockCheckForm()` | Clears the stock check form. |
| `fillStockCheckFromItem()` | Auto-fills product name and finished good ID from loaded stock. |

### Upload Previews

| Function | Purpose |
| --- | --- |
| `renderInboundUploadPreview()` | Renders inbound upload preview and send button state. |
| `renderOutboundUploadPreview()` | Renders outbound upload preview and send button state. |
| `uploadPreviewMarkup(rows)` | Produces the two-column preview table for item number and quantity. |

### Excel Upload Parsing

| Function | Purpose |
| --- | --- |
| `handleInboundFile(file)` | Reads inbound Excel file and normalizes rows. |
| `normalizeInboundRows(rows)` | Compatibility wrapper around `normalizeUploadRows()`. |
| `normalizeUploadRows(rows)` | Extracts item number, quantity, optional FG ID, product name, and shelf from uploaded rows. |
| `handleOutboundFile(file)` | Reads outbound Excel file and normalizes rows. |

### Template Export

| Function | Purpose |
| --- | --- |
| `exportDropInTemplate(kind)` | Exports inbound or outbound Excel templates. |
| `buildInboundTemplate(workbook, title)` | Builds the inbound template with shelf dropdown and Layout sheet. |
| `buildOutboundTemplate(workbook, title)` | Builds the outbound template prefilled with stock data. |
| `styleTemplateHeader(sheet)` | Applies header formatting and autofilter to Excel templates. |
| `warehouseLayoutRows()` | Reads layout rows from `warehouse-layout.js`. |
| `warehouseShelfCodes()` | Reads shelf codes from `warehouse-layout.js`. |
| `addLayoutWorksheet(workbook)` | Adds the Layout reference sheet to an exported workbook. |

### Upload Sending

| Function | Purpose |
| --- | --- |
| `sendInboundUpload()` | Sends parsed inbound rows as `action: "inboundBulk"`. |
| `clearInboundUpload()` | Clears inbound upload state. |
| `sendOutboundUpload()` | Sends parsed outbound rows as `action: "outboundBulk"`. |
| `clearOutboundUpload()` | Clears outbound upload state. |

### Export

| Function | Purpose |
| --- | --- |
| `exportInventoryCsv()` | Exports active stock rows to CSV. |

## Function Reference: `dashboard.js`

### Constants and State

| Name | Purpose |
| --- | --- |
| `WEBHOOK_URL` | Google Apps Script endpoint used for dashboard stock loading. |
| `STORAGE_KEY` | Local storage key shared with the main app for cached stock. |
| `dashboardState` | Central mutable state for the dashboard page. |
| `dashboardElements` | Cached DOM element references for `dashboard.html`. |

### Storage and Utility Functions

| Function | Purpose |
| --- | --- |
| `loadJson(key, fallback)` | Reads JSON from `localStorage`. |
| `saveInventory()` | Saves dashboard inventory cache to `localStorage`. |
| `formatNumber(value)` | Formats numbers for display. |
| `normalizeKey(value)` | Creates uppercase no-space keys for matching shelf and item codes. |
| `escapeHtml(value)` | Escapes text before inserting it into generated HTML. |

### Stock and Metrics

| Function | Purpose |
| --- | --- |
| `normalizeStockRow(item)` | Converts raw webhook stock row data into the dashboard stock shape. |
| `stockOnHand(item)` | Returns `total` or `quantity`. |
| `activeStockRows()` | Returns non-zero stock rows. |
| `renderMetrics()` | Updates dashboard metric cards. |
| `countInboundSkusLastWeek(weekIndex)` | Calculates unique inbound SKUs in the last 7 days. |

### Layout Helpers

| Function | Purpose |
| --- | --- |
| `layoutShelfCodeSet()` | Returns normalized shelf codes from `warehouse-layout.js`. |
| `parentSections()` | Defines visually merged parent blocks for layout zones. |
| `skippedParentCells()` | Hides original cells that are replaced by merged parent blocks. |
| `itemShelfCode(item)` | Resolves an item's shelf code for layout highlighting. |

### Layout Rendering and Shelf Clicks

| Function | Purpose |
| --- | --- |
| `renderLayout()` | Draws the clickable warehouse layout grid. |
| `itemsForShelf(shelfKey)` | Finds active stock rows assigned to a shelf. |
| `selectShelf(shelfKey)` | Handles clicking a shelf cell. |
| `renderShelfResult(shelfKey, items)` | Displays SKU and quantity table for the clicked shelf. |

### Search

| Function | Purpose |
| --- | --- |
| `renderSearchResult()` | Displays search match details and updates shelf highlight. |
| `handleSearch()` | Finds stock by item number or finished good ID. |

### Stock Loading

| Function | Purpose |
| --- | --- |
| `loadStock({ silent })` | Loads stock for the dashboard. |
| `fetchStockJson()` | Fetches normal JSON from the webhook. |
| `fetchStockJsonp()` | Fetches JSONP if normal fetch fails. |
| `applyStockPayload(data)` | Applies webhook stock, metric, and week data to the dashboard. |

## CSS and Responsive Behavior

### Desktop

Desktop is optimized for administration:

- Three-column operation panels.
- Desktop top bar.
- Large stock table.
- Upload drop zones.
- Week index.
- Dashboard page with side search panel and large map.

### Mobile

Mobile is optimized for warehouse floor usage:

- Main top bar is hidden on `index.html`.
- Mobile-only Dashboard button is shown.
- Upload panels are hidden.
- Inventory and week index are hidden.
- Outbound adjustment and stock check are stacked tightly.
- Dashboard page remains visible on mobile with compact metrics, search, and fitted layout map.

## Local Storage

The app uses browser `localStorage`:

| Key | Purpose |
| --- | --- |
| `npiWarehouseTotal.v2` | Cached live stock data. Shared by main app and dashboard. |
| `npiWarehouseHistory.v1` | Local recent outbound adjustment history. |

Clearing browser site data will remove these caches. It does not affect the Google Sheet.

## How to Run Locally

Because the app loads JavaScript files and external CDN libraries, use a simple local server rather than double-clicking HTML files.

From the project folder:

```powershell
cd C:\Users\nguyenhoang88502\Documents\GitHub\nguyenhoang88502.github.io\NPI_warehouse_management
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/index.html
```

Dashboard:

```text
http://localhost:8000/dashboard.html
```

## Deployment

This project is inside a GitHub Pages repository path. Normal deployment is:

1. Save changes.
2. Commit changes.
3. Push to GitHub.
4. GitHub Pages serves the updated files.

If departments use a different static host, copy all files in this folder together.

Required files for deployment:

- `index.html`
- `app.js`
- `dashboard.html`
- `dashboard.js`
- `styles.css`
- `warehouse-layout.js`

Recommended source file to keep with deployment:

- `Layout.xlsx`

## Maintenance Guide

### Changing the Webhook

Update `WEBHOOK_URL` in:

- `app.js`
- `dashboard.js`

Then test:

- Refresh stock.
- Submit outbound adjustment.
- Upload inbound file.
- Upload outbound file.
- Submit stock check.
- Open dashboard.

### Updating the Warehouse Layout

If `Layout.xlsx` changes, regenerate `warehouse-layout.js`.

Current workflow:

1. Replace `Layout.xlsx` in the project folder.
2. Regenerate `warehouse-layout.js` from the workbook.
3. Confirm dashboard rendering.
4. Confirm inbound template export includes the updated Layout sheet and shelf dropdown list.

The current extracted dashboard view displays only `A1:Q13`. If the workbook range changes, update `renderLayout()` in `dashboard.js`.

Relevant code:

```js
const rows = (window.NPI_WAREHOUSE_LAYOUT?.rows || [])
  .slice(0, 13)
  .map((row) => row.slice(0, 17));
```

### Updating Parent Merged Layout Blocks

Merged parent blocks are defined in `dashboard.js`:

```js
function parentSections() {
  return [
    { label: "B", rowStart: 4, rowEnd: 8, colStart: 1, colEnd: 2 },
    ...
  ];
}
```

The dashboard uses CSS grid coordinates:

- `rowStart` and `rowEnd` are 1-based CSS grid lines.
- `colStart` and `colEnd` are 1-based CSS grid lines.

When adding or changing parent blocks, also update `skippedParentCells()` if the original source label cells should be hidden.

### Adding More Upload Columns

For inbound/outbound upload parsing, update `normalizeUploadRows()`.

For upload preview display, update `uploadPreviewMarkup()`.

Current preview intentionally shows only:

- Item number
- Quantity

### Changing Excel Template Columns

Inbound template:

- Update `buildInboundTemplate()`.

Outbound template:

- Update `buildOutboundTemplate()`.

Header formatting:

- Update `styleTemplateHeader()`.

Layout reference sheet:

- Update `addLayoutWorksheet()`.

### Changing Mobile Visibility

Mobile styles are in `styles.css` under:

```css
@media (max-width: 760px) {
  ...
}
```

Important mobile behavior:

- `.topbar` is hidden on the main app.
- `.mobile-dashboard-link.secondary-button` is shown only on mobile.
- `.inbound-upload-panel` and `.outbound-upload-panel` are hidden.
- `.adjustment-panel` and `.stock-check-panel` are visible.
- Dashboard page overrides some mobile hiding rules with `.dashboard-page ...`.

### Changing Dashboard Mobile Fit

Mobile dashboard grid sizing is controlled by:

```css
.warehouse-layout-grid {
  height: min(38svh, 310px);
  min-height: 250px;
}
```

If the map is too small, increase those values. If it overflows, reduce them.

## Department Handoff

### Warehouse Operations

Use:

- Mobile `index.html` for outbound adjustment and cycle count.
- Desktop `index.html` for inbound/outbound Excel upload.
- `dashboard.html` for location lookup and shelf visibility.

Key operational rule:

- For outbound templates, fill only the Quantity column.
- For inbound templates, fill item number, quantity, and shelf.

### Inventory Control

Owns:

- Accuracy of Total sheet.
- Accuracy of Detailed location sheet.
- Shelf code consistency.
- Cycle count review.

Validate:

- Item numbers match the sheet.
- Quantity updates are logged to correct inbound/outbound sheets.
- Shelf data uses layout shelf codes.

### IT / Systems

Owns:

- GitHub Pages hosting.
- Apps Script deployment.
- Webhook URL updates.
- CDN/library access.
- Browser compatibility.

Test after deployment:

- GET stock JSON.
- JSONP fallback.
- POST outbound.
- POST inboundBulk.
- POST outboundBulk.
- POST stockCheck.

### Manufacturing / Production

Uses:

- Dashboard search to locate items by item number.
- Shelf click to view SKU/quantity at a location.

Report:

- Missing item locations.
- Incorrect shelf assignments.
- Quantity mismatches.

### Finance / Reporting

Uses:

- CSV export from main app.
- Week index as operational activity reference.
- Google Sheet as system of record.

Note:

- Browser CSV export is a convenience export, not the source of truth.

## Testing Checklist

### Main App Desktop

- Page loads without console errors.
- Refresh stock updates metric cards.
- Inventory table shows non-zero stock rows only.
- Search filters inventory.
- Inbound template downloads.
- Inbound template contains shelf dropdown.
- Inbound template contains Layout sheet.
- Inbound upload preview shows item number and quantity.
- Inbound send posts to webhook.
- Outbound template downloads.
- Outbound template is prefilled from stock.
- Outbound upload preview shows item number and quantity.
- Outbound send posts to webhook.
- Manual outbound adjustment posts to webhook.
- Week index populates.

### Main App Mobile

- Desktop top bar is hidden.
- Mobile Dashboard button is visible.
- Outbound Adjustment is visible.
- Cycle Count panel is visible directly after outbound adjustment.
- No large gap appears between the two mobile panels.
- Inbound/outbound desktop upload panels are hidden.
- Send adjustment works.
- Send check works.

### Dashboard Desktop

- Metrics load.
- Search finds item number.
- Search finds finished good ID.
- Matching shelf highlights.
- Clicking shelf shows SKU and quantity table.
- Empty shelf shows empty message.
- Map fits the layout panel without layout scroll.

### Dashboard Mobile

- Top bar is compact.
- Search input is visible.
- Metrics are compact.
- Map fits the mobile layout area.
- Shelf click result table scrolls when needed.

## Known Constraints

- The app is static and depends on the Apps Script webhook for live data and writes.
- If the webhook is down, cached stock may still display from `localStorage`.
- If CDN scripts are blocked, icons, Excel parsing, or Excel export may fail.
- The dashboard layout uses generated `warehouse-layout.js`; replacing `Layout.xlsx` alone does not update the dashboard.
- The main app and dashboard both need `WEBHOOK_URL` updated when Apps Script is redeployed to a new URL.
- The dashboard shows only `A1:Q13` from the layout data.

## Security Notes

- The webhook URL is public in the frontend code.
- Anyone with the deployed app and webhook access can send requests unless Apps Script implements its own authorization checks.
- For production use, consider adding Apps Script-side validation, allowlists, or a lightweight token if the deployment is exposed outside the intended team.
- The browser app should never be treated as the only validation layer. Validate item number, quantity, and action on the Apps Script side.

## Browser Compatibility

Recommended:

- Chrome
- Microsoft Edge

The app uses:

- Modern JavaScript
- Fetch API
- Dynamic DOM rendering
- `localStorage`
- Browser file APIs
- CDN-loaded XLSX and ExcelJS libraries

## Troubleshooting

### Stock Does Not Load

Check:

1. `WEBHOOK_URL` in `app.js` and `dashboard.js`.
2. Apps Script deployment is active.
3. `doGet` supports `format=json`.
4. Apps Script returns JSON with `ok: true`.
5. Browser console for CORS or content-type errors.

### Upload Preview Is Empty

Check:

1. The workbook has headers.
2. Inbound/outbound workbook has `Item number` and `Quantity`.
3. Quantity values are not zero.
4. File is `.xlsx` or `.xls`.

### Inbound Shelf Dropdown Missing

Check:

1. Browser loaded ExcelJS.
2. `warehouse-layout.js` exists.
3. `warehouse-layout.js` has `shelfCodes`.
4. Export the template again after refreshing the page.

### Dashboard Does Not Highlight a Shelf

Check:

1. The stock row has location/shelf data.
2. Location plus shelf forms a valid layout code, for example `B` + `1` = `B1`.
3. `warehouse-layout.js` contains that shelf code.
4. The item has non-zero stock.

### Mobile Has Too Much Gap

Check the mobile CSS:

```css
@media (max-width: 760px) {
  .operations-grid {
    display: grid;
    gap: 14px;
  }
}
```

Also confirm `.adjustment-panel .form-grid` is reset to:

```css
flex: initial;
```

## Change Log Summary

Major features currently included:

- Live Total sheet stock display.
- Auto-refresh every 10 seconds.
- Desktop inbound XLSX drop-in.
- Desktop outbound XLSX drop-in.
- Excel template export for inbound and outbound.
- Inbound shelf dropdown and Layout reference sheet.
- Outbound template prefilled with current stock.
- Manual outbound adjustment form.
- Mobile outbound workflow.
- Mobile cycle count workflow.
- Week index.
- CSV export.
- Separate dashboard page.
- Clickable warehouse layout cells.
- Shelf SKU/quantity display.
- Mobile-optimized dashboard view.

## Ownership Recommendations

Recommended ownership split:

- Warehouse Operations: daily use, feedback, and process discipline.
- Inventory Control: stock accuracy, shelf accuracy, and cycle count review.
- IT / Systems: deployment, webhook maintenance, and access controls.
- Engineering / Continuous Improvement: UI changes, workflow changes, layout updates, and data contract changes.

