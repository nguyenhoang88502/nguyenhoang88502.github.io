"""Web Asset Synchronization Module"""

import os
import hashlib
import json
import time
from pathlib import Path
from typing import Dict, List, Any, Optional
from logic.partitioned_cache import WebAssetCache


def sync_web_assets(asset_dir: str = "ui/assets", cache_dir: str = "data/web_cache") -> Dict[str, Any]:
    """
    Synchronize web assets with incremental update support.
    
    Args:
        asset_dir: Directory containing source web assets
        cache_dir: Directory for cached web assets
        
    Returns:
        Dictionary with synchronization results
    """
    asset_path = Path(asset_dir)
    if not asset_path.exists():
        return {"error": f"Asset directory not found: {asset_dir}"}
    
    # Initialize web asset cache
    web_cache = WebAssetCache(cache_dir)
    
    # Update assets
    updated_assets = web_cache.update_assets(asset_path)
    
    return {
        "success": True,
        "updated_assets": len(updated_assets),
        "assets": updated_assets
    }


def get_changed_web_assets(asset_dir: str = "ui/assets", cache_dir: str = "data/web_cache") -> List[str]:
    """
    Get list of web assets that have changed since last sync.
    
    Args:
        asset_dir: Directory containing source web assets
        cache_dir: Directory for cached web assets
        
    Returns:
        List of changed asset paths
    """
    asset_path = Path(asset_dir)
    if not asset_path.exists():
        return []
    
    # Initialize web asset cache
    web_cache = WebAssetCache(cache_dir)
    
    # Get changed assets
    return web_cache.get_changed_assets(asset_path)


def compute_file_hash(filepath: Path) -> str:
    """Compute SHA256 hash of a file"""
    hash_sha256 = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    except Exception:
        return ""


def sync_html_assets(html_file: str = "Indexing_web.html", cache_dir: str = "data/web_cache") -> Dict[str, Any]:
    """
    Synchronize HTML assets with content hashing for change detection.
    
    Args:
        html_file: Path to the main HTML file
        cache_dir: Directory for cached assets
        
    Returns:
        Dictionary with synchronization results
    """
    html_path = Path(html_file)
    if not html_path.exists():
        return {"error": f"HTML file not found: {html_file}"}
    
    # Compute hash of current HTML file
    current_hash = compute_file_hash(html_path)
    
    # Load manifest
    cache_path = Path(cache_dir)
    cache_path.mkdir(parents=True, exist_ok=True)
    manifest_file = cache_path / "manifest.json"
    
    manifest = {}
    if manifest_file.exists():
        try:
            with open(manifest_file, 'r') as f:
                manifest = json.load(f)
        except Exception:
            pass
    
    # Check if HTML file has changed
    html_changed = manifest.get("index_html", {}).get("hash") != current_hash
    
    if html_changed:
        # Copy HTML file to cache
        cached_html = cache_path / "index.html"
        try:
            import shutil
            shutil.copy2(html_path, cached_html)
            
            # Update manifest
            manifest["index_html"] = {
                "hash": current_hash,
                "mtime": html_path.stat().st_mtime,
                "size": html_path.stat().st_size,
                "cached_at": time.time()
            }
            
            # Save manifest
            with open(manifest_file, 'w') as f:
                json.dump(manifest, f, indent=2)
                
            return {
                "success": True,
                "html_changed": True,
                "cached_file": str(cached_html)
            }
        except Exception as e:
            return {"error": f"Failed to cache HTML file: {e}"}
    else:
        return {
            "success": True,
            "html_changed": False,
            "message": "HTML file unchanged"
        }


if __name__ == "__main__":
    # Example usage
    print("Synchronizing web assets...")
    result = sync_web_assets()
    print(json.dumps(result, indent=2))
    
    print("\nChecking for changed HTML assets...")
    changed = get_changed_web_assets()
    print(f"Changed assets: {changed}")
    
    print("\nSynchronizing HTML file...")
    html_result = sync_html_assets()
    print(json.dumps(html_result, indent=2))