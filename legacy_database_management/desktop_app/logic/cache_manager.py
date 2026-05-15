"""Cache Manager Module - SQLite-based indexing cache for persistent storage"""

import sqlite3
import json
import os
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path


def stat_mtime_ms(stat_result: os.stat_result) -> int:
    """Return filesystem modified time as integer milliseconds."""
    return int(stat_result.st_mtime_ns // 1_000_000)


def modified_from_signature(signature: str) -> str:
    parts = (signature or "").split("|")
    try:
        mtime_ms = int(parts[2]) if len(parts) >= 3 else 0
        if mtime_ms <= 0:
            return ""
        return datetime.fromtimestamp(mtime_ms / 1000).strftime("%d/%m/%Y")
    except (TypeError, ValueError, OSError):
        return ""


class CacheManager:
    """Manages SQLite cache for BOM dataset indexes"""

    def __init__(self, db_path: str = "data/cache.db"):
        self.db_path = db_path
        self.conn: Optional[sqlite3.Connection] = None
        self._ensure_parent_dir()

    def _ensure_parent_dir(self):
        """Create parent directory for database if needed"""
        p = Path(self.db_path)
        p.parent.mkdir(parents=True, exist_ok=True)

    def connect(self):
        """Establish database connection and initialize schema"""
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA synchronous=NORMAL")
        self.conn.execute("PRAGMA temp_store=MEMORY")
        self._create_tables()

    def _create_tables(self):
        """Create required tables if they don't exist"""
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS cache_manifest (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                version INTEGER NOT NULL,
                generated_at TEXT NOT NULL,
                entry_count INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS cache_entries (
                path TEXT PRIMARY KEY,
                file_signature TEXT NOT NULL,
                entry_data TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_cache_entries_signature ON cache_entries(file_signature);
            CREATE INDEX IF NOT EXISTS idx_cache_entries_updated ON cache_entries(updated_at);

            CREATE TABLE IF NOT EXISTS cache_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL,
                sheet TEXT NOT NULL,
                row_no INTEGER NOT NULL,
                col_no TEXT,
                row_text TEXT NOT NULL,
                row_search_text TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_cache_records_path ON cache_records(path);
            CREATE INDEX IF NOT EXISTS idx_cache_records_sheet_row ON cache_records(sheet, row_no);
        """)
        # FTS5 index for row-level full text search (best-effort if FTS5 is available).
        try:
            self.conn.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS cache_records_fts
                USING fts5(row_search_text, content='cache_records', content_rowid='id')
            """)
            self.conn.executescript("""
                CREATE TRIGGER IF NOT EXISTS cache_records_ai AFTER INSERT ON cache_records BEGIN
                    INSERT INTO cache_records_fts(rowid, row_search_text) VALUES (new.id, new.row_search_text);
                END;
                CREATE TRIGGER IF NOT EXISTS cache_records_ad AFTER DELETE ON cache_records BEGIN
                    INSERT INTO cache_records_fts(cache_records_fts, rowid, row_search_text) VALUES('delete', old.id, old.row_search_text);
                END;
                CREATE TRIGGER IF NOT EXISTS cache_records_au AFTER UPDATE ON cache_records BEGIN
                    INSERT INTO cache_records_fts(cache_records_fts, rowid, row_search_text) VALUES('delete', old.id, old.row_search_text);
                    INSERT INTO cache_records_fts(rowid, row_search_text) VALUES (new.id, new.row_search_text);
                END;
            """)
        except sqlite3.OperationalError:
            # SQLite build may not include FTS5; app continues with non-FTS behavior.
            pass

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            self.conn = None

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def file_signature(self, filepath: str, size: int, mtime: Optional[int] = None) -> str:
        """Generate file signature for change detection"""
        if mtime is None:
            try:
                stat = os.stat(filepath)
                mtime = stat_mtime_ms(stat)
                size = stat.st_size
            except Exception:
                pass
        return f"{filepath}|{size}|{mtime or 0}"

    def load_entries(self) -> Dict[str, Dict[str, Any]]:
        """Load all cache entries from database into a dict keyed by file path.
        
        Each entry dict includes a 'signature' key sourced from the file_signature column.
        """
        if not self.conn:
            raise RuntimeError("Database not connected. Call connect() first.")

        cursor = self.conn.execute("SELECT path, file_signature, entry_data FROM cache_entries")
        entries = {}
        for row in cursor:
            try:
                entry = json.loads(row['entry_data'])
                entry['signature'] = row['file_signature'] or ''
                entries[row['path']] = entry
            except json.JSONDecodeError:
                continue
        return entries

    def save_entries(self, entries: List[Dict[str, Any]], version: int = 10):
        """Save list of entries to cache (replaces all entries atomically)"""
        if not self.conn:
            raise RuntimeError("Database not connected. Call connect() first.")

        generated_at = datetime.utcnow().isoformat() + "Z"

        try:
            self.conn.execute("BEGIN TRANSACTION")
            # Clear existing cache entries
            self.conn.execute("DELETE FROM cache_entries")
            self.conn.execute("DELETE FROM cache_records")

            # Insert new entries
            for entry in entries:
                path = entry.get('path', '')
                signature = entry.get('signature', '')
                # Remove signature from stored data to avoid duplication
                entry_copy = {k: v for k, v in entry.items() if k != 'signature'}
                entry_json = json.dumps(entry_copy, ensure_ascii=False, separators=(',', ':'))

                self.conn.execute(
                    "INSERT INTO cache_entries (path, file_signature, entry_data, updated_at) VALUES (?, ?, ?, ?)",
                    (path, signature, entry_json, generated_at)
                )

            # Update manifest
            self.conn.execute("""
                INSERT OR REPLACE INTO cache_manifest (id, version, generated_at, entry_count)
                VALUES (1, ?, ?, ?)
            """, (version, generated_at, len(entries)))

            self._insert_record_rows(entries)

            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            raise

    def _insert_record_rows(self, entries: List[Dict[str, Any]]):
        record_rows = []
        for entry in entries:
            path = entry.get('path', '')
            for rec in entry.get('records', []) or []:
                row_no = rec.get('row', 0) or 0
                col_no = str(rec.get('column', '') or '')
                sheet = rec.get('sheet', '') or ''
                row_text = rec.get('text', '') or ''
                row_search_text = rec.get('searchText', '') or ''
                if not row_search_text and row_text:
                    row_search_text = row_text.lower()
                if not row_text and not row_search_text:
                    continue
                record_rows.append((path, sheet, int(row_no), col_no, row_text, row_search_text))

        if record_rows:
            self.conn.executemany(
                """
                INSERT INTO cache_records(path, sheet, row_no, col_no, row_text, row_search_text)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                record_rows
            )

    def count_records(self) -> int:
        if not self.conn:
            raise RuntimeError("Database not connected.")
        row = self.conn.execute("SELECT COUNT(*) AS c FROM cache_records").fetchone()
        return row['c'] if row else 0

    def rebuild_records_index(self, entries: List[Dict[str, Any]]):
        if not self.conn:
            raise RuntimeError("Database not connected.")
        self.conn.execute("BEGIN TRANSACTION")
        try:
            self.conn.execute("DELETE FROM cache_records")
            self._insert_record_rows(entries)
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise

    def _build_fts_query(self, term: str, exact: bool = False) -> str:
        cleaned = (term or "").strip()
        if not cleaned:
            return ""
        # Keep quoting simple and robust for user input.
        if exact:
            return f"\"{cleaned.replace('\"', ' ')}\""
        tokens = [t for t in cleaned.replace('\t', ' ').split(' ') if t]
        if not tokens:
            return ""
        # Prefix matching keeps lookup flexible while staying in FTS.
        return " AND ".join([f"{t.replace('\"', '')}*" for t in tokens])

    def search_records_fts(self, term: str, exact: bool = False, limit: int = 10000) -> List[Dict[str, Any]]:
        """Search row text via SQLite FTS5 and return universal-style records."""
        if not self.conn:
            raise RuntimeError("Database not connected.")
        fts_query = self._build_fts_query(term, exact=exact)
        if not fts_query:
            return []

        try:
            rows = self.conn.execute(
                """
                SELECT r.path, r.sheet, r.row_no, r.col_no, r.row_text, e.file_signature
                FROM cache_records_fts f
                JOIN cache_records r ON r.id = f.rowid
                LEFT JOIN cache_entries e ON e.path = r.path
                WHERE f.row_search_text MATCH ?
                ORDER BY bm25(cache_records_fts), r.path, r.sheet, r.row_no
                LIMIT ?
                """,
                (fts_query, int(limit))
            ).fetchall()
        except sqlite3.OperationalError:
            # Fallback if FTS5 isn't available.
            like_term = f"%{(term or '').strip().lower()}%"
            rows = self.conn.execute(
                """
                SELECT r.path, r.sheet, r.row_no, r.col_no, r.row_text, e.file_signature
                FROM cache_records r
                LEFT JOIN cache_entries e ON e.path = r.path
                WHERE lower(r.row_search_text) LIKE ?
                ORDER BY r.path, r.sheet, r.row_no
                LIMIT ?
                """,
                (like_term, int(limit))
            ).fetchall()

        from logic.bom_classifier import extractUniversalRowFields

        results = []
        for row in rows:
            row_text = row['row_text'] or ''
            extracted = extractUniversalRowFields([part.strip() for part in row_text.split('|')])
            results.append({
                'path': row['path'],
                'modified': modified_from_signature(row['file_signature'] or ''),
                'sheet': row['sheet'],
                'row': row['row_no'],
                'column': row['col_no'] or '',
                'item': extracted.get('item', ''),
                'fgItem': extracted.get('fgItem', ''),
                'fgName': extracted.get('fgName', ''),
                'productName': extracted.get('productName', '') or row_text[:200],
                'mold': extracted.get('mold', ''),
                'text': row_text,
                'searchText': row_text.lower(),
                'file': Path(row['path']).name if row['path'] else ''
            })
        return results

    def get_manifest(self) -> Optional[Dict[str, Any]]:
        """Get current cache manifest info"""
        if not self.conn:
            raise RuntimeError("Database not connected.")

        row = self.conn.execute("SELECT version, generated_at, entry_count FROM cache_manifest WHERE id=1").fetchone()
        if row:
            return dict(row)
        return None

    def clear(self):
        """Clear all cache data"""
        if not self.conn:
            raise RuntimeError("Database not connected.")
        self.conn.execute("DELETE FROM cache_entries")
        self.conn.execute("DELETE FROM cache_manifest")
        self.conn.commit()

    def count(self) -> int:
        """Get number of cached entries"""
        if not self.conn:
            raise RuntimeError("Database not connected.")
        row = self.conn.execute("SELECT COUNT(*) as c FROM cache_entries").fetchone()
        return row['c'] if row else 0

    def remove_entry(self, path: str):
        """Remove a specific entry from cache"""
        if not self.conn:
            raise RuntimeError("Database not connected.")
        self.conn.execute("DELETE FROM cache_entries WHERE path=?", (path,))
        self.conn.commit()

    def entry_exists(self, path: str) -> bool:
        """Check if an entry exists in cache"""
        if not self.conn:
            raise RuntimeError("Database not connected.")
        row = self.conn.execute("SELECT 1 FROM cache_entries WHERE path=?", (path,)).fetchone()
        return row is not None
