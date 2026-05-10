"""Cache Migration Script - Migrate from legacy cache to partitioned cache"""

import os
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from logic.cache_manager import CacheManager
from logic.partitioned_cache import PartitionedCacheManager


def migrate_legacy_cache(legacy_db_path: str = "data/cache.db", 
                        partitioned_cache_path: str = "data/partitioned_cache") -> bool:
    """
    Migrate data from legacy cache to partitioned cache.
    
    Args:
        legacy_db_path: Path to legacy SQLite cache database
        partitioned_cache_path: Path to partitioned cache directory
        
    Returns:
        True if migration successful, False otherwise
    """
    try:
        # Check if legacy cache exists
        if not os.path.exists(legacy_db_path):
            print(f"Legacy cache not found at {legacy_db_path}")
            return False
            
        # Initialize cache managers
        legacy_cache = CacheManager(legacy_db_path)
        partitioned_cache = PartitionedCacheManager(partitioned_cache_path)
        
        # Connect to legacy cache
        legacy_cache.connect()
        
        # Load entries from legacy cache
        print("Loading entries from legacy cache...")
        entries = legacy_cache.load_entries()
        print(f"Loaded {len(entries)} entries from legacy cache")
        
        if not entries:
            print("No entries found in legacy cache")
            return True
            
        # Convert entries to list format expected by partitioned cache
        entries_list = list(entries.values())
        
        # Save to partitioned cache
        print("Saving entries to partitioned cache...")
        partitioned_cache.save_entries_incremental(entries_list, force_all=True)
        print(f"Successfully migrated {len(entries_list)} entries to partitioned cache")
        
        # Close connections
        legacy_cache.close()
        partitioned_cache.close()
        
        return True
        
    except Exception as e:
        print(f"Migration failed: {e}")
        return False


def verify_migration(legacy_db_path: str = "data/cache.db",
                    partitioned_cache_path: str = "data/partitioned_cache") -> bool:
    """
    Verify that migration was successful by comparing entry counts.
    
    Args:
        legacy_db_path: Path to legacy SQLite cache database
        partitioned_cache_path: Path to partitioned cache directory
        
    Returns:
        True if verification successful, False otherwise
    """
    try:
        # Initialize cache managers
        legacy_cache = CacheManager(legacy_db_path)
        partitioned_cache = PartitionedCacheManager(partitioned_cache_path)
        
        # Connect to legacy cache
        legacy_cache.connect()
        
        # Get counts
        legacy_count = legacy_cache.count()
        partitioned_count = partitioned_cache.count()
        
        # Close connections
        legacy_cache.close()
        partitioned_cache.close()
        
        print(f"Legacy cache entries: {legacy_count}")
        print(f"Partitioned cache entries: {partitioned_count}")
        
        if legacy_count == partitioned_count:
            print("Migration verification successful!")
            return True
        else:
            print("Migration verification failed - entry counts don't match")
            return False
            
    except Exception as e:
        print(f"Verification failed: {e}")
        return False


if __name__ == "__main__":
    print("Starting cache migration from legacy to partitioned cache...")
    
    success = migrate_legacy_cache()
    
    if success:
        print("\nVerifying migration...")
        verify_migration()
    else:
        print("Migration failed!")
        sys.exit(1)