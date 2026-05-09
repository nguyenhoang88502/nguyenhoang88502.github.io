# BOM Dataset Indexer - Desktop Application (Python)

This is a standalone Windows desktop version of the original web-based BOM Dataset Indexer, migrated to Python with a native GUI.

## Features

- **Dataset Indexing**: Scan folders (recursively) for Excel/CSV files and build a searchable index.
- **Multi-language Support**: Recognizes Excel headers in English, Vietnamese, and Chinese.
- **Smart Classification**: Automatically detects file types (BOM line, BOM header, Mixed BOM report, Non-BOM, Errors).
- **Full-Text Search**: Search across items, BOM numbers, product names, warehouses, etc.
- **Advanced Filters**: Filter by BOM type, record properties (e.g., fractional quantities, errors).
- **Quick Lookup**: Find specific items or BOMs with "contains" or "exact" matching.
- **Batch Find**: Look up multiple codes at once (newline or comma separated).
- **SQLite Caching**: Near-instant reload of previously indexed datasets.
- **Export**: Filtered results can be exported to CSV for Excel/Power BI analysis.

## Requirements

- Windows 10/11
- Python 3.9+ (only needed for building/running from source)

## Installation (From Source)

1. Clone or download the repository.
2. Open a command prompt in the project folder and install dependencies:

```bash
pip install -r requirements.txt
```

3. Run the application:

```bash
python app.py
```

## Building a Standalone Executable

To create a `.exe` that does **not** require Python to be installed:

### Option 1: Using build.bat (Windows)
Simply run `build.bat` in the project folder. This will:
1. Install dependencies
2. Build the executable using PyInstaller
3. Place the result in `dist/BOM Dataset Indexer.exe`

### Option 2: Manual command
```bash
pyinstaller --onefile --windowed --name "BOM Dataset Indexer" app.py
```

The executable will be placed in the `dist/` folder.

### Distribution
- The built `.exe` is **standalone** - it includes all dependencies and runs on any Windows machine without Python
- The first run creates a `data/` folder for cache (SQLite) and config files
- File size is typically 20-40MB depending on included dependencies

## Usage

1. **Select Dataset Folder**: Choose the root folder containing your Excel/CSV files. The app scans recursively.
2. **Wait for Indexing**: Progress bar shows status. Cache is saved automatically.
3. **Search**: Use the main search bar and type/record filters to narrow results.
4. **Quick Lookup**: Type a value and choose a target (e.g., BOM, Item, FG) to find related rows.
5. **Batch Find**: Paste multiple codes into the batch box and click "Batch Find".
6. **Export**: Click "Export CSV" to save the current filtered records.
7. **Load Cache**: Previously cached datasets can be loaded instantly via "Load Cache" (no need to rescan).

## Configuration

- **Base Path**: If your files are on a network drive or changing location, you can set a base path prefix to prepend to file paths (saved between sessions).
- **Skip Unrelated Workbooks**: Enabled by default to exclude non-BOM files from the index. Uncheck to include all Excel files in searches.

## File Cache

The SQLite cache (`data/cache.db`) stores parsed data for fast loading. Delete this file to force a full re-index.

## Notes

- The application processes data locally; nothing is sent to the cloud.
- Large datasets (thousands of files) may take a few minutes to index initially.
- Only `.xls`, `.xlsx`, `.xlsm`, `.xlsb`, and `.csv` files are processed.
- `.xlsb` (Excel Binary) is not supported by `openpyxl`; such files will be reported as errors.

## Credits

Original web version: SheetJS (xlsx) for Excel parsing, IndexedDB for caching.
Python version: PySimpleGUI, openpyxl, xlrd, sqlite3.
