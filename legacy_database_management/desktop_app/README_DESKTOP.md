# BOM Dataset Indexer - Desktop Application

A standalone Windows desktop application for managing and searching Bill of Materials (BOM) data from Excel files. Built with Python and featuring a native GUI for enhanced performance.

## Features

- **Local Processing**: All data processing happens on your computer
- **Multi-Language Support**: Recognizes headers in English, Vietnamese, and Chinese
- **Smart Classification**: Automatically categorizes files (BOM line, header, mixed, etc.)
- **Full-Text Search**: Search across all data fields
- **Advanced Filters**: Filter by file type and record properties
- **Quick Lookup**: Find items with fuzzy or exact matching
- **Batch Processing**: Search multiple codes at once
- **Fast Caching**: SQLite-based cache for instant reloads
- **CSV Export**: Export results for Excel or Power BI
- **Offline Operation**: Works without internet connection

## System Requirements

- Windows 10/11
- 2GB RAM minimum (4GB recommended)
- 100MB free disk space

## Getting Started

### Installation
1. [Download BOM Dataset Indexer v3](./BOM%20Dataset%20Indexer%20v3/BOM%20Dataset%20Indexer.exe) (Recommended)
2. Run the executable (no installation required)
3. The app creates a `data/` folder for caching on first launch

### Usage
1. Click the folder button and select your Excel/CSV files directory
2. Wait for indexing to complete (progress bar shows status)
3. Use the search bar to find items, BOMs, products, etc.
4. Apply filters to narrow down results
5. Export results as CSV when needed

## Supported File Formats
- Excel: .xls, .xlsx, .xlsm
- CSV: .csv

Note: .xlsb files are not currently supported.

## Privacy & Security
- All processing occurs locally on your machine
- No data is uploaded to external servers
- Original files remain unchanged
- Cache stored locally in `data/cache.db`

## Troubleshooting
- **No results**: Ensure indexing completed successfully
- **Slow performance**: First indexing of large datasets may take several minutes
- **Parse errors**: Check if files are corrupted or have unsupported formats
- **Export issues**: Verify write permissions in the application directory
- **Cache problems**: Delete `data/cache.db` to force re-indexing

## Building from Source
If you want to build the application yourself:

Requirements:
- Python 3.9+
- pip package manager

Steps:
1. Install dependencies: `pip install -r requirements.txt`
2. Build executable: `pyinstaller --onefile --windowed --name "BOM Dataset Indexer" app.py`
3. Find the executable in the `dist/` folder

## Technologies Used
- Python (core logic)
- PySimpleGUI (interface)
- openpyxl/xlrd (Excel parsing)
- SQLite (caching)
- PyInstaller (executable packaging)

---
**Latest Version**: v3 - Enhanced performance and improved user interface
