# WMS — Warehouse Management System

A browser-based warehouse management system built for real-time inventory tracking, warehouse layout visualization, and inbound/outbound workflow automation. Designed for both desktop administration and mobile floor operations.

## What It Does

This system replaces manual stock tracking and spreadsheet silos with a single web app that connects directly to a live inventory spreadsheet. Warehouse staff can view current stock, process inbound and outbound shipments via Excel uploads, look up item locations on a visual warehouse map, and submit cycle counts — all from a browser on desktop or mobile.

**No backend server. No database install. No login required.** The app is static HTML, CSS, and JavaScript. All data lives in a Google Sheet, and all updates flow through a Google Apps Script webhook.

## Key Features

### Live Inventory Dashboard
- View every active SKU with quantity, location, shelf, and product family
- Search and filter the full inventory table instantly
- Auto-refreshes every 10 seconds from the live data source
- Export filtered inventory to CSV in one click

### Visual Warehouse Map
- Interactive grid showing every shelf in the warehouse layout
- Search any item number to highlight exactly where it is stored
- Click any shelf to see all SKUs and quantities assigned to it
- Color-coded zones for different storage sections

### Inbound & Outbound Excel Processing
- Drop XLSX workbooks to batch-process inbound receipts or outbound shipments
- Download pre-formatted Excel templates with dropdown shelf selectors
- Preview all rows before sending — see item numbers, quantities, and totals
- Templates are pre-filled with live stock data for outbound picking

### Mobile Cycle Counting
- Scan or type item numbers on the warehouse floor
- Auto-fills product name, finish good ID, and current location from live stock
- Submit actual counted quantities and update shelf assignments
- Compact mobile layout hides desktop-only panels automatically

### Adjustment & History
- Submit manual outbound quantity adjustments for individual items
- Real-time item lookup shows stock level, shelf, and product info as you type
- Local history tracks recent adjustments for review

## How It Works (Simple Version)

```
Browser (Desktop or Mobile)
       |
       |  GET stock data, POST transactions
       v
Google Apps Script Webhook
       |
       |  Read/write sheet rows
       v
Google Sheet (Inventory, Inbound, Outbound, Locations)
```

The browser never touches the spreadsheet directly. The webhook handles all reads and writes, so the sheet stays safe and the app stays fast.

## Desktop vs Mobile

| Feature | Desktop | Mobile |
|---|---|---|
| Live inventory table | Full table with search | Hidden (optimized for floor work) |
| Inbound XLSX upload | Drag-and-drop with preview | Hidden |
| Outbound XLSX upload | Drag-and-drop with preview | Hidden |
| Outbound adjustment | Yes | Yes (primary workflow) |
| Cycle count / stock check | Yes | Yes (full form) |
| Warehouse layout map | Via Dashboard page | Compact fitted view |
| Week activity index | Full table with week selector | Hidden |
| CSV export | Yes | No |

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (no frameworks — plain vanilla JS)
- **Icons:** Lucide (lightweight icon library)
- **Excel:** SheetJS for reading uploads, ExcelJS for generating templates
- **Backend:** Google Apps Script (serverless webhook)
- **Data:** Google Sheets (live inventory, inbound, outbound, location sheets)
- **Hosting:** GitHub Pages (free static hosting)

## Why Static?

| Concern | How It's Handled |
|---|---|
| No server to maintain | Static files served by GitHub Pages |
| No database to manage | Google Sheets as the data layer |
| No login system | Deployed behind department access control |
| Works offline? | Cached stock in browser localStorage |
| Updates live? | Auto-refresh every 10 seconds from webhook |

## Project Structure

```
WMS/
  index.html          Main app (inventory, uploads, adjustments, week index)
  dashboard.html      Warehouse layout map and shelf lookup
  app.js              Core logic for the main app
  dashboard.js        Core logic for the layout dashboard
  styles.css          Shared styling (desktop + mobile responsive)
  warehouse-layout.js  Generated shelf layout data
  Layout.xlsx         Source workbook for the warehouse map
```

## Getting Started

Open `index.html` on a local server:

```powershell
cd WMS
python -m http.server 8000
```

Then visit `http://localhost:8000/index.html`.

For the dashboard: `http://localhost:8000/dashboard.html`.

## More Details

For the full technical handoff (API contract, function reference, maintenance guide), see the internal documentation or contact the author.

---

Built by [Nguyen Huy Hoang](https://nguyenhoang88502.github.io/) during the NPI internship at Wahl Clipper Vietnam.
