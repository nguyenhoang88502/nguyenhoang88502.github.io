# BOM Dataset Indexer — Technical Documentation

## System Overview

The BOM Dataset Indexer is a **version-controlled, modular data indexing platform** engineered for legacy database management in manufacturing environments. It provides a universal file and content indexing engine with specialized Bill of Materials (BOM) intelligence, available as both a browser-based Progressive Web Application and a native Windows desktop executable.

### Version Information

| Property | Value |
|---|---|
| **Schema Version** | `v3.2.0` — Structural contract for data organization, parsing, and indexing |
| **Data Index Version** | `latest-v8` — Cache payload format identifier |
| **Minimum Compatibility** | `v2.0.0+` — All prior cache formats auto-migrated on load |

## Architecture

The system follows a **layered, modular architecture** with clear separation of concerns:

| Layer | Component | Technology |
|---|---|---|
| **Presentation** | `index.html` / `Indexing_web.html` / `gui.py` | HTML5, CSS3, Tkinter |
| **Application Logic** | Parser Engine, BOM Classifier | JavaScript (Web Worker), Python |
| **Data Access** | Cache Manager, Partitioned Cache | IndexedDB, SQLite |
| **Infrastructure** | Web Sync, Cache Migration | REST, File I/O |

## Quick Start / Hướng Dẫn Nhanh

### Web Application / Ứng Dụng Web

**English:**

1. Open the application in your browser.
2. Click **"Select Folder"** and pick the folder containing your Excel/CSV files.
3. Choose your indexing mode: **Universal** (for everything) or **BOM** (for manufacturing data).
4. Click **"Start Indexing"** — the system processes files locally on your computer.
5. Use the search bar to find records and click **"Export CSV"** to download results.

**Tiếng Việt:**

1. Mở ứng dụng trong trình duyệt của bạn.
2. Nhấp **"Select Folder"** và chọn thư mục chứa các tệp Excel/CSV.
3. Chọn chế độ lập chỉ mục: **Universal** (cho tất cả) hoặc **BOM** (cho dữ liệu sản xuất).
4. Nhấp **"Start Indexing"** — hệ thống xử lý tệp cục bộ trên máy tính của bạn.
5. Sử dụng thanh tìm kiếm để tìm bản ghi và nhấp **"Export CSV"** để tải kết quả.

### Desktop Application / Ứng Dụng Desktop

**English:**

1. Download the latest **`.exe`** file from the releases page.
2. **Double-click** to run — no installation is required.
3. Use the **"Select Folder"** button to locate your Excel/CSV files.
4. Choose your indexing mode (**Universal** or **BOM**).
5. Click **"Start Indexing"** to begin processing.
6. Use the **search bar** to find records and **export** results as needed.

**Tiếng Việt:**

1. Tải tệp **`.exe`** mới nhất từ trang phát hành.
2. **Nhấp đúp** để chạy — không cần cài đặt.
3. Sử dụng nút **"Select Folder"** để tìm thư mục chứa tệp Excel/CSV.
4. Chọn chế độ lập chỉ mục (**Universal** hoặc **BOM**).
5. Nhấp **"Start Indexing"** để bắt đầu xử lý.
6. Sử dụng **thanh tìm kiếm** để tìm bản ghi và **xuất** kết quả khi cần.

## Indexing Engine

The indexing pipeline is designed for high-throughput processing of structured and semi-structured Excel data:

1. **Directory Crawler** — Recursive file-system traversal with configurable include/exclude filters
2. **Multi-format Parser** — Native support for `.xlsx`, `.xlsm`, `.xls`, `.xlsb`, `.csv` via SheetJS
3. **Header Detection** — Multi-lingual column recognition (English, Vietnamese, Chinese) with alias mapping
4. **Structured Extraction** — Column-aware row parsing mapped to canonical fields (Item, FG, BOM, Qty, Unit)
5. **BOM Classification** — Pattern-based categorization: BOM line, BOM header, Mixed BOM report, Non-BOM
6. **Inverted Indexing** — Full-text search with metadata enrichment for sub-second queries

## Smart Data Classification

The classifier automatically categorizes each workbook:

| Type | Description |
|---|---|
| **BOM line** | Material detail records with quantity/warehouse/unit columns |
| **BOM header** | Header/general information with BOM identifiers |
| **Mixed BOM report** | Workbooks containing both BOM line items and header data |
| **Non-BOM** | Files unrelated to BOM data |
| **Error** | Files with format or parsing issues |

## Version Control & Schema Management

The platform implements **semantic versioning** for both data schemas and cache payloads:

- **Schema Version (`v3.2.0`)** — Defines the structural contract for how data is organized, parsed, and indexed. Each MAJOR.MINOR.PATCH change is tracked.
- **Data Index Version (`latest-v8`)** — Cache payload format identifier. Legacy keys (v3–v7) are automatically migrated on load.
- **Incremental Updates** — File signatures (path + size + lastModified) enable differential re-indexing; unchanged workbooks are skipped.
- **Backward Compatibility** — Reads all prior cache formats and transparently upgrades them with minimum compatibility floor at v2.0.0.
- **Audit Trail** — Each cache write records a `generatedAt` ISO timestamp for version diffing and rollback analysis.

## Performance Characteristics

| Metric | Specification |
|---|---|
| **Throughput** | Thousands of workbooks processed in minutes (multi-threaded/Web Worker) |
| **Cache Partitioning** | ~100 MB chunked storage; prevents browser quota exhaustion |
| **Incremental Indexing** | File signature comparison reduces re-index time by up to 90% |
| **Lazy Rendering** | UI virtualizes first 500 records with progressive loading |
| **Cross-Platform Parity** | Identical logic in JavaScript (web) and Python (desktop) |

## Security & Privacy

- **Zero Server Upload** — All file processing executes entirely in the browser or local process
- **Local-First Architecture** — IndexedDB (web) / SQLite (desktop) stores data on-device
- **Immutable Sources** — Original Excel workbooks are never modified, copied, or transmitted
- **Content Isolation** — Worker threads parse files in isolated contexts without DOM or network access

## Supported File Types

- **Excel**: `.xls`, `.xlsx`, `.xlsm`, `.xlsb`
- **CSV**: `.csv`

## Troubleshooting

| Issue | Resolution |
|---|---|
| **Missing files in results** | Check "Skip unrelated workbooks" setting; try Universal mode |
| **Slow performance** | Clear IndexedDB via DevTools (F12) > Application > IndexedDB |
| **Export issues** | Ensure browser has download permissions; check popup blockers |
| **Misidentified columns** | Verify Excel headers are not merged cells |
| **Cache load failure** | Clear `bom-dataset-index-cache` in IndexedDB and re-index |

## Language Support

Toggle between English (EN) and Vietnamese (VI) using the language button in the header. The setting persists across the landing page and web application via `localStorage`. Header recognition also supports Chinese (ZH) column aliases.
