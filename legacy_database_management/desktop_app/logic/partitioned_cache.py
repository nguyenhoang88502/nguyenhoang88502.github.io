"""Partitioned Cache Manager - Robust incremental file-system synchronization engine"""

import sqlite3
import json
import os
import hashlib
import time
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from pathlib import Path
from threading import Lock


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


class PartitionedCacheManager:
    """Manages partitioned SQLite cache for high-performance metadata management"""

    def __init__(self, db_path: str = "data/partitioned_cache", max_partition_size_mb: int = 100):
        self.db_path = Path(db_path)
        self.max_partition_size_mb = max_partition_size_mb
        self.lock = Lock()
        self._ensure_parent_dir()
        self.partitions: Dict[str, sqlite3.Connection] = {}
        self.partition_sizes: Dict[str, int] = {}  # Track sizes for balancing

    def _ensure_parent_dir(self):
        """Create parent directory for database if needed"""
        self.db_path.mkdir(parents=True, exist_ok=True)

    def _get_partition_name(self, key: str) -> str:
        """Determine which partition a key belongs to"""
        # Simple hash-based partitioning
        hash_obj = hashlib.md5(key.encode())
        hash_hex = hash_obj.hexdigest()
        partition_index = int(hash_hex, 16) % 10  # 10 partitions
        return f"cache_part_{partition_index}.db"

    def _get_partition_connection(self, partition_name: str) -> sqlite3.Connection:
        """Get or create a connection to a partition"""
        if partition_name not in self.partitions:
            partition_path = self.db_path / partition_name
            conn = sqlite3.connect(str(partition_path), check_same_thread=False)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.execute("PRAGMA temp_store=MEMORY")
            self._create_partition_tables(conn)
            self.partitions[partition_name] = conn
            
            # Update size tracking
            try:
                size = partition_path.stat().st_size
                self.partition_sizes[partition_name] = size
            except:
                self.partition_sizes[partition_name] = 0
                
        return self.partitions[partition_name]

    def _create_partition_tables(self, conn: sqlite3.Connection):
        """Create required tables for a partition"""
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS cache_entries (
                path TEXT PRIMARY KEY,
                file_signature TEXT NOT NULL,
                entry_data TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                partition_key TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_cache_entries_signature ON cache_entries(file_signature);
            CREATE INDEX IF NOT EXISTS idx_cache_entries_updated ON cache_entries(updated_at);
            CREATE INDEX IF NOT EXISTS idx_cache_entries_partition ON cache_entries(partition_key);

            CREATE TABLE IF NOT EXISTS cache_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL,
                sheet TEXT NOT NULL,
                row_no INTEGER NOT NULL,
                col_no TEXT,
                row_text TEXT NOT NULL,
                row_search_text TEXT NOT NULL,
                partition_key TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_cache_records_path ON cache_records(path);
            CREATE INDEX IF NOT EXISTS idx_cache_records_sheet_row ON cache_records(sheet, row_no);
            CREATE INDEX IF NOT EXISTS idx_cache_records_partition ON cache_records(partition_key);
        """)
        
        # Try to create FTS5 table for search capability
        try:
            conn.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS cache_records_fts
                USING fts5(row_search_text, content='cache_records', content_rowid='id')
            """)
            conn.executescript("""
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
            # SQLite build may not include FTS5
            pass

    def _check_partition_size(self, partition_name: str) -> bool:
        """Check if a partition has exceeded the size limit"""
        max_bytes = self.max_partition_size_mb * 1024 * 1024
        try:
            size = self.partition_sizes.get(partition_name, 0)
            return size > max_bytes
        except:
            return False

    def _enforce_partition_size(self, partition_name: str):
        """Raise an error if the partition has exceeded the maximum allowed size.
        
        This is called before writing to prevent SQLite corruption from
        oversized database files.
        """
        max_bytes = self.max_partition_size_mb * 1024 * 1024
        size = self.partition_sizes.get(partition_name, 0)
        if size > max_bytes:
            raise RuntimeError(
                f"Partition {partition_name} has exceeded the {self.max_partition_size_mb}MB "
                f"size limit ({size / (1024*1024):.1f}MB). "
                f"Run cache cleanup to remove stale entries or increase max_partition_size_mb."
            )

    def _vacuum_partition(self, partition_name: str):
        """Vacuum a partition to reclaim disk space after deletions"""
        try:
            conn = self._get_partition_connection(partition_name)
            conn.execute("PRAGMA auto_vacuum=FULL")
            conn.execute("VACUUM")
            partition_path = self.db_path / partition_name
            size = partition_path.stat().st_size
            self.partition_sizes[partition_name] = size
        except Exception:
            pass

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

    def get_file_metadata(self, filepath: str) -> Tuple[int, int]:
        """Get file size and modification time"""
        try:
            stat = os.stat(filepath)
            return stat.st_size, stat_mtime_ms(stat)
        except Exception:
            return 0, 0

    def load_entries(self) -> Dict[str, Dict[str, Any]]:
        """Load all cache entries from all partitions into a dict keyed by file path.
        
        Each entry dict includes a 'signature' key sourced from the file_signature column,
        which enables the delta-update mechanism to skip unchanged files.
        """
        with self.lock:
            entries = {}
            for partition_name in self._list_partitions():
                try:
                    conn = self._get_partition_connection(partition_name)
                    cursor = conn.execute("SELECT path, file_signature, entry_data FROM cache_entries")
                    for row in cursor:
                        try:
                            entry = json.loads(row['entry_data'])
                            entry['signature'] = row['file_signature'] or ''
                            entries[row['path']] = entry
                        except json.JSONDecodeError:
                            continue
                except Exception:
                    continue
            return entries

    def _list_partitions(self) -> List[str]:
        """List all partition files"""
        partitions = []
        if self.db_path.exists():
            for file_path in self.db_path.iterdir():
                if file_path.suffix == '.db' and file_path.name.startswith('cache_part_'):
                    partitions.append(file_path.name)
        return partitions if partitions else ['cache_part_0.db']  # Default partition

    def save_entries_incremental(self, entries: List[Dict[str, Any]], force_all: bool = False):
        """Save entries incrementally, only updating changed files"""
        if not entries:
            return

        with self.lock:
            # Load existing entries for comparison if not forcing full update
            existing_entries = {} if force_all else self._load_entries_unlocked()
            
            # Group entries by partition
            partitioned_entries = {}
            for entry in entries:
                path = entry.get('path', '')
                partition_key = self._get_partition_name(path)
                if partition_key not in partitioned_entries:
                    partitioned_entries[partition_key] = []
                partitioned_entries[partition_key].append(entry)

            # Process each partition
            for partition_key, partition_entries in partitioned_entries.items():
                self._save_partition_entries(partition_key, partition_entries, existing_entries)

    def _load_entries_unlocked(self) -> Dict[str, Dict[str, Any]]:
        """Internal: load entries without acquiring the lock (caller must hold it)"""
        entries = {}
        for partition_name in self._list_partitions():
            try:
                conn = self._get_partition_connection(partition_name)
                cursor = conn.execute("SELECT path, file_signature, entry_data FROM cache_entries")
                for row in cursor:
                    try:
                        entry = json.loads(row['entry_data'])
                        entry['signature'] = row['file_signature'] or ''
                        entries[row['path']] = entry
                    except json.JSONDecodeError:
                        continue
            except Exception:
                continue
        return entries

    def _save_partition_entries(self, partition_key: str, entries: List[Dict[str, Any]], 
                               existing_entries: Dict[str, Dict[str, Any]]):
        """Save entries to a specific partition"""
        conn = self._get_partition_connection(partition_key)
        self._enforce_partition_size(partition_key)

        try:
            conn.execute("BEGIN TRANSACTION")
            
            for entry in entries:
                path = entry.get('path', '')
                signature = entry.get('signature', '')
                
                # Check if entry has changed
                existing_entry = existing_entries.get(path)
                if existing_entry and existing_entry.get('signature') == signature and not existing_entries.get('__force_update', False):
                    # Skip unchanged entries
                    continue
                
                # Remove signature from stored data to avoid duplication
                entry_copy = {k: v for k, v in entry.items() if k != 'signature'}
                entry_json = json.dumps(entry_copy, ensure_ascii=False, separators=(',', ':'))
                updated_at = datetime.utcnow().isoformat() + "Z"

                # Upsert cache entry
                conn.execute("""
                    INSERT OR REPLACE INTO cache_entries 
                    (path, file_signature, entry_data, updated_at, partition_key)
                    VALUES (?, ?, ?, ?, ?)
                """, (path, signature, entry_json, updated_at, partition_key))
                
                # Update records if they exist
                conn.execute("DELETE FROM cache_records WHERE path=?", (path,))
                conn.execute("DELETE FROM cache_records_fts WHERE rowid IN (SELECT id FROM cache_records WHERE path=?)", (path,))
                
                record_rows = []
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
                    record_rows.append((path, sheet, int(row_no), col_no, row_text, row_search_text, partition_key))

                if record_rows:
                    conn.executemany("""
                        INSERT INTO cache_records(path, sheet, row_no, col_no, row_text, row_search_text, partition_key)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, record_rows)

            conn.commit()
            
            # Update size tracking
            try:
                partition_path = self.db_path / partition_key
                size = partition_path.stat().st_size
                self.partition_sizes[partition_key] = size
            except:
                pass
                
        except Exception as e:
            conn.rollback()
            raise

    def search_records_fts(self, term: str, exact: bool = False, limit: int = 10000) -> List[Dict[str, Any]]:
        """Search row text via SQLite FTS5 across all partitions and return universal-style records."""
        with self.lock:
            results = []
            for partition_name in self._list_partitions():
                try:
                    conn = self._get_partition_connection(partition_name)
                    fts_query = self._build_fts_query(term, exact=exact)
                    if not fts_query:
                        continue

                    try:
                        rows = conn.execute(
                            """
                            SELECT r.path, r.sheet, r.row_no, r.col_no, r.row_text, e.file_signature
                            FROM cache_records_fts f
                            JOIN cache_records r ON r.id = f.rowid
                            LEFT JOIN cache_entries e ON e.path = r.path
                            WHERE f.row_search_text MATCH ?
                            ORDER BY bm25(cache_records_fts), r.path, r.sheet, r.row_no
                            LIMIT ?
                            """,
                            (fts_query, int(limit // len(self._list_partitions())) if self._list_partitions() else limit)
                        ).fetchall()
                    except sqlite3.OperationalError:
                        # Fallback if FTS5 isn't available.
                        like_term = f"%{(term or '').strip().lower()}%"
                        rows = conn.execute(
                            """
                            SELECT r.path, r.sheet, r.row_no, r.col_no, r.row_text, e.file_signature
                            FROM cache_records r
                            LEFT JOIN cache_entries e ON e.path = r.path
                            WHERE lower(r.row_search_text) LIKE ?
                            ORDER BY r.path, r.sheet, r.row_no
                            LIMIT ?
                            """,
                            (like_term, int(limit // len(self._list_partitions())) if self._list_partitions() else limit)
                        ).fetchall()

                    from logic.bom_classifier import extractUniversalRowFields

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
                        
                    if len(results) >= limit:
                        break
                        
                except Exception:
                    continue
                    
            return results[:limit]

    def _build_fts_query(self, term: str, exact: bool = False) -> str:
        """Build FTS query string"""
        cleaned = (term or "").strip()
        if not cleaned:
            return ""
        if exact:
            return f"\"{cleaned.replace('\"', ' ')}\""
        tokens = [t for t in cleaned.replace('\t', ' ').split(' ') if t]
        if not tokens:
            return ""
        return " AND ".join([f"{t.replace('\"', '')}*" for t in tokens])

    def get_manifest(self) -> Dict[str, Any]:
        """Get cache manifest info across all partitions"""
        with self.lock:
            manifest = {
                'partition_count': 0,
                'total_entries': 0,
                'partitions': {},
                'generated_at': datetime.utcnow().isoformat() + "Z"
            }
            
            for partition_name in self._list_partitions():
                try:
                    conn = self._get_partition_connection(partition_name)
                    row = conn.execute("SELECT COUNT(*) as c FROM cache_entries").fetchone()
                    entry_count = row['c'] if row else 0
                    
                    manifest['partitions'][partition_name] = {
                        'entries': entry_count,
                        'size_mb': self.partition_sizes.get(partition_name, 0) / (1024 * 1024)
                    }
                    manifest['total_entries'] += entry_count
                    manifest['partition_count'] += 1
                except Exception:
                    continue
                    
            return manifest

    def clear(self):
        """Clear all cache data"""
        with self.lock:
            for partition_name in self._list_partitions():
                try:
                    conn = self._get_partition_connection(partition_name)
                    conn.execute("DELETE FROM cache_entries")
                    conn.execute("DELETE FROM cache_records")
                    conn.commit()
                except Exception:
                    continue

    def count(self) -> int:
        """Get number of cached entries across all partitions"""
        with self.lock:
            total = 0
            for partition_name in self._list_partitions():
                try:
                    conn = self._get_partition_connection(partition_name)
                    row = conn.execute("SELECT COUNT(*) as c FROM cache_entries").fetchone()
                    total += row['c'] if row else 0
                except Exception:
                    continue
            return total

    def remove_entry(self, path: str):
        """Remove a specific entry from cache"""
        with self.lock:
            partition_key = self._get_partition_name(path)
            try:
                conn = self._get_partition_connection(partition_key)
                conn.execute("DELETE FROM cache_entries WHERE path=?", (path,))
                conn.execute("DELETE FROM cache_records WHERE path=?", (path,))
                conn.commit()
            except Exception:
                pass

    def entry_exists(self, path: str) -> bool:
        """Check if an entry exists in cache"""
        with self.lock:
            partition_key = self._get_partition_name(path)
            try:
                conn = self._get_partition_connection(partition_key)
                row = conn.execute("SELECT 1 FROM cache_entries WHERE path=?", (path,)).fetchone()
                return row is not None
            except Exception:
                return False

    def close(self):
        """Close all database connections"""
        with self.lock:
            for conn in self.partitions.values():
                try:
                    conn.close()
                except Exception:
                    pass
            self.partitions.clear()

    def get_dashboard_data(self) -> Dict[str, Any]:
        """Get detailed partition statistics suitable for a monitoring dashboard.
        
        Returns per-partition entry counts, sizes, record counts, and
        last-updated timestamps for GUI monitoring dashboard display.
        """
        with self.lock:
            partitions_detail = {}
            total_entries = 0
            total_records = 0
            total_size_bytes = 0

            for partition_name in sorted(self._list_partitions()):
                try:
                    conn = self._get_partition_connection(partition_name)
                    entry_row = conn.execute("SELECT COUNT(*) as c FROM cache_entries").fetchone()
                    record_row = conn.execute("SELECT COUNT(*) as c FROM cache_records").fetchone()
                    updated_row = conn.execute(
                        "SELECT MAX(updated_at) as last_updated FROM cache_entries"
                    ).fetchone()

                    partition_path = self.db_path / partition_name
                    try:
                        size = partition_path.stat().st_size
                    except Exception:
                        size = 0
                    self.partition_sizes[partition_name] = size

                    entry_count = entry_row['c'] if entry_row else 0
                    record_count = record_row['c'] if record_row else 0

                    partitions_detail[partition_name] = {
                        'entries': entry_count,
                        'records': record_count,
                        'size_bytes': size,
                        'size_mb': round(size / (1024 * 1024), 2),
                        'last_updated': updated_row['last_updated'] if updated_row else None,
                        'is_full': size > (self.max_partition_size_mb * 1024 * 1024)
                    }
                    total_entries += entry_count
                    total_records += record_count
                    total_size_bytes += size
                except Exception:
                    continue

            return {
                'total_partitions': len(partitions_detail),
                'max_partition_size_mb': self.max_partition_size_mb,
                'total_entries': total_entries,
                'total_records': total_records,
                'total_size_mb': round(total_size_bytes / (1024 * 1024), 2),
                'partitions': partitions_detail,
                'generated_at': datetime.utcnow().isoformat() + "Z"
            }

    def cleanup_deleted_files(self, known_paths: List[str]) -> int:
        """Remove cache entries for files that no longer exist in the dataset.
        
        Args:
            known_paths: List of file paths that still exist on disk.
            
        Returns:
            Number of entries removed.
        """
        with self.lock:
            known_set = set(known_paths)
            removed = 0
            for partition_name in self._list_partitions():
                try:
                    conn = self._get_partition_connection(partition_name)
                    cursor = conn.execute("SELECT path FROM cache_entries")
                    stale_paths = [row['path'] for row in cursor if row['path'] not in known_set]

                    if stale_paths:
                        for stale_path in stale_paths:
                            conn.execute("DELETE FROM cache_entries WHERE path=?", (stale_path,))
                            conn.execute("DELETE FROM cache_records WHERE path=?", (stale_path,))
                        conn.commit()
                        removed += len(stale_paths)

                        try:
                            self._vacuum_partition(partition_name)
                        except Exception:
                            pass
                except Exception:
                    continue
            return removed

    def backup_partitions(self, backup_dir: str = "data/partitioned_cache_backup") -> str:
        """Create a backup of all partitioned cache databases.
        
        Args:
            backup_dir: Directory to store backup copies.
            
        Returns:
            Path to the backup directory, or empty string on failure.
        """
        import shutil
        backup_path = Path(backup_dir)
        try:
            backup_path.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

            with self.lock:
                for partition_name in sorted(self._list_partitions()):
                    src = self.db_path / partition_name
                    if src.exists():
                        dst = backup_path / f"{timestamp}_{partition_name}"
                        shutil.copy2(str(src), str(dst))

            manifest = self.get_dashboard_data()
            manifest_file = backup_path / f"{timestamp}_manifest.json"
            with open(manifest_file, 'w') as f:
                json.dump(manifest, f, indent=2)

            return str(backup_path)
        except Exception:
            return ""

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


# Web asset caching utilities
class WebAssetCache:
    """Cache manager for web application assets with incremental update support"""
    
    def __init__(self, cache_dir: str = "data/web_cache"):
        self.cache_dir = Path(cache_dir)
        self.manifest_file = self.cache_dir / "manifest.json"
        self._ensure_cache_dir()
        
    def _ensure_cache_dir(self):
        """Ensure cache directory exists"""
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
    def _compute_file_hash(self, filepath: Path) -> str:
        """Compute SHA256 hash of a file"""
        hash_sha256 = hashlib.sha256()
        try:
            with open(filepath, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_sha256.update(chunk)
            return hash_sha256.hexdigest()
        except Exception:
            return ""
            
    def update_assets(self, asset_dir: Path) -> Dict[str, Any]:
        """Incrementally update web assets cache"""
        manifest = self._load_manifest()
        updated_assets = {}
        
        # Walk through asset directory
        for file_path in asset_dir.rglob("*"):
            if file_path.is_file():
                rel_path = file_path.relative_to(asset_dir).as_posix()
                file_hash = self._compute_file_hash(file_path)
                
                # Check if file has changed
                if (rel_path not in manifest or 
                    manifest[rel_path].get('hash') != file_hash or
                    manifest[rel_path].get('mtime') != file_path.stat().st_mtime):
                    
                    # Copy file to cache
                    cache_path = self.cache_dir / rel_path
                    cache_path.parent.mkdir(parents=True, exist_ok=True)
                    
                    try:
                        import shutil
                        shutil.copy2(file_path, cache_path)
                        
                        # Update manifest
                        manifest[rel_path] = {
                            'hash': file_hash,
                            'mtime': file_path.stat().st_mtime,
                            'size': file_path.stat().st_size,
                            'cached_at': time.time()
                        }
                        updated_assets[rel_path] = manifest[rel_path]
                    except Exception as e:
                        print(f"Failed to cache {rel_path}: {e}")
        
        # Save updated manifest
        self._save_manifest(manifest)
        return updated_assets
        
    def _load_manifest(self) -> Dict[str, Any]:
        """Load asset manifest"""
        if self.manifest_file.exists():
            try:
                with open(self.manifest_file, 'r') as f:
                    return json.load(f)
            except Exception:
                pass
        return {}
        
    def _save_manifest(self, manifest: Dict[str, Any]):
        """Save asset manifest"""
        try:
            with open(self.manifest_file, 'w') as f:
                json.dump(manifest, f, indent=2)
        except Exception:
            pass
            
    def get_changed_assets(self, asset_dir: Path) -> List[str]:
        """Get list of changed assets that need updating"""
        manifest = self._load_manifest()
        changed_assets = []
        
        for file_path in asset_dir.rglob("*"):
            if file_path.is_file():
                rel_path = file_path.relative_to(asset_dir).as_posix()
                file_hash = self._compute_file_hash(file_path)
                
                if (rel_path not in manifest or 
                    manifest[rel_path].get('hash') != file_hash):
                    changed_assets.append(rel_path)
                    
        return changed_assets
