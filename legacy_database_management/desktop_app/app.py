"""BOM Dataset Indexer - Main Entry Point"""

import sys
import os
import argparse
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from ui.gui import run_gui


def main():
    parser = argparse.ArgumentParser(description="BOM Dataset Indexer - Desktop Application")
    parser.add_argument("--folder", type=str, help="Folder path to index (optional)")
    parser.add_argument("--headless", action="store_true", help="Run in headless mode (no GUI)")
    args = parser.parse_args()

    if args.headless:
        print("Headless mode not implemented yet. Use GUI mode.")
        return

    run_gui(initial_folder=args.folder)


if __name__ == "__main__":
    main()
