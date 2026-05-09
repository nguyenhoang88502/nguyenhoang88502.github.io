"""Shared Utility Functions - Reusable across modules"""

from typing import List, Any


def unique(values: List[Any]) -> List[Any]:
    """Remove duplicates while preserving order"""
    seen = set()
    result = []
    for v in values:
        if v not in seen:
            seen.add(v)
            result.append(v)
    return result


def isFractional(value: Any) -> bool:
    """Check if numeric value has fractional part"""
    try:
        num = float(value)
        return abs(num % 1) > 0.000001
    except (ValueError, TypeError):
        return False


def valueAt(row: List[str], index: int) -> str:
    """Get value at column index safely"""
    # Import text function from bom_classifier to avoid circular imports
    from .bom_classifier import text
    return text(row[index]) if 0 <= index < len(row) else ""
