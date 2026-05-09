# BOM Dataset Indexer - Desktop Application

A standalone Windows desktop version of the BOM Dataset Indexer, built with Python and featuring a native GUI. This application enables rapid indexing, searching, and filtering of Bill of Materials data without requiring a web browser.

## Key Features

- **Local Dataset Indexing**: Scan folders recursively for Excel/CSV files and build a searchable index
- **Multi-Language Support**: Recognizes Excel headers in English, Vietnamese, and Chinese
- **Smart Classification**: Automatically detects file types (BOM line, BOM header, Mixed BOM report, Non-BOM, Errors)
- **Full-Text Search**: Search across items, BOM numbers, product names, warehouses, and more
- **Advanced Filters**: Filter by BOM type and record properties (fractional quantities, errors, etc.)
- **Quick Lookup**: Find specific items or BOMs with "contains" or "exact" matching modes
- **Batch Find**: Look up multiple codes simultaneously (supports newline, comma, semicolon, tab separators)
- **Fast Caching**: SQLite-based caching for near-instant reload of previously indexed datasets
- **CSV Export**: Export filtered results for use in Excel, Power BI, and other analysis tools
- **Offline Operation**: All processing happens locally; no internet connection required

## System Requirements

- **OS**: Windows 10/11
- **Memory**: 2GB RAM minimum (4GB recommended for large datasets)
- **Storage**: 100MB free space for application and cache

## Download & Installation

### Latest Version: v3

**[Download BOM Dataset Indexer v3](./BOM%20Dataset%20Indexer%20v3/BOM%20Dataset%20Indexer.exe)** (Latest - Recommended)

Previous versions:
- [Download BOM Dataset Indexer v2](./BOM%20Dataset%20Indexer%20v2/BOM%20Dataset%20Indexer.exe)
- [Download BOM Dataset Indexer v1](./BOM%20Dataset%20Indexer%20v1/BOM%20Dataset%20Indexer.exe)

### Installation Steps

1. Download the `.exe` file from the link above
2. Run the executable (no additional installation required)
3. On first launch, the application creates a `data/` folder in the same directory for caching and configuration
4. Start using the application immediately

**Note**: The `.exe` is fully standalone and includes all required dependencies. No Python installation is needed to run it.

## Quick Start

1. **Select Dataset Folder**: Click the folder button and choose the root directory containing your Excel/CSV files. The app scans recursively.
2. **Wait for Indexing**: The progress bar shows indexing status. Cache is saved automatically.
3. **Search**: Use the main search bar and optional record filters to narrow down results.
4. **Quick Lookup**: Enter a value and select a target (BOM, Item, Warehouse, etc.) to find related records.
5. **Batch Find**: Paste multiple codes into the batch field (separated by newline, comma, semicolon, or space) and click "Batch Find".
6. **Export Results**: Click "Export CSV" to save filtered records as a CSV file.
7. **Reload Cache**: Previously cached datasets can be loaded instantly via "Load Cache" (no need to rescan).

## Configuration

- **Base Path Prefix**: Optionally set a base path that gets prepended to all file paths (useful for network drives or when paths change). This setting is saved between sessions.
- **Skip Unrelated Workbooks**: Enabled by default to exclude non-BOM files from the index. Uncheck to include all Excel files in searches.

## Building from Source

If you want to build the application yourself:

### Requirements
- Python 3.9 or later
- pip (Python package manager)

### Steps

1. Clone or download the repository
2. Open a command prompt in the project folder
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Build the executable:
   ```bash
   build.bat
   ```
   Or manually:
   ```bash
   pyinstaller --onefile --windowed --name "BOM Dataset Indexer" app.py
   ```
5. Find the executable in the `dist/` folder

## File Cache & Data

- **Cache Location**: `data/cache.db` (SQLite database)
- **Cache Size**: Typically 10-50MB depending on dataset size
- **Force Re-index**: Delete `data/cache.db` to force a complete re-indexing of all files

## Supported File Formats

- `.xls` (Excel 97-2003)
- `.xlsx` (Excel 2007+)
- `.xlsm` (Excel with macros)
- `.csv` (Comma-separated values)

**Note**: `.xlsb` (Excel Binary) files are not currently supported and will be marked as errors.

## Data Fields Recognized

The application automatically identifies the following columns (supports English, Vietnamese, and Chinese headers):

| Field | Description |
|-------|-------------|
| Item Number | Material/part identifier code |
| BOM Number | Bill of Materials code |
| Product Name | Product or finished good name |
| Quantity | Quantity required |
| Unit | Unit of measurement (EA, KG, M, set, etc.) |
| Warehouse | Storage location or warehouse code |
| Approved By | Approver or reviewer name |
| Status | Record status (Active, Inactive, etc.) |

## Troubleshooting

- **Application starts but no results appear**: Ensure you've selected a dataset folder and indexing has completed. Check the status message in the application.
- **Slow performance with large datasets**: The first indexing of thousands of files can take several minutes. Subsequent loads use the cache and are much faster.
- **"Parse error" for certain files**: The file may be corrupted, have an unsupported format, or use non-standard headers. Check the original Excel file.
- **Cannot export CSV**: Ensure you have write permissions in the directory where the application is running.
- **Cache corruption**: Delete `data/cache.db` and re-index to resolve cache-related issues.

## Privacy & Security

- All data processing occurs locally on your machine
- No files are uploaded to external servers
- No internet connection is required to use the application
- Cache files are stored in the local `data/` folder

## Credits

**Technologies Used**:
- Python for core application logic
- PySimpleGUI for the user interface
- openpyxl and xlrd for Excel file parsing
- SQLite for local data caching
- PyInstaller for creating standalone executables

## License & Support

For issues, suggestions, or questions, please refer to the project documentation or contact the development team.

---

**Latest Update**: Version 3 - Enhanced performance and improved user interface
