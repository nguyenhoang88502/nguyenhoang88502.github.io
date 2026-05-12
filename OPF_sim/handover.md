# Yamazumi Export Refactor — Handover

**Date**: 2026-05-13
**Branch**: main (clean)
**Status**: Implementation complete, ready for browser testing

---

## What this project does

`tool.html` is an offline-first Monte Carlo simulation tool for industrial engineering (line balancing, Yamazumi charts, flow simulation). `data_collection.html` is a mobile stopwatch for time-study data collection. Both share the same `localStorage.projectTasks` data model.

## What was done

Transformed the Yamazumi XLSX export from a SheetJS-based "create new file" workflow into a **template population workflow** using JSZip + direct XML manipulation.

### Before (old approach)
- Used SheetJS Community Edition (`xlsx.full.min.js`) to read/write xlsx
- Could not preserve template formatting (charts, styles, drawings) because SheetJS CE strips them on write
- Generated a plain workbook from scratch with programmatic styles

### After (new approach)
- Uses **JSZip 3.10.1** (`jszip.min.js`) to open the xlsx as a ZIP archive
- Uses browser-native **DOMParser** to parse and modify sheet XML directly
- Only touches `xl/worksheets/sheet7.xml` (Data PT-CT) and `xl/worksheets/sheet8.xml` (VAA-NVAA)
- All other ZIP entries (styles.xml, charts/, drawings/, formulas, sharedStrings.xml, printer settings) pass through **untouched**
- String values use `t="inlineStr"` (`<is><t>value</t></is>`) so sharedStrings.xml is never modified
- Number values use direct `<v>` elements

## Key files

| File | Role |
|------|------|
| `tool.html` | Main app — simulation engine, Yamazumi chart, export functions |
| `data_collection.html` | Mobile stopwatch time-study collector |
| `temp.xlsx` | 1.2MB production template (14 sheets, 19 charts, VML drawings) |
| `index.html` | Portfolio landing page (not modified) |
| `archive.html` | Visual archive (not modified) |

## CDN dependencies

```html
<!-- tool.html, line 10 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<!-- D3.js v7 also loaded for charts (line 9) -->
```

No other external dependencies. The project is entirely offline-capable once JSZip is cached.

## Data model (`localStorage.projectTasks`)

```javascript
[{
  seq:     Number,      // sequence order
  station: Number,      // station/operator number
  type:    String,      // 'VAA' | 'Semi VA' | 'NVA'
  a:       Number,      // optimistic time
  m:       Number,      // most-likely time
  b:       Number,      // pessimistic time
  name:    String,      // task name
  meta:    Object|null  // { readings: [Number,...], notes: String, timestamp: Number }
}]
```

## Template cell mapping — Data PT-CT (sheet7.xml)

"BEFORE" block = columns A-Q. Data rows = 3–12.

| Column | Row Range | Content |
|--------|-----------|---------|
| C | 3–12 | Task name (inline string) |
| E | 3–12 | PERT mean `(a+4m+b)/6` (number) |
| F–O | 3–12 | Monte Carlo samples 1–10 (numbers) |

Other blocks (REV-01 through REV-05) exist to the right in 17-column repeats — not currently written.

## Template cell mapping — VAA-NVAA (sheet8.xml)

"REFERENCE" block = columns A-H. Data rows = 8–17.

| Column | Row Range | Content |
|--------|-----------|---------|
| C | 8–17 | Task name (inline string) |
| F | 8–17 | Micro type — Vietnamese label |
| H | 8–17 | Macro type — VAA / Semi VA / NVA |

## Core functions (all in tool.html `<script>`)

```
resolveYamazumiExportData()
  → reads localStorage.projectTasks, groups by station, computes PERT means + 10 triangular samples

injectCellsIntoSheetXML(xmlStr, cellMap)
  → generic engine: parses sheet XML via DOMParser, finds/creates <c> elements, sets inlineStr or numeric values

buildDataPTCTCellMap(stationMap, sortedStns)
  → builds { "C3": {v:"name", t:"s"}, "E3": {v:12.5, t:"n"}, ... } for Data PT-CT

buildVAANVAACellMap(stationMap, sortedStns)
  → builds cell map for VAA-NVAA sheet

colCompare(a, b)
  → compares Excel column letters (A < Z < AA)

exportYamazumiOptionB()
  → fetches temp.xlsx → JSZip.loadAsync → inject both sheets → zip.generateAsync → download as Yamazumi_Export.xlsx

exportYamazumiOptionA(event)
  → reads user-uploaded .xlsx → resolves sheet paths via workbook.xml.rels → inject → download

downloadRawTemplate()
  → fetches temp.xlsx and triggers browser download (reference copy)
```

## Export workflow

```
┌──────────────────────┐     ┌───────────────────────┐
│ data_collection.html │     │ tool.html             │
│                      │     │                       │
│ Record readings      │     │ Add tasks manually    │
│ Send to Simulator ───┼────→│ or Import CSV         │
│                      │     │ Run Simulation        │
│ [Yamazumi XLSX] ─────┼────→│                       │
│  sets localStorage   │     │ onload detects flag   │
│  flag, navigates     │     │ → exportYamazumiB()   │
└──────────────────────┘     │                       │
                             │ [Export Yamazumi Auto]│
                             │ [Upload Template &    │
                             │  Export]              │
                             └───────────────────────┘
```

## Unified micro-type reference

`MICRO_TYPES_MASTER` (39 entries) merges the two previously-divergent lists (`actionTypes` in data_collection.html and the old `DROPDOWN_DATA`). Located in tool.html after state variables.

`MACRO_TO_VI_LABEL` maps type codes to Vietnamese labels:
```javascript
{ 'VAA': 'Lắp ráp', 'Semi VA': 'Giữ', 'NVA': 'Đang chờ đợi' }
```

## Known limitations / future work

1. **10 tasks max**: The template has exactly 10 data rows (3–12 in Data PT-CT, 8–17 in VAA-NVAA). Extra tasks are silently dropped.
2. **"BEFORE" block only**: Data is written only to the first station block. The template has 6 more blocks (REV-01 through REV-05) for improvement comparisons — not yet populated.
3. **No per-station grouping**: Tasks from all stations are flattened into one list of 10. Future: write each station to a separate block (BEFORE=station 1, REV-01=station 2, etc.).
4. **JSZip required**: Export fails if CDN is unreachable. Consider bundling JSZip for full offline support.
5. **Option A (user template)**: Template must have sheets named exactly "Data PT-CT" and "VAA-NVAA". Resolution is done by parsing `workbook.xml.rels` to find the correct XML file paths.

## Testing checklist

- [ ] Add 3 tasks across 2 stations → **Export Yamazumi (Auto)** → opens 4+ sheet xlsx with data in correct cells
- [ ] Run simulation with 5 tasks → export → PERT means match simulation, samples present
- [ ] **Upload Template & Export** → select valid .xlsx → data injected
- [ ] **Upload Template & Export** → select random .xlsx → descriptive error about missing sheets
- [ ] From `data_collection.html`, record readings → **Yamazumi XLSX** → auto-navigates and exports
- [ ] 12 tasks in one station → only first 10 exported, no crash
- [ ] Output file: all original sheets/charts/drawings intact, formulas preserved
