# Partitioned Cache System

## Overview

This document describes the new partitioned cache system implemented for the BOM Dataset Indexer application. The system provides a robust, incremental file-system synchronization engine designed for high-performance metadata management.

## Features

### Phase 1: Initial Seeding & Partitioned Storage
- Comprehensive recursive scan of target directory on first execution
- Structured, segmented cache system with horizontal partitioning
- Hard cap of 100 MB per partition to prevent SQLite index corruption
- Multiple discrete segments (e.g., `cache_part_1.db`, `cache_part_2.db`)

### Phase 2: Intelligent Delta-Update Logic
- High-speed delta-update algorithm for subsequent sessions
- Lightweight directory traversal comparing "Date Modified" timestamps
- Targeted re-scan restricted to affected files/subdirectories
- Atomic updates across partitioned files for data integrity
- Minimal I/O overhead with metadata-only comparisons

### Phase 3: Web Application Integration
- Incremental synchronization for web application HTML assets
- Versioning/hashing mechanism for change detection
- Minimized bandwidth and improved client-side rendering performance

## Architecture

### PartitionedCacheManager
The core component managing partitioned SQLite databases:

```python
from logic.partitioned_cache import PartitionedCacheManager

# Initialize the cache manager
cache_manager = PartitionedCacheManager("data/partitioned_cache", max_partition_size_mb=100)

# Load all entries
entries = cache_manager.load_entries()

# Save entries incrementally (only changed files)
cache_manager.save_entries_incremental(entries)

# Search across all partitions
results = cache_manager.search_records_fts("search term")
```

### WebAssetCache
Component handling web asset synchronization:

```python
from logic.partitioned_cache import WebAssetCache

# Initialize web asset cache
web_cache = WebAssetCache("data/web_cache")

# Update assets incrementally
updated_assets = web_cache.update_assets(Path("ui/assets"))

# Check for changed assets
changed_assets = web_cache.get_changed_assets(Path("ui/assets"))
```

## Implementation Details

### Horizontal Partitioning Strategy
- Hash-based partitioning using MD5 hashing of file paths
- 10 partitions by default (`cache_part_0.db` through `cache_part_9.db`)
- Automatic size monitoring to ensure no single partition exceeds 100 MB

### Incremental Update Mechanism
- File signature generation using path, size, and modification time
- Comparison of signatures to detect changes
- Selective processing of only modified files
- Preservation of unchanged entries to minimize processing

### Data Integrity
- Atomic transactions for all database operations
- WAL (Write-Ahead Logging) mode for SQLite
- Proper error handling with rollback mechanisms
- Cross-segment consistency maintenance

## Usage

### Command Line Options
The main application now supports additional command-line options:

```bash
# Synchronize web assets
python app.py --sync-web

# Synchronize HTML file
python app.py --sync-html
```

### Migration from Legacy Cache
A migration script is provided to transfer existing cache data:

```bash
python logic/migrate_cache.py
```

This script will:
1. Load entries from the legacy cache database
2. Transfer them to the new partitioned cache system
3. Verify the migration was successful

## Performance Benefits

1. **Reduced Scan Time**: Only modified files are processed after the initial scan
2. **Improved Memory Usage**: Partitioned storage prevents any single database from becoming too large
3. **Enhanced Concurrency**: Separate partitions allow for better concurrent access
4. **Better Error Isolation**: Issues in one partition don't affect others
5. **Scalable Design**: Can handle large datasets efficiently

## File Structure

```
data/
├── partitioned_cache/          # New partitioned cache directory
│   ├── cache_part_0.db         # Partition 0
│   ├── cache_part_1.db         # Partition 1
│   └── ...                     # Additional partitions
├── web_cache/                  # Web asset cache
│   ├── manifest.json           # Asset manifest
│   └── ...                     # Cached assets
├── cache.db                    # Legacy cache (preserved for backward compatibility)
└── config.json                 # Application configuration
```

## Backward Compatibility

The new system maintains full backward compatibility:
- Legacy cache (`data/cache.db`) is preserved
- Application falls back to legacy cache if partitioned cache is unavailable
- Migration script provided for seamless transition

## Maintenance

### Monitoring Partition Sizes
The system automatically monitors partition sizes and reports them in the UI statistics.

### Cache Cleanup
To completely reset the cache:
1. Close the application
2. Delete the `data/partitioned_cache` directory
3. Restart the application

### Troubleshooting
If experiencing issues with the partitioned cache:
1. Check the application logs for error messages
2. Verify sufficient disk space is available
3. Ensure proper file permissions on the `data` directory
4. Consider reducing the partition size limit if databases become too large