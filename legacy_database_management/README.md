# BOM Dataset Indexer - Web Application

The BOM Dataset Indexer is a powerful tool for managing and searching Bill of Materials (BOM) data from Excel files. It supports multi-language recognition (English, Vietnamese, Chinese) and uses intelligent caching for fast queries.

## Quick Start

### 1. Load Your Data
1. Open the web application in your browser
2. Click "Select dataset folder"
3. Choose the folder containing your Excel files (.xls, .xlsx, .xlsm, .xlsb)
4. The system will automatically scan and index all files

### 2. Search & Filter
- Use the main search box to find files, sheets, BOM numbers, item numbers, or product names
- Apply filters to narrow down results by file type or record properties
- Use Quick Lookup for fuzzy or exact matching of any value

### 3. Export Results
Click "Export CSV" to download your search results for use in Excel, Power BI, or other analysis tools.

## Key Features

### Smart Data Classification
Automatically categorizes files as:
- **BOM line**: Material detail records
- **BOM header**: Header/general information
- **Mixed BOM report**: Combined data
- **Non-BOM/Unknown**: Unrelated files
- **Error**: Files with format issues

### Advanced Capabilities
- Multi-language header recognition (English/Vietnamese/Chinese)
- Local browser-based processing (no data leaves your computer)
- IndexedDB caching for fast reloads
- Batch processing of multiple item codes
- Full-text search across all data fields

## Supported File Types
- Excel: .xls, .xlsx, .xlsm, .xlsb
- CSV files

## Privacy & Security
- All data processing happens locally in your browser
- No files are uploaded to external servers
- Original Excel files remain unchanged

## Troubleshooting
- **Missing files in results**: Check the "Skip unrelated workbooks" setting
- **Slow performance**: Clear browser cache via DevTools (F12) > Application > IndexedDB
- **Export issues**: Ensure browser has download permissions
- **Misidentified columns**: Verify Excel headers aren't merged cells
    

