# BOM Dataset Indexer - Web Application

BOM Dataset Indexer is an optimized solution for automating the classification, indexing, and searching of Bill of Materials (BOM) data from Excel files. The application supports multi-language recognition (English - Vietnamese - Chinese) and optimizes query performance through an intelligent caching system.

## Quick Start Guide

### Step 1: Load Dataset

1. Access the application in your browser.
2. Click the "Select dataset folder" button. (Only load once; the system automatically loads cached data on subsequent sessions and adds new data).
3. Select the folder containing Excel files (.xls, .xlsx, .xlsm, .xlsb).
4. The system automatically scans, classifies, and indexes all available data.

### Step 2: Search for Information

Use the main search box to query by various criteria:

- **Identification info**: File name, Sheet name, BOM Number.
- **Material info**: Item Number, Product name, Column headers.

### Step 3: Quick Lookup

Enter any value (item code, warehouse, approver, etc.) in the Quick Lookup field:

- **Contains mode**: Relative/fuzzy search (default).
- **Exact item/BOM mode**: Exact match search.

### Step 4: Batch Find

1. Paste a list of item codes into the Batch Find field. The system supports separators: newline, comma, semicolon, tab, or space.
2. Click "Batch Find" to simultaneously retrieve all values from the list.

### Step 5: Export Reports

Click "Export CSV" to download filtered or searched results. The CSV file is optimized for Excel, Power BI, or other data analysis tools.

## Detailed Features

### 1. Smart Data Classification

The system automatically detects and classifies files based on data structure:

- **BOM line**: File containing material line details.
- **BOM header**: File containing header/general BOM information.
- **Mixed BOM report**: File combining both header and detail information.
- **Non-BOM / Unknown**: Unrelated or unidentified BOM structure file.
- **Error**: File with format errors or access issues.

### 2. Advanced Filtering

- **Type Filter**: Narrow search scope by file label (BOM Line, Header, etc.).
- **Record Filter**: Quickly find lines with fractional quantities, parse errors, or filter by Item Number/BOM Number.

### 3. Caching System

The application uses IndexedDB to store indexed data:

- **Speed**: Reload cached data almost instantly via the "Load Cache" button.
- **Performance**: Minimizes reprocessing of unchanged files and saves system resources.

## Supported Data Fields

The system automatically recognizes data columns based on headers in English, Vietnamese, and Chinese:

| Field | Description |
|-------|-------------|
| Item Number | Material identifier code |
| BOM Number | Bill of Materials code |
| Product Name | Product or finished good name |
| Quantity | Quantity of material |
| Unit | Unit of measurement (EA, KG, M, set, etc.) |
| Warehouse | Storage warehouse or location |
| Approved By | Data approver name |
| Status | Status (Active, Inactive, etc.) |

## Troubleshooting

- **File not appearing in results**: Check the "Skip unrelated workbooks" option. If the file doesn't contain standard BOM keywords in sheet names or column headers, the system may have skipped it to optimize memory.
- **Application responding slowly**: Clear the cache via DevTools (F12) > Application > IndexedDB and reload the data.
- **Cannot export CSV**: Ensure your browser (Chrome/Edge) has permission to download files.
- **Data column misidentified**: Check the original Excel file to ensure headers are not merged cells and are in the first rows.
    


## Ghi chú quan trọng

*   Bảo mật: Dữ liệu được xử lý cục bộ trên trình duyệt, không tải lên máy chủ bên ngoài.
    
*   Tính toàn vẹn: Ứng dụng chỉ đọc dữ liệu, không làm thay đổi nội dung các tệp Excel gốc.
    
*   Khuyến nghị: Nên sử dụng cache để tối ưu hóa thời gian làm việc với các bộ dữ liệu lớn.
    

