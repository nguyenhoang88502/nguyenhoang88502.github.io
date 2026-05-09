# Building the BOM Dataset Indexer

## Prerequisites
- Python 3.9 or higher on Windows
- pip package manager

## Build Instructions

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Test the application:
   ```bash
   python app.py
   ```

3. Build the executable:
   ```bash
   pyinstaller --onefile --windowed --name "BOM Dataset Indexer" app.py
   ```

The executable will be created in the `dist/` folder.

## Alternative Method
Use the provided `build.bat` script to automate the build process.

## 5. Distribution

Copy the entire `dist` folder (or just the `.exe` if one-file) to any Windows machine. The executable is standalone and does not require Python to be installed.

## Notes

- The application stores its cache in `data/cache.db` (in the same directory as the executable). You can delete this file to reset the cache.
- On first run, the application may take a few moments to extract its bundled libraries.
- If you encounter missing module errors during build, add them to `hiddenimports` in `app.spec`.
