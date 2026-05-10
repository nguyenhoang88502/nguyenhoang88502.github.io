"""PySimpleGUI-based BOM Dataset Indexer UI"""

import sys
import os
import threading
import re
import sqlite3
import json
import csv
import queue
import subprocess
import time
from pathlib import Path
from typing import Dict, List, Any, Optional
import PySimpleGUI as sg

from logic.excel_parser import scan_directory, get_file_info
from logic.processor import summarize_workbook, summarize_workbook_universal
from logic.cache_manager import CacheManager
from logic.partitioned_cache import PartitionedCacheManager, WebAssetCache
from logic.bom_classifier import (
    detectType, containsBomTitle, bomKind, isFgLike, isBomCodeInContext,
    codeValue, normalize, isFractional
)


# Application constants
APP_TITLE = "BOM Dataset Indexer"
CACHE_VERSION = 8
THEME = "SystemDefault"
MAX_RENDER_ROWS = 2000
QUERY_DEBOUNCE_SEC = 0.35


class AppState:
    """Manage application state"""
    def __init__(self):
        self.files: List[str] = []
        self.entries: Dict[str, Dict] = {}
        self.all_records: List[Dict] = []
        self.all_versions: List[Dict] = []
        self.filtered_rows: List[Dict] = []
        self.filtered_versions: List[Dict] = []
        self.selected_row: Optional[Dict] = None
        self.selected_version: Optional[Dict] = None
        self.search_text = ""
        self.lookup_text = ""
        self.batch_terms = []
        self.lookup_mode = "contains"
        self.lookup_target = "everything"
        self.index_mode = "bom"
        self.type_filter = ""
        self.record_filter = ""
        self.bom_only = True
        self.base_path = ""
        self.busy = False
        self.cache_manager: Optional[CacheManager] = None
        self.partitioned_cache_manager: Optional[PartitionedCacheManager] = None
        self.web_asset_cache: Optional[WebAssetCache] = None
        self.result_queue: queue.Queue = queue.Queue()
        self.progress_callback: Optional[callable] = None
        self.search_dirty = False
        self.lookup_dirty = False
        self.last_search_change_at = 0.0
        self.last_lookup_change_at = 0.0


# ============ Table row helpers ============

def make_table_row(record: Dict) -> List[str]:
    return [
        record.get('item', ''),
        record.get('fgItem', ''),
        record.get('fgName', ''),
        record.get('productName', ''),
        record.get('file', ''),
        record.get('sheet', ''),
        str(record.get('row', '')),
    ]


TABLE_HEADINGS = ["Item number", "FG", "FG name", "Product name", "File", "Sheet", "Row"]
UNIVERSAL_TABLE_HEADINGS = ["Path", "Sheet", "Row", "Column"]


def make_version_table_row(version: Dict) -> List[str]:
    return [
        version.get('file', ''),
        version.get('sheet', ''),
        version.get('parentItem', ''),
        version.get('parentName', ''),
        version.get('bom', ''),
        version.get('fromQty', ''),
        version.get('active', ''),
        version.get('approvedBy', ''),
    ]


VERSION_HEADINGS = ["File", "Sheet", "Parent Item", "Parent Name", "BOM", "From Qty", "Active", "Approved By"]


class BOMIndexerGUI:
    """Main GUI application class"""

    def __init__(self):
        self.state = AppState()
        self.window: Optional[sg.Window] = None
        self._setup_cache()

    def _setup_cache(self):
        """Initialize cache managers"""
        cache_dir = Path("data")
        cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize legacy cache manager for backward compatibility
        self.state.cache_manager = CacheManager(str(cache_dir / "cache.db"))
        self.state.cache_manager.connect()
        
        # Initialize new partitioned cache manager
        self.state.partitioned_cache_manager = PartitionedCacheManager(str(cache_dir / "partitioned_cache"))
        
        # Initialize web asset cache
        self.state.web_asset_cache = WebAssetCache(str(cache_dir / "web_cache"))

    def _build_layout(self):
        """Construct the PySimpleGUI window layout with scrollable areas"""
        
        # Button row at top
        top_row = [
            sg.Button("Select Dataset Folder", key="-SELECT_FOLDER-", size=(18, 1)),
            sg.Button("Select Files", key="-SELECT_FILES-", size=(14, 1)),
            sg.Button("Load Cache", key="-LOAD_CACHE-", size=(12, 1), button_color=('white', '#0066cc')),
            sg.Button("Export CSV", key="-EXPORT_CSV-", size=(12, 1), disabled=True, button_color=('black', '#cccccc')),
            sg.Button("Open Selected File", key="-OPEN_SELECTED_FILE-", size=(16, 1), disabled=True),
            sg.Push(),
            sg.Text("", size=(60, 1), key="-STATUS-", text_color="#666666")
        ]

        stats_row = [
            sg.Text("Files: 0", size=(12, 1), key="-STAT_FILES-"),
            sg.Text("Records: 0", size=(14, 1), key="-STAT_RECORDS-"),
            sg.Text("Types: 0", size=(20, 1), key="-STAT_TYPES-"),
            sg.Text("Cache: 0", size=(12, 1), key="-STAT_CACHE-"),
        ]

        filter_row = [
            sg.Input("", size=(40, 1), key="-SEARCH-", enable_events=True, tooltip="Search in all fields"),
            sg.Combo([], size=(18, 1), key="-TYPE_FILTER-", enable_events=True, readonly=True,
                      tooltip="Filter by BOM type"),
            sg.Combo([], size=(18, 1), key="-RECORD_FILTER-", enable_events=True, readonly=True,
                      tooltip="Filter by record properties"),
        ]

        base_row = [
            sg.Input("", size=(50, 1), key="-BASEPATH-", tooltip="Optional base path prefix"),
            sg.Button("Save Path", key="-SAVE_PATH-", size=(10, 1)),
            sg.Button("Clear Path", key="-CLEAR_PATH-", size=(10, 1)),
        ]

        options_row = [
            sg.Text("Index mode:"),
            sg.Combo(
                ["BOM focused", "Universal (all rows)"],
                default_value="BOM focused",
                size=(22, 1),
                key="-INDEX_MODE-",
                readonly=True,
                enable_events=True,
                tooltip="Choose before selecting folder/files"
            ),
            sg.Checkbox("Skip unrelated workbooks", default=True, key="-BOM_ONLY-", enable_events=True,
                        tooltip="Turn off to index all Excel files")
        ]

        progress_row = [
            sg.ProgressBar(100, orientation='h', size=(80, 12), key="-PROGRESS-"),
        ]

        lookup_grid = [
            [sg.Text("Quick Lookup:", font=("Arial", 10, "bold"))],
            [
                sg.Input("", size=(50, 1), key="-LOOKUP-", enable_events=True,
                         tooltip="Type value to search"),
                sg.Combo(["everything", "bom", "family", "old", "new", "versioned", "mold",
                          "fg", "item"],
                         default_value="everything", size=(14, 1), key="-LOOKUP_TARGET-", readonly=True,
                         tooltip="Lookup scope"),
                sg.Combo(["contains", "exact"], default_value="contains", size=(10, 1),
                         key="-LOOKUP_MODE-", readonly=True, tooltip="Match mode"),
                sg.Button("Clear", key="-CLEAR_LOOKUP-", size=(8, 1)),
            ],
            [
                sg.Multiline("", size=(60, 4), key="-BATCH-",
                             tooltip="Batch find: one value per line or comma-separated"),
                sg.Column([
                    [sg.Button("Batch Find", key="-RUN_BATCH-", size=(12, 1))],
                    [sg.Button("Clear Batch", key="-CLEAR_BATCH-", size=(12, 1))]
                ], vertical_alignment='TOP'),
            ],
            [sg.Text("", size=(80, 1), key="-LOOKUP_STATUS-", text_color="#555555")],
        ]

        lookup_frame = sg.Frame("Quick Lookup", lookup_grid, expand_x=True)

        # Main table with scroll
        table_cols = [[
            sg.Table(
                values=[],
                headings=TABLE_HEADINGS,
                display_row_numbers=False,
                auto_size_columns=True,
                justification='left',
                num_rows=15,
                key="-TABLE-",
                enable_events=True,
                expand_x=True,
                expand_y=True,
                vertical_scroll_only=False,
                visible=True
            ),
            sg.Table(
                values=[],
                headings=UNIVERSAL_TABLE_HEADINGS,
                display_row_numbers=False,
                auto_size_columns=False,
                col_widths=[90, 20, 8],
                justification='left',
                num_rows=18,
                key="-TABLE_UNI-",
                enable_events=True,
                expand_x=True,
                expand_y=True,
                vertical_scroll_only=False,
                visible=False
            )
        ]]

        # Details pane with scroll
        details_col = [
            [sg.Text("Selected Context", font=("Arial", 10, "bold"), key="-DETAILS_TITLE-")],
            [sg.Multiline("", size=(40, 15), key="-DETAILS-", disabled=True, expand_x=True, expand_y=True)]
        ]

        # Version table with scroll
        version_table = [[sg.Table(
            values=[],
            headings=VERSION_HEADINGS,
            display_row_numbers=False,
            auto_size_columns=True,
            justification='left',
            num_rows=8,
            key="-VERSION_TABLE-",
            enable_events=True,
            expand_x=True,
            vertical_scroll_only=False
        )]]

        # Create the full layout with scrollable main area
        layout = [
            top_row,
            stats_row,
            [sg.HorizontalSeparator()],
            filter_row,
            base_row,
            options_row,
            progress_row,
            [sg.HorizontalSeparator()],
            [lookup_frame],
            [sg.HorizontalSeparator()],
            # Split the main area into two columns with tables side by side
            [
                sg.Column(table_cols, expand_x=True, expand_y=True),
                sg.VerticalSeparator(key="-DETAILS_SEP-"),
                sg.Column(details_col, expand_x=False, expand_y=True, pad=(0, 0), key="-DETAILS_COL-")
            ],
            [sg.Frame("BOM Versions", version_table, expand_x=True, key="-VERSION_FRAME-")],
        ]

        return layout

    # ============ UI Update helpers ============

    def _update_status(self, message: str, color: str = ""):
        self.window["-STATUS-"].update(message, text_color=color or "#666666")

    def _update_progress(self, value: int, max_val: int = 100):
        pct = int((value / max_val) * 100) if max_val else 0
        self.window["-PROGRESS-"].update(pct)

    def _update_stats(self):
        total_files = len(self.state.entries)
        total_records = len(self.state.all_records)
        unique_types = {e.get('type', 'Unknown') for e in self.state.entries.values()}
        self.window["-STAT_FILES-"].update(f"Files: {total_files}")
        self.window["-STAT_RECORDS-"].update(f"Records: {total_records:,}")
        self.window["-STAT_TYPES-"].update(f"Types: {', '.join(sorted(unique_types))}")
        
        # Show cache information based on which cache is being used
        if self.state.partitioned_cache_manager:
            cache_info = f"P-Cache: {self.state.partitioned_cache_manager.count()} files"
            manifest = self.state.partitioned_cache_manager.get_manifest()
            if manifest.get('partition_count', 0) > 1:
                cache_info += f" ({manifest['partition_count']} partitions)"
            self.window["-STAT_CACHE-"].update(cache_info)
        elif self.state.cache_manager:
            self.window["-STAT_CACHE-"].update(f"Cache: {self.state.cache_manager.count() if self.state.cache_manager else 0}")
        else:
            self.window["-STAT_CACHE-"].update("Cache: 0")

    def _populate_type_filter(self):
        types = sorted({e.get('type', 'Unknown') for e in self.state.entries.values()})
        values = [""] + types
        self.window["-TYPE_FILTER-"].update(values=values)

    def _populate_record_filter(self):
        filter_options = [
            "", "Has item numbers", "Has finished goods", "Has BOM numbers",
            "BOM family (4 digits)", "Old BOM (1xxxxxx)", "New BOM (3xxxxxx)",
            "Versioned BOM (3xxxxxxV01)", "Mold (TDxxxx/TDxxxxA)",
            "Has fractional qty", "Has parse errors"
        ]
        self.window["-RECORD_FILTER-"].update(values=filter_options)

    def _refresh_table(self):
        self.state.selected_row = None
        self.window["-OPEN_SELECTED_FILE-"].update(disabled=True)
        if self.state.index_mode == "universal":
            table_data = [[r.get('path', ''), r.get('sheet', ''), str(r.get('row', '')), str(r.get('column', ''))]
                          for r in self.state.filtered_rows[:MAX_RENDER_ROWS]]
            self.window["-TABLE-"].update(values=[], visible=False)
            self.window["-TABLE_UNI-"].update(values=table_data, visible=True)
        else:
            table_data = [make_table_row(r) for r in self.state.filtered_rows[:MAX_RENDER_ROWS]]
            self.window["-TABLE_UNI-"].update(values=[], visible=False)
            self.window["-TABLE-"].update(values=table_data, visible=True)

    def _refresh_version_table(self):
        if self.state.index_mode == "universal":
            self.window["-VERSION_TABLE-"].update(values=[])
            return
        if self.state.lookup_text:
            source = self.state.filtered_versions
        else:
            source = self.state.all_versions
        vrows = [make_version_table_row(v) for v in source[:MAX_RENDER_ROWS]]
        self.window["-VERSION_TABLE-"].update(values=vrows)

    def _update_mode_ui(self):
        universal = self.state.index_mode == "universal"
        self.window["-BOM_ONLY-"].update(value=False if universal else self.state.bom_only, disabled=universal)
        self.window["-VERSION_FRAME-"].update(visible=not universal)
        self.window["-DETAILS_SEP-"].update(visible=True)
        self.window["-DETAILS_COL-"].update(visible=True)
        if universal:
            self.state.bom_only = False
        self._refresh_table()

    def _apply_filters(self):
        if self.state.index_mode == "universal":
            term = normalize(self.state.search_text)
            if term and self.state.cache_manager:
                rows = self.state.cache_manager.search_records_fts(term, exact=False, limit=50000)
            else:
                rows = self.state.all_records
            self.state.filtered_rows = rows
            self._refresh_table()
            return

        rows = self.state.all_records

        if self.state.search_text:
            term = normalize(self.state.search_text)
            rows = [r for r in rows if term in r.get('searchText', '')]

        if self.state.type_filter:
            rows = [r for r in rows
                    if self.state.entries.get(r.get('path'), {}).get('type') == self.state.type_filter]

        if self.state.record_filter:
            rows = self._filter_by_record_type(rows, self.state.record_filter)

        self.state.filtered_rows = rows
        self._refresh_table()

    def _filter_by_record_type(self, records: List[Dict], filter_type: str) -> List[Dict]:
        if filter_type == "Has item numbers":
            return [r for r in records if r.get('item')]
        elif filter_type == "Has finished goods":
            return [r for r in records if r.get('fgItem') or r.get('fgName')]
        elif filter_type == "Has BOM numbers":
            return [r for r in records if r.get('bom')]
        elif filter_type == "BOM family (4 digits)":
            return [r for r in records if r.get('bom') and bomKind(r['bom']) == 'family']
        elif filter_type == "Old BOM (1xxxxxx)":
            return [r for r in records if r.get('bom') and bomKind(r['bom']) == 'old']
        elif filter_type == "New BOM (3xxxxxx)":
            return [r for r in records if r.get('bom') and bomKind(r['bom']) == 'new']
        elif filter_type == "Versioned BOM (3xxxxxxV01)":
            return [r for r in records if r.get('bom') and bomKind(r['bom']) == 'versioned']
        elif filter_type == "Mold (TDxxxx/TDxxxxA)":
            return [r for r in records if r.get('bom') and bomKind(r['bom']) == 'mold']
        elif filter_type == "Has fractional qty":
            return [r for r in records if isFractional(r.get('quantity', ''))]
        else:
            return records

    def _rebuild_state_from_entries(self):
        self.state.all_records = []
        self.state.all_versions = []
        for entry in self.state.entries.values():
            self.state.all_records.extend(entry.get('records', []))
            self.state.all_versions.extend(entry.get('bomVersions', []))

    # ============ Event Handlers ============

    def _handle_select_folder(self):
        """Handle folder selection dialog"""
        folder = sg.popup_get_folder("Select dataset folder", default_path=self.state.base_path or os.getcwd())
        if folder:
            self._start_indexing(folder)

    def _handle_select_files(self):
        files = sg.popup_get_file(
            "Select Excel files",
            multiple_files=True,
            file_types=(("Excel Files", "*.xlsx *.xlsm *.xlsb *.xls *.csv"), ("All Files", "*.*"))
        )
        if files:
            if isinstance(files, str):
                files = [files]
            self._start_file_indexing(files)

    def _handle_load_cache(self):
        try:
            self._update_status("Loading cache...", "#0066cc")
            
            # Try to load from partitioned cache first
            if self.state.partitioned_cache_manager:
                entries = self.state.partitioned_cache_manager.load_entries()
                if entries:
                    self.state.entries = entries
                    self._rebuild_state_from_entries()
                    self._update_stats()
                    self._populate_type_filter()
                    self._apply_filters()
                    self._refresh_version_table()
                    self.window["-EXPORT_CSV-"].update(disabled=False)
                    self._update_status(f"Partitioned cache loaded: {len(entries)} files.", "#0a7f4f")
                    return
            
            # Fallback to legacy cache
            entries = self.state.cache_manager.load_entries()
            if entries and self.state.cache_manager.count_records() == 0:
                self.state.cache_manager.rebuild_records_index(list(entries.values()))
            self.state.entries = entries
            self._rebuild_state_from_entries()
            self._update_stats()
            self._populate_type_filter()
            self._apply_filters()
            self._refresh_version_table()
            self.window["-EXPORT_CSV-"].update(disabled=False)
            self._update_status(f"Legacy cache loaded: {len(entries)} files.", "#0a7f4f")
        except Exception as e:
            self._update_status(f"Cache load failed: {e}", "#d32f2f")

    def _handle_export_csv(self):
        if not self.state.filtered_rows:
            sg.popup("No data to export.")
            return

        save_path = sg.popup_get_file("Save CSV file", save_as=True,
                                      file_types=(("CSV Files", "*.csv"), ("All Files", "*.*")),
                                      default_extension=".csv")
        if not save_path:
            return

        try:
            with open(save_path, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.DictWriter(f, fieldnames=list(self.state.filtered_rows[0].keys()))
                writer.writeheader()
                writer.writerows(self.state.filtered_rows)
            self._update_status(f"Exported {len(self.state.filtered_rows)} rows to {save_path}", "#0a7f4f")
        except Exception as e:
            sg.popup_error(f"Export failed: {e}")

    def _handle_row_select(self, values):
        selected_key = "-TABLE_UNI-" if self.state.index_mode == "universal" else "-TABLE-"
        selected_indices = values.get(selected_key, [])
        if not selected_indices:
            return
        idx = selected_indices[0]
        if 0 <= idx < len(self.state.filtered_rows):
            record = self.state.filtered_rows[idx]
            self.state.selected_row = record
            details = self._format_record_details(record)
            self.window["-DETAILS-"].update(details)
            self.window["-OPEN_SELECTED_FILE-"].update(disabled=False)

    def _open_selected_file(self):
        record = self.state.selected_row
        if not record:
            sg.popup("Select a row first.")
            return
        path = record.get('path', '')
        if not path:
            sg.popup("Selected row does not contain a file path.")
            return
        if not Path(path).exists():
            sg.popup(f"File not found:\n{path}")
            return
        try:
            # Highlight the file in Windows Explorer.
            subprocess.run(["explorer", "/select,", str(Path(path))], check=False)
        except Exception:
            try:
                os.startfile(str(Path(path).parent))
            except Exception as e:
                sg.popup_error(f"Cannot open Explorer: {e}")

    def _format_record_details(self, record: Dict) -> str:
        if self.state.index_mode == "universal":
            lines = [
                f"path: {record.get('path', '')}",
                f"sheet: {record.get('sheet', '')}",
                f"row: {record.get('row', '')}",
                f"column: {record.get('column', '')}",
            ]
            raw_text = record.get('text', '') or record.get('productName', '')
            if raw_text:
                term = (self.state.lookup_text or self.state.search_text or "").strip()
                lines.append("")
                lines.append("matched row text:")
                lines.append(self._highlight_match_text(raw_text, term))
            cell_index_text = record.get('cellIndexText', '')
            if cell_index_text:
                term = normalize(self.state.lookup_text or self.state.search_text or "")
                lines.append("")
                lines.append("sample cells (column:value):")
                parts = cell_index_text.split('\t')[:12]
                for part in parts:
                    if ':' not in part:
                        continue
                    col, value = part.split(':', 1)
                    if term and term in normalize(value):
                        lines.append(f"* {col}: {self._highlight_match_text(value, term)}")
                    else:
                        lines.append(f"- {col}: {value}")
            return "\n".join(lines)

        lines = []
        for key, val in record.items():
            if key not in ('text', 'searchText'):
                lines.append(f"{key}: {val}")
        return "\n".join(lines)

    def _highlight_match_text(self, text_value: str, term: str) -> str:
        if not term:
            return text_value
        try:
            pattern = re.compile(re.escape(term), re.IGNORECASE)
            return pattern.sub(lambda m: f"[[{m.group(0)}]]", text_value)
        except Exception:
            return text_value

    def _find_match_column(self, record: Dict, term_norm: str, exact: bool) -> str:
        cell_index_text = record.get('cellIndexText', '') or ''
        if not cell_index_text or not term_norm:
            return ''
        for part in cell_index_text.split('\t'):
            if ':' not in part:
                continue
            col, value = part.split(':', 1)
            value_norm = normalize(value)
            if exact:
                if value_norm == term_norm:
                    return col
            else:
                if term_norm in value_norm:
                    return col
        return ''

    def _clear_lookup(self):
        self.window["-LOOKUP-"].update("")
        self.state.lookup_text = ""
        self._apply_filters()
        self.state.filtered_versions = self.state.all_versions
        self._refresh_version_table()
        self.window["-LOOKUP_STATUS-"].update("")

    def _clear_batch(self):
        self.window["-BATCH-"].update("")
        self.state.batch_terms = []
        self._apply_filters()
        self.window["-LOOKUP_STATUS-"].update("")

    def _on_search(self, values):
        self.state.search_text = values["-SEARCH-"].strip()
        self.state.type_filter = values["-TYPE_FILTER-"]
        self.state.record_filter = values["-RECORD_FILTER-"]
        self.state.search_dirty = True
        self.state.last_search_change_at = time.monotonic()

    def _on_basepath_save(self, values):
        self.state.base_path = values["-BASEPATH-"].strip()
        try:
            with open("data/config.json", "w") as f:
                json.dump({"base_path": self.state.base_path}, f)
        except:
            pass
        sg.popup("Base path saved.")

    def _on_basepath_clear(self):
        self.state.base_path = ""
        self.window["-BASEPATH-"].update("")
        try:
            os.remove("data/config.json")
        except:
            pass
        sg.popup("Base path cleared.")

    def _on_lookup(self, values):
        self.state.lookup_text = values["-LOOKUP-"].strip()
        self.state.lookup_mode = values["-LOOKUP_MODE-"]
        self.state.lookup_target = values["-LOOKUP_TARGET-"]
        self.state.lookup_dirty = True
        self.state.last_lookup_change_at = time.monotonic()

    def _perform_lookup(self):
        term = self.state.lookup_text.strip()
        if not term:
            self.window["-LOOKUP_STATUS-"].update("Enter a value to search")
            return

        term_norm = normalize(term)
        target = self.state.lookup_target
        exact = (self.state.lookup_mode == "exact")

        # Universal mode: keep query path lightweight for very large datasets.
        if self.state.index_mode == "universal":
            if self.state.partitioned_cache_manager:
                record_matches = self.state.partitioned_cache_manager.search_records_fts(term_norm, exact=exact, limit=50000)
            elif self.state.cache_manager:
                record_matches = self.state.cache_manager.search_records_fts(term_norm, exact=exact, limit=50000)
            else:
                source_matches = [r for r in self.state.all_records if term_norm in r.get('searchText', '')]
                record_matches = []
                for r in source_matches:
                    rec = dict(r)
                    rec['column'] = self._find_match_column(r, term_norm, exact)
                    if exact and not rec['column']:
                        continue
                    record_matches.append(rec)
            self.state.filtered_rows = record_matches
            self.state.filtered_versions = []
            self._refresh_table()
            self._refresh_version_table()
            shown = min(len(record_matches), MAX_RENDER_ROWS)
            if len(record_matches) > MAX_RENDER_ROWS:
                self.window["-LOOKUP_STATUS-"].update(
                    f"Found {len(record_matches)} records. Showing first {shown:,} for smoother UI."
                )
            else:
                self.window["-LOOKUP_STATUS-"].update(f"Found {len(record_matches)} records")
            return

        # --- Records matching ---
        record_matches = []

        if target == "everything":
            if exact:
                for r in self.state.all_records:
                    fields = [
                        r.get('item',''), r.get('fgItem',''), r.get('fgName',''),
                        r.get('productName',''), r.get('bom',''), r.get('bomName',''),
                        r.get('warehouse',''), r.get('quantity','')
                    ]
                    if any(term_norm == normalize(v) for v in fields if v):
                        record_matches.append(r)
            else:
                record_matches = [r for r in self.state.all_records if term_norm in r.get('searchText','')]

        elif target == "item":
            for r in self.state.all_records:
                vals = [r.get('item',''), r.get('fgItem',''), r.get('fgName',''), r.get('productName','')]
                bom = r.get('bom','')
                if bom and not isBomCodeInContext(bom, r.get('text','')):
                    vals.append(bom)
                if exact:
                    if any(term_norm == normalize(v) for v in vals if v):
                        record_matches.append(r)
                else:
                    if any(term_norm in normalize(v) for v in vals if v):
                        record_matches.append(r)

        elif target == "fg":
            for r in self.state.all_records:
                vals = []
                item = r.get('item','')
                bom = r.get('bom','')
                if isFgLike(item):
                    vals.append(item)
                if bom and not isBomCodeInContext(bom, r.get('text','')) and isFgLike(bom):
                    vals.append(bom)
                vals.extend([r.get('fgItem',''), r.get('fgName',''), r.get('productName','')])
                if exact:
                    if any(term_norm == normalize(v) for v in vals if v):
                        record_matches.append(r)
                else:
                    if any(term_norm in normalize(v) for v in vals if v):
                        record_matches.append(r)

        elif target in ("bom","family","old","new","versioned","mold"):
            for r in self.state.all_records:
                bom = r.get('bom','')
                kind = bomKind(bom)
                ok = False
                if target == "bom":
                    ok = kind in ('bom','versioned','mold') or bool(bom)
                elif target == "family":
                    ok = kind == "family"
                elif target == "old":
                    ok = kind == "old"
                elif target == "new":
                    ok = kind == "new"
                elif target == "versioned":
                    ok = kind == "versioned"
                elif target == "mold":
                    ok = kind == "mold"
                if ok:
                    if exact:
                        if term_norm == normalize(bom):
                            record_matches.append(r)
                    else:
                        if term_norm in normalize(bom):
                            record_matches.append(r)

        # --- Version matching ---
        version_matches = []

        if target == "everything":
            if exact:
                for v in self.state.all_versions:
                    fields = [
                        v.get('parentItem',''), v.get('parentName',''), v.get('bom',''),
                        v.get('bomName',''), v.get('itemGroup',''), v.get('active',''),
                        v.get('approved',''), v.get('approvedBy','')
                    ]
                    if any(term_norm == normalize(f) for f in fields if f):
                        version_matches.append(v)
            else:
                for v in self.state.all_versions:
                    if term_norm in normalize(v.get('searchText','')):
                        version_matches.append(v)

        elif target == "item":
            for v in self.state.all_versions:
                if exact:
                    if term_norm == normalize(v.get('parentItem','')) or term_norm == normalize(v.get('parentName','')):
                        version_matches.append(v)
                else:
                    if term_norm in normalize(v.get('parentItem','')) or term_norm in normalize(v.get('parentName','')):
                        version_matches.append(v)

        elif target == "fg":
            for v in self.state.all_versions:
                if v.get('isFg') or isFgLike(v.get('parentItem','')):
                    vals = [v.get('parentItem',''), v.get('parentName','')]
                    if exact:
                        if any(term_norm == normalize(v2) for v2 in vals if v2):
                            version_matches.append(v)
                    else:
                        if any(term_norm in normalize(v2) for v2 in vals if v2):
                            version_matches.append(v)

        elif target in ("bom","family","old","new","versioned","mold"):
            for v in self.state.all_versions:
                bom = v.get('bom','')
                kind = bomKind(bom)
                ok = False
                if target == "bom":
                    ok = kind in ('bom','versioned','mold') or bool(bom)
                elif target == "family":
                    ok = kind == "family"
                elif target == "old":
                    ok = kind == "old"
                elif target == "new":
                    ok = kind == "new"
                elif target == "versioned":
                    ok = kind == "versioned"
                elif target == "mold":
                    ok = kind == "mold"
                if ok:
                    if exact:
                        if term_norm == normalize(bom):
                            version_matches.append(v)
                    else:
                        if term_norm in normalize(bom):
                            version_matches.append(v)

        self.state.filtered_rows = record_matches
        self.state.filtered_versions = version_matches
        self._refresh_table()
        self._refresh_version_table()
        shown = min(len(record_matches), MAX_RENDER_ROWS)
        msg = f"Found {len(record_matches)} records, {len(version_matches)} BOM versions"
        if len(record_matches) > MAX_RENDER_ROWS:
            msg += f". Showing first {shown:,} for smoother UI."
        self.window["-LOOKUP_STATUS-"].update(msg)

    def _on_batch(self, values):
        text_val = values["-BATCH-"].strip()
        if not text_val:
            return
        import re
        terms = re.split(r'[\n,;\t\s]+', text_val)
        terms = [normalize(t) for t in terms if t.strip()]

        matched = []
        for r in self.state.all_records:
            search_txt = r.get('searchText', '')
            if any(term in search_txt for term in terms):
                matched.append(r)

        self.state.filtered_rows = matched
        self.state.batch_terms = terms
        self._refresh_table()
        self.window["-LOOKUP_STATUS-"].update(f"Batch: {len(matched)} matches across {len(terms)} terms")

    # ============ Background indexing ============

    def _worker_thread(self, folder_path: str):
        """Worker thread that processes files and sends progress via queue"""
        try:
            files = scan_directory(folder_path, recursive=True)
            total_files = len(files)
            self.state.result_queue.put(('status', f"Found {total_files} Excel files. Processing...", "#0066cc"))
            
            # Use partitioned cache for incremental updates if available
            if self.state.partitioned_cache_manager:
                # Load existing entries for comparison
                cached_entries = self.state.partitioned_cache_manager.load_entries()
                
                new_entries = []
                processed = 0
                skipped = 0

                for filepath in files:
                    file_meta = get_file_info(filepath)
                    signature = self.state.partitioned_cache_manager.file_signature(
                        filepath,
                        file_meta['size'],
                        int(file_meta['modified'] * 1000) if isinstance(file_meta.get('modified'), (int, float)) else 0
                    )

                    # Check if file has changed
                    if filepath in cached_entries and cached_entries[filepath].get('signature') == signature:
                        entry = cached_entries[filepath]
                    else:
                        try:
                            if self.state.index_mode == "universal":
                                entry = summarize_workbook_universal(filepath)
                            else:
                                entry = summarize_workbook(filepath)
                            entry['path'] = filepath
                            entry['signature'] = signature
                        except Exception as e:
                            entry = {
                                'file': Path(filepath).name,
                                'path': filepath,
                                'type': 'Error',
                                'error': str(e),
                                'records': [],
                                'bomVersions': [],
                                'signature': signature
                            }

                    if self.state.index_mode == "universal":
                        new_entries.append(entry)
                    elif self.state.bom_only:
                        allowed = ('BOM line', 'BOM header', 'Mixed BOM report')
                        if entry.get('type') not in allowed:
                            skipped += 1
                        else:
                            new_entries.append(entry)
                    else:
                        new_entries.append(entry)
                    
                    processed += 1
                    pct = int((processed / total_files) * 100) if total_files else 0
                    self.state.result_queue.put(('progress', pct))

                self.state.result_queue.put(('status', "Saving cache...", "#0066cc"))
                # Save only changed entries incrementally
                self.state.partitioned_cache_manager.save_entries_incremental(new_entries)
                self.state.result_queue.put(('result', new_entries, skipped))
            else:
                # Fallback to legacy cache
                cached_entries = self.state.cache_manager.load_entries()
                
                new_entries = []
                processed = 0
                skipped = 0

                for filepath in files:
                    file_meta = get_file_info(filepath)
                    signature = self.state.cache_manager.file_signature(
                        filepath,
                        file_meta['size'],
                        int(file_meta['modified'] * 1000) if isinstance(file_meta.get('modified'), (int, float)) else 0
                    )

                    if filepath in cached_entries and cached_entries[filepath].get('signature') == signature:
                        entry = cached_entries[filepath]
                    else:
                        try:
                            if self.state.index_mode == "universal":
                                entry = summarize_workbook_universal(filepath)
                            else:
                                entry = summarize_workbook(filepath)
                            entry['path'] = filepath
                            entry['signature'] = signature
                        except Exception as e:
                            entry = {
                                'file': Path(filepath).name,
                                'path': filepath,
                                'type': 'Error',
                                'error': str(e),
                                'records': [],
                                'bomVersions': [],
                                'signature': signature
                            }

                    if self.state.index_mode == "universal":
                        new_entries.append(entry)
                    elif self.state.bom_only:
                        allowed = ('BOM line', 'BOM header', 'Mixed BOM report')
                        if entry.get('type') not in allowed:
                            skipped += 1
                        else:
                            new_entries.append(entry)
                    else:
                        new_entries.append(entry)
                    
                    processed += 1
                    pct = int((processed / total_files) * 100) if total_files else 0
                    self.state.result_queue.put(('progress', pct))

                self.state.result_queue.put(('status', "Saving cache...", "#0066cc"))
                self.state.cache_manager.save_entries(new_entries)
                self.state.result_queue.put(('result', new_entries, skipped))

        except Exception as e:
            self.state.result_queue.put(('error', str(e)))

    def _worker_thread_files(self, file_paths: List[str]):
        """Worker thread for indexing selected files"""
        try:
            total = len(file_paths)
            new_entries = []
            
            # Use partitioned cache if available
            if self.state.partitioned_cache_manager:
                cached_entries = self.state.partitioned_cache_manager.load_entries()

                for i, fp in enumerate(file_paths):
                    file_meta = get_file_info(fp)
                    signature = self.state.partitioned_cache_manager.file_signature(
                        fp,
                        file_meta['size'],
                        int(file_meta['modified'] * 1000) if isinstance(file_meta.get('modified'), (int, float)) else 0
                    )

                    if fp in cached_entries and cached_entries[fp].get('signature') == signature:
                        entry = cached_entries[fp]
                    else:
                        try:
                            if self.state.index_mode == "universal":
                                entry = summarize_workbook_universal(fp)
                            else:
                                entry = summarize_workbook(fp)
                            entry['path'] = fp
                            entry['signature'] = signature
                        except Exception as e:
                            entry = {
                                'file': Path(fp).name, 'path': fp, 'type': 'Error',
                                'error': str(e), 'records': [], 'bomVersions': [], 'signature': signature
                            }

                    if self.state.index_mode == "universal":
                        new_entries.append(entry)
                    elif (not self.state.bom_only or entry.get('type') in ('BOM line', 'BOM header', 'Mixed BOM report')):
                        new_entries.append(entry)

                    pct = int(((i + 1) / total) * 100)
                    self.state.result_queue.put(('progress', pct))

                # Save incrementally using partitioned cache
                self.state.partitioned_cache_manager.save_entries_incremental(new_entries)
                self.state.result_queue.put(('result_files', new_entries))
            else:
                # Fallback to legacy cache
                cached_entries = self.state.cache_manager.load_entries()

                for i, fp in enumerate(file_paths):
                    file_meta = get_file_info(fp)
                    signature = self.state.cache_manager.file_signature(
                        fp,
                        file_meta['size'],
                        int(file_meta['modified'] * 1000) if isinstance(file_meta.get('modified'), (int, float)) else 0
                    )

                    if fp in cached_entries and cached_entries[fp].get('signature') == signature:
                        entry = cached_entries[fp]
                    else:
                        try:
                            if self.state.index_mode == "universal":
                                entry = summarize_workbook_universal(fp)
                            else:
                                entry = summarize_workbook(fp)
                            entry['path'] = fp
                            entry['signature'] = signature
                        except Exception as e:
                            entry = {
                                'file': Path(fp).name, 'path': fp, 'type': 'Error',
                                'error': str(e), 'records': [], 'bomVersions': [], 'signature': signature
                            }

                    if self.state.index_mode == "universal":
                        new_entries.append(entry)
                    elif (not self.state.bom_only or entry.get('type') in ('BOM line', 'BOM header', 'Mixed BOM report')):
                        new_entries.append(entry)

                    pct = int(((i + 1) / total) * 100)
                    self.state.result_queue.put(('progress', pct))

                all_entries = {**self.state.entries, **{e['path']: e for e in new_entries}}
                self.state.cache_manager.save_entries(list(all_entries.values()))
                self.state.result_queue.put(('result_files', new_entries))

        except Exception as e:
            self.state.result_queue.put(('error', str(e)))

    def _process_queue(self):
        """Process pending messages from background thread"""
        try:
            while not self.state.result_queue.empty():
                msg = self.state.result_queue.get_nowait()
                if msg[0] == 'status':
                    _, text, color = msg
                    self.window["-STATUS-"].update(text, text_color=color)
                elif msg[0] == 'progress':
                    _, pct = msg
                    self.window["-PROGRESS-"].update(pct)
                elif msg[0] == 'result':
                    _, entries, skipped = msg
                    self.state.entries = {e['path']: e for e in entries}
                    self._rebuild_state_from_entries()
                    msg_text = f"Done. Indexed {len(entries)} files."
                    if skipped:
                        msg_text += f" Skipped {skipped} non-BOM files."
                    self.window["-STATUS-"].update(msg_text, text_color="#0a7f4f")
                    self._update_stats()
                    self._populate_type_filter()
                    self._apply_filters()
                    self._refresh_version_table()
                    self.window["-EXPORT_CSV-"].update(disabled=False)
                    self.state.busy = False
                elif msg[0] == 'result_files':
                    _, entries = msg
                    self.state.entries = self.state.entries.copy()
                    self.state.entries.update({e['path']: e for e in entries})
                    self._rebuild_state_from_entries()
                    self.window["-STATUS-"].update(f"Indexed {len(entries)} files.", text_color="#0a7f4f")
                    self._update_stats()
                    self._populate_type_filter()
                    self._apply_filters()
                    self._refresh_version_table()
                    self.window["-EXPORT_CSV-"].update(disabled=False)
                    self.state.busy = False
                elif msg[0] == 'error':
                    _, err = msg
                    self.window["-STATUS-"].update(f"Error: {err}", text_color="#d32f2f")
                    self.state.busy = False
        except queue.Empty:
            pass

    def _start_indexing(self, folder_path: str):
        if self.state.busy:
            sg.popup("Please wait for the current operation to finish.")
            return
        self.state.busy = True
        self.window["-EXPORT_CSV-"].update(disabled=True)
        self._update_status("Starting indexing...", "#0066cc")
        thread = threading.Thread(target=self._worker_thread, args=(folder_path,), daemon=True)
        thread.start()

    def _start_file_indexing(self, file_paths: List[str]):
        if self.state.busy:
            sg.popup("Please wait for the current operation to finish.")
            return
        self.state.busy = True
        self.window["-EXPORT_CSV-"].update(disabled=True)
        self._update_status("Starting file indexing...", "#0066cc")
        thread = threading.Thread(target=self._worker_thread_files, args=(file_paths,), daemon=True)
        thread.start()

    # ============ Main event loop ============

    def run(self, initial_folder: Optional[str] = None):
        """Main event loop. Optionally start indexing a folder immediately."""
        sg.theme(THEME)
        layout = self._build_layout()
        self.window = sg.Window(APP_TITLE, layout, finalize=True, resizable=True,
                                size=(1400, 800), location=(100, 100))

        # Load saved base path
        try:
            with open("data/config.json") as f:
                cfg = json.load(f)
                self.state.base_path = cfg.get("base_path", "")
                self.window["-BASEPATH-"].update(self.state.base_path)
        except:
            pass

        self._populate_type_filter()
        self._populate_record_filter()
        self._update_status("Ready. Choose index mode, then select dataset folder.")
        self._update_mode_ui()

        # If an initial folder is provided, start indexing in background
        if initial_folder and Path(initial_folder).exists():
            self._start_indexing(initial_folder)

        while True:
            # Process any pending queue messages from background threads
            self._process_queue()
            
            event, values = self.window.read(timeout=100)

            # Debounce heavy filtering/lookup so typing remains responsive.
            now = time.monotonic()
            if self.state.search_dirty and (now - self.state.last_search_change_at) >= QUERY_DEBOUNCE_SEC:
                self.state.search_dirty = False
                self._apply_filters()
            if self.state.lookup_dirty and (now - self.state.last_lookup_change_at) >= QUERY_DEBOUNCE_SEC:
                self.state.lookup_dirty = False
                if not self.state.lookup_text:
                    self._clear_lookup()
                else:
                    self._perform_lookup()

            if event == sg.WIN_CLOSED:
                break

            if event in ("-SELECT_FOLDER-", "-FOLDER-"):
                self._handle_select_folder()

            elif event == "-SELECT_FILES-":
                self._handle_select_files()

            elif event == "-LOAD_CACHE-":
                self._handle_load_cache()

            elif event == "-EXPORT_CSV-":
                self._handle_export_csv()

            elif event in ("-SEARCH-", "-TYPE_FILTER-", "-RECORD_FILTER-"):
                self._on_search(values)

            elif event == "-SAVE_PATH-":
                self._on_basepath_save(values)

            elif event == "-CLEAR_PATH-":
                self._on_basepath_clear()

            elif event == "-LOOKUP-":
                self._on_lookup(values)

            elif event == "-CLEAR_LOOKUP-":
                self._clear_lookup()

            elif event == "-RUN_BATCH-":
                self._on_batch(values)

            elif event == "-CLEAR_BATCH-":
                self._clear_batch()

            elif event == "-TABLE-":
                self._handle_row_select(values)

            elif event == "-TABLE_UNI-":
                self._handle_row_select(values)

            elif event == "-OPEN_SELECTED_FILE-":
                self._open_selected_file()

            elif event == "-BOM_ONLY-":
                self.state.bom_only = values["-BOM_ONLY-"]

            elif event == "-INDEX_MODE-":
                selected = values["-INDEX_MODE-"]
                self.state.index_mode = "universal" if selected == "Universal (all rows)" else "bom"
                self._update_mode_ui()
                if self.state.index_mode == "universal":
                    self._update_status("Universal mode selected: indexing every non-empty row in every Excel file.")
                else:
                    self._update_status("BOM focused mode selected.")

        self.window.close()


def run_gui(initial_folder: Optional[str] = None):
    app = BOMIndexerGUI()
    app.run(initial_folder=initial_folder)


if __name__ == "__main__":
    run_gui()
