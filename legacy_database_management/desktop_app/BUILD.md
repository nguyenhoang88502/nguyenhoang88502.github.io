# Building the BOM Dataset Indexer Executable

## Prerequisites

- Python 3.9 or higher installed on Windows
- pip package manager

## 1. Install Dependencies

Open a command prompt in the project directory and run:

```bash
pip install -r requirements.txt
```

## 2. Test the Application

Run in development mode:

```bash
python app.py
```

The GUI window should appear. Select a folder containing Excel files to begin indexing.

## 3. Build Standalone Executable

Using PyInstaller (included in requirements.txt):

```bash
# One-file executable (console hidden, GUI mode)
pyinstaller --onefile --windowed --name "BOM Dataset Indexer" app.py

# If you want to see console output for debugging:
# pyinstaller --onefile --console --name "BOM Dataset Indexer" app.py
```

The executable will be created in `dist/BOM Dataset Indexer.exe`.

**Alternative:** Use the provided `build.bat` script (if included) to automate the build.

## 4. Using the Spec File

For advanced customization, you can use the `app.spec` file:

```bash
pyinstaller app.spec
```

This allows fine-tuning of hidden imports, data files, and application metadata.

## 5. Distribution

Copy the entire `dist` folder (or just the `.exe` if one-file) to any Windows machine. The executable is standalone and does not require Python to be installed.

## Notes

- The application stores its cache in `data/cache.db` (in the same directory as the executable). You can delete this file to reset the cache.
- On first run, the application may take a few moments to extract its bundled libraries.
- If you encounter missing module errors during build, add them to `hiddenimports` in `app.spec`.
