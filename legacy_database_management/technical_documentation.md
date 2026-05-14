# BOM Dataset Indexer — Project Handover

**Generated:** 2026-05-12
**Repository:** `nguyenhoang88502.github.io/legacy_database_management`
**Primary stakeholder:** NPI Department, Wahl Clipper Vietnam

---

## 1. Project Overview

The BOM Dataset Indexer is a **dual-platform, version-controlled data indexing engine** purpose-built for the NPI (New Product Introduction) department at Wahl Clipper Vietnam. It scans directories containing Excel and CSV spreadsheets — BOMs, supplier lists, inspection records, quotations — and builds a full-text searchable index so engineers can locate parts, suppliers, and specifications in seconds instead of manually opening each file.

The system ships in two forms:

| Platform | Entry Point | Storage |
|----------|-------------|---------|
| **Web PWA** | `Indexing_web.html` | IndexedDB (browser) |
| **Desktop .exe** | `BOM Dataset Indexer v7/BOM Dataset Indexer.exe` | SQLite (local) |

Both versions run entirely offline with zero server upload. The desktop application is the recommended daily driver for the NPI team due to multi-threaded performance and persistent SQLite caching.

**Business context:** Wahl Vietnam's NPI project volume grew from 9 projects/year (2020) to 101+ projects/year (2025). Each project generates dozens of Excel files. The tool reduces part-lookup time by ~90% (from ~15 minutes to ~10 seconds) and saves an estimated 5–8 hours per engineer per week.

---

## 2. Tech Stack & Dependencies

### Desktop Application

| Component | Technology | Version |
|-----------|-----------|---------|
| Language | Python | 3.14 (3.9+ compatible) |
| GUI framework | PySimpleGUI | 4.60.5.1 |
| Excel (.xlsx/.xlsm) | openpyxl | 3.1.5 |
| Excel legacy (.xls) | xlrd | 2.0.1 |
| Database | SQLite3 (stdlib) | — |
| EXE bundler | PyInstaller | 6.20.0 |

Full dependency list in `desktop_app/requirements.txt`.

### Web Application

| Component | Technology |
|-----------|-----------|
| Language | Vanilla JavaScript (ES6+) |
| Excel parsing | SheetJS (xlsx) |
| Storage | IndexedDB |
| UI | Custom CSS (dark theme) |
| Offline | Service Worker (PWA) |

### Shared design

- BOM classification logic is implemented identically in both Python (`logic/bom_classifier.py`) and JavaScript (`Indexing_web.html`)
- Multi-language header recognition: English, Vietnamese, Chinese (ZH)
- UI i18n: English (EN) and Vietnamese (VI), toggled via `localStorage`

---

## 3. Architecture & Structure

```
legacy_database_management/
│
├── index.html                    # Landing page (download links, docs, release notes)
├── Indexing_web.html             # Web PWA — self-contained single-file application
├── README.md                     # Technical architecture documentation (English)
├── INSTRUCTION.md                # NPI user guide (Vietnamese)
├── handover.md                   # This file
│
├── desktop_app/
│   ├── app.py                    # CLI entry point (parses --folder, --sync-web, --headless)
│   ├── app.spec                  # PyInstaller spec (preferred for builds — has hidden imports)
│   ├── BOM Dataset Indexer.spec  # Minimal PyInstaller spec (simpler, fewer imports)
│   ├── build.bat                 # Windows batch build script
│   ├── requirements.txt          # Python dependencies
│   ├── BUILD.md                  # Build instructions
│   ├── README_DESKTOP.md         # Desktop app user documentation
│   ├── PARTITIONED_CACHE_README.md # Partitioned cache system documentation
│   ├── .gitignore
│   │
│   ├── ui/
│   │   ├── __init__.py
│   │   ├── gui.py                # PySimpleGUI application (~1500 lines)
│   │   └── i18n.py               # EN/VI translation strings
│   │
│   ├── logic/
│   │   ├── __init__.py           # Re-exports from all submodules
│   │   ├── bom_classifier.py     # BOM type detection, header aliases, structured extraction
│   │   ├── cache_manager.py      # Legacy single-file SQLite cache
│   │   ├── excel_parser.py       # File scanning, .xlsx/.xls/.csv reading
│   │   ├── migrate_cache.py      # One-shot migration: legacy → partitioned cache
│   │   ├── partitioned_cache.py  # 10-partition SQLite cache + WebAssetCache
│   │   ├── processor.py          # summarize_workbook() and summarize_workbook_universal()
│   │   ├── utils.py              # unique(), isFractional(), valueAt() helpers
│   │   └── web_sync.py           # HTML/web-asset synchronization
│   │
│   ├── data/
│   │   ├── __init__.py
│   │   ├── cache.db              # Legacy cache (gitignored)
│   │   ├── partitioned_cache/    # Partitioned SQLite shards (gitignored)
│   │   └── web_cache/
│   │       ├── index.html        # Cached copy of Indexing_web.html
│   │       └── manifest.json     # Asset hash manifest
│   │
│   ├── BOM Dataset Indexer v1/   # v1 release executable
│   ├── BOM Dataset Indexer v2/   # v2 release executable
│   ├── BOM Dataset Indexer v3/   # v3 release executable
│   ├── BOM Dataset Indexer v4/   # v4 release executable
│   ├── BOM Dataset Indexer v5/   # v5 release executable
│   ├── BOM Dataset Indexer v6/   # v6 release executable
│   ├── BOM Dataset Indexer v7/   # v7 release executable (current)
│   ├── build/                    # PyInstaller intermediate artifacts (gitignored)
│   └── dist/                     # PyInstaller output (gitignored)
│
├── .claude/
│   └── settings.local.json       # Claude Code local permissions
│
└── .git/                         # Git repository
```

### Core Logic Flow (Desktop)

```
app.py                     CLI parsing → run_gui()
  └── ui/gui.py            PySimpleGUI event loop, worker threads
        ├── logic/excel_parser.py    Recursive file discovery (.xlsx/.xls/.csv)
        ├── logic/processor.py      summarize_workbook() or summarize_workbook_universal()
        │     └── logic/bom_classifier.py   Header detection, type classification, extraction
        └── logic/partitioned_cache.py      Hash-partitioned SQLite storage + FTS search
```

### Indexing Modes

| Mode | Function | Behavior |
|------|----------|----------|
| **Universal** (default) | `summarize_workbook_universal()` | Indexes every non-empty row, every cell — no BOM filtering |
| **BOM Focused** | `summarize_workbook()` | Header-aware extraction with type classification (BOM line/header/mixed/Non-BOM) |

As of v6, Universal Mode is the default and all workbooks are always processed regardless of classification.

---

## 4. Setup & Installation

### Running the Desktop App (End Users)

No setup required. Download `BOM Dataset Indexer.exe` from the v7 release directory and double-click. Everything is bundled inside the executable.

### Development Setup

**Prerequisites:** Python 3.9+, Windows 10/11

```bash
# Clone and enter the project
cd legacy_database_management/desktop_app

# Install dependencies
pip install -r requirements.txt

# Run in development mode
python app.py

# Run with a pre-selected folder
python app.py --folder "C:\Path\To\Excel\Files"
```

**No environment variables, API keys, or external services are required.** The application processes everything locally.

### Building the Standalone Executable

```bash
cd legacy_database_management/desktop_app

# Preferred: use the detailed spec file
pyinstaller app.spec --clean --noconfirm

# Alternative: command-line one-liner
pyinstaller --onefile --windowed --name "BOM Dataset Indexer" --clean app.py
```

**Important:** Windows Defender may quarantine the built `.exe` when UPX compression is enabled (`upx=True` in `app.spec`). Workarounds:
- Set `upx=False` in `app.spec` (produces a ~0.5 MB larger file)
- Or add the output directory to Windows Defender exclusions: `Add-MpPreference -ExclusionPath "<path>"`

The output is `dist/BOM Dataset Indexer.exe`. Copy to a versioned release directory (e.g., `BOM Dataset Indexer v7/`).

### Running the Web App

Open `Indexing_web.html` in any modern browser (Chrome, Edge, or Firefox). No server needed — it's a client-side application that uses the File System Access API.

---

## 5. Current State & Core Features

### What is implemented and functional

- **Dual indexing modes** — Universal (all rows/cells) and BOM-focused (classification + structured extraction)
- **Multi-format parser** — `.xlsx`, `.xlsm`, `.xls`, `.csv`
- **Multi-language header recognition** — English, Vietnamese, Chinese column aliases
- **Smart BOM classification** — auto-detects BOM line, BOM header, Mixed BOM report, Non-BOM, Error
- **Full-text search (FTS)** — SQLite FTS5 for sub-second queries across all indexed content
- **Quick Lookup** — targeted search by item number, BOM code, or FG name with contains/exact matching
- **Batch Find** — paste multiple codes (newline or comma separated); supports AND/OR modes
- **Partitioned SQLite cache** — 10 hash-based partitions, 100 MB cap each, WAL mode, atomic transactions
- **Incremental indexing** — file signatures (path + size + modified time) enable delta updates; unchanged files are skipped
- **Legacy cache fallback** — reads old single-file `cache.db` if partitioned cache is unavailable
- **CSV export** — filtered results exportable for Excel/Power BI analysis
- **EN/VI i18n** — toggle between English and Vietnamese UI; persists via `localStorage` (web) / in-memory state (desktop)
- **Dark-themed landing page** — `index.html` with documentation, download links, architecture specs, and release notes
- **Web asset sync** — CLI flags `--sync-web` and `--sync-html` for updating cached web assets
- **Version control** — Schema `v3.2.0`, Data Index `latest-v8`, backward compatible to `v2.0.0+`
- **Zero-server architecture** — all processing is local; no data ever leaves the machine

### Recent changes (v7, May 2026)

- Universal desktop indexing still displays only path, sheet, and row, but each row now stores inferred item, FG, product name, and mold metadata so the user can toggle into BOM-focused views without rescanning.
- Recognition now covers standard 7-digit item and FG IDs starting with 1 or 3, explanatory headers such as `Item number (The Component / Raw Material)`, BOM families in `1234` and `1234-02` format, versioned BOMs such as `3023881V01`, and mold codes such as `CAP2001019WHL`, `MDE 229.18`, `MDE02020`, `MOLD-0347`, and `TD14034C`.
- Desktop cache signatures were bumped so v7 refreshes older parsed results instead of reusing v6 records.

### Recent changes (v6, May 2026)

- Universal Mode set as the default indexing mode on launch
- Workbook skip logic removed — all Excel files are processed regardless of BOM classification
- Download link updated from v5 → v6 on landing page
- Release notes card added to `index.html`

---

## 6. Pending Tasks & Known Limitations

### Unfinished features

| Item | Location | Details |
|------|----------|---------|
| **Headless mode** | `app.py:37` | `--headless` flag is parsed but prints a stub message and exits. Intended for CLI-only indexing without the GUI. |
| **`data/config.json`** | Referenced in `PARTITIONED_CACHE_README.md` | File does not exist yet. Intended for application configuration persistence. |

### Known limitations

| Item | Details |
|------|---------|
| **`.xlsb` support** | Listed as a supported format but `openpyxl` cannot parse Excel Binary Workbook files. Such files return an error entry. The web version (SheetJS) *does* support `.xlsb`. |
| **UPX + Windows Defender** | PyInstaller builds with `upx=True` are flagged and removed by Windows Defender. Builds must use `upx=False` or the output directory must be added to Defender exclusions. |
| **No automated tests** | No test suite exists (`pytest`, `unittest`, etc.). All verification is manual. |
| **Single-platform desktop** | The desktop application is Windows-only (PySimpleGUI + PyInstaller). The web version is cross-platform. |
| **Large file memory usage** | Very large Excel files (>100 MB) are loaded entirely into memory by openpyxl. The partitioned cache caps database shards at 100 MB but individual file parsing has no size guard. |
| **Web app file count limit** | The web version uses `window.showDirectoryPicker()` which can struggle with directories containing thousands of files due to browser file handle limits. |

### No TODOs or FIXMEs found

A full scan of all `.py` and `.html` source files returned zero matches for `TODO`, `FIXME`, `HACK`, `XXX`, `BROKEN`, or `DEPRECATED`. The codebase is clean in this regard.

---

## 7. Scripts & Commands

### Development

```bash
# Run the desktop app (from desktop_app/)
python app.py

# Run with a pre-selected folder
python app.py --folder "C:\Path\To\Dataset"

# Sync web assets to the cached copy
python app.py --sync-web

# Sync HTML file to the cached copy
python app.py --sync-html

# Migrate legacy cache to partitioned cache
python logic/migrate_cache.py
```

### Build

```bash
# Automated (Windows)
build.bat

# Manual — simple one-file build
pyinstaller --onefile --windowed --name "BOM Dataset Indexer" --clean app.py

# Manual — spec file build (preferred for production)
pyinstaller app.spec --clean --noconfirm

# Build to a specific output directory
pyinstaller app.spec --clean --noconfirm --distpath "../BOM Dataset Indexer v7"
```

### Web

```bash
# No build step — just open in a browser
start Indexing_web.html

# Or serve locally for PWA features
python -m http.server 8080
```

---

## Appendices

### A. Cache Schema Versions

| Version | Status |
|---------|--------|
| `latest-v8` | Current — partitioned SQLite with FTS5 |
| `latest-v7` through `latest-v3` | Legacy — auto-migrated on load |
| `v2.0.0` | Minimum compatibility floor |

### B. Key File Reference

| File | Lines | Purpose |
|------|-------|---------|
| `desktop_app/ui/gui.py` | ~1500 | Main PySimpleGUI application, event loop, worker threads |
| `desktop_app/logic/bom_classifier.py` | ~570 | BOM type detection, header alias matching, row extraction |
| `desktop_app/logic/processor.py` | ~290 | `summarize_workbook()` and `summarize_workbook_universal()` |
| `desktop_app/logic/partitioned_cache.py` | ~400 | Partitioned SQLite cache, FTS search, web asset cache |
| `Indexing_web.html` | ~3000 | Complete web application (single-file PWA) |
| `index.html` | ~870 | Landing page with docs, download links, release notes |

### C. User Documentation Map

| Audience | Document | Language |
|----------|----------|----------|
| NPI Manager | `INSTRUCTION.md` | Vietnamese |
| NPI Engineer (quick start) | `index.html` (Quick Start section) | EN + VI |
| Desktop App User | `desktop_app/README_DESKTOP.md` | English |
| Technical / Architecture | `README.md` | English |
| Build / Distribution | `desktop_app/BUILD.md` | English |
| Cache System | `desktop_app/PARTITIONED_CACHE_README.md` | English |

### D. External Dependencies (zero runtime)

The desktop executable bundles Python and all dependencies. The web application loads SheetJS from a CDN `<script>` tag in `Indexing_web.html`. No other external services, APIs, or databases are required at runtime.

---

*For questions about this handover document, contact Nguyễn Huy Hoàng (repository owner).*
