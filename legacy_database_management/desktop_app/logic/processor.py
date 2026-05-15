"""Workbook Summarizer - Core processing engine for Excel analysis"""

from typing import Dict, List, Any
from pathlib import Path
import sys
import os
from datetime import datetime

from logic.bom_classifier import (
    normalize, text, hasKeyValues, isRepeatedKeyHeader, codeValue,
    bomKind, isBomLike, fgKind, isFgLike, fgMatchesInText, isBomCodeInContext,
    containsBomTitle, bomMatchesInText, extractUniversalRowFields,
    hasHeader, hasAnyHeader,
    findHeaderRows, headerColumn, searchText,
    detectType, extractStructuredRows, extractBomVersions, extractItemsAndBoms,
    BOM_TITLE_TERMS, aliases
)
from logic.excel_parser import parse_excel_file, get_file_info, sheet_to_rows
from logic.utils import unique, isFractional, valueAt


def stat_mtime_ms(stat_result: os.stat_result) -> int:
    """Return filesystem modified time as integer milliseconds."""
    return int(stat_result.st_mtime_ns // 1_000_000)


# ============ Workbook Summarization ============

def format_modified(value: Any) -> str:
    """Format file modified timestamp for display/export."""
    try:
        timestamp = float(value or 0)
        if timestamp <= 0:
            return ""
        return datetime.fromtimestamp(timestamp).strftime("%d/%m/%Y")
    except (TypeError, ValueError, OSError):
        return str(value or "")


def add_bom_code(summary: Dict[str, Any], code: str):
    """Add a BOM code to summary-level buckets."""
    if not code:
        return
    code = codeValue(code)
    summary['boms'].append(code)
    kind = bomKind(code)
    if kind == 'family':
        summary['bomFamilies'].append(code)
    elif kind == 'old':
        summary['oldBoms'].append(code)
    elif kind == 'new':
        summary['newBoms'].append(code)
    elif kind == 'versioned':
        summary['versionedBoms'].append(code)
    elif kind == 'mold':
        summary['molds'].append(code)

def summarize_workbook(filepath: str, file_meta: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Parse and summarize a single Excel workbook.
    Returns a structured entry suitable for caching.
    """
    if file_meta is None:
        file_meta = get_file_info(filepath)

    filename = file_meta['name']
    summary = {
        'file': filename,
        'path': file_meta.get('relative_path') or file_meta['path'],
        'size': file_meta['size'],
        'modified': format_modified(file_meta.get('modified', 0)),
        'type': 'Unknown',
        'sheetCount': 0,
        'sheets': [],
        'records': [],
        'bomVersions': [],
        'items': [],
        'fgItems': [],
        'fgNames': [],
        'boms': [],
        'bomFamilies': [],
        'oldBoms': [],
        'newBoms': [],
        'versionedBoms': [],
        'molds': [],
        'productNames': [],
        'headers': [],
        'fractionalCount': 0,
        'sample': '',
        'error': ''
    }

    try:
        # Parse workbook
        raw_data = parse_excel_file(filepath)
        sheet_names = list(raw_data.keys())
        summary['sheetCount'] = len(sheet_names)

        # Process each sheet
        for sheet_name, raw_rows in raw_data.items():
            # Convert to string rows
            rows = sheet_to_rows(raw_rows)

            # Find header rows
            header_rows = findHeaderRows(rows)

            # Extract BOM versions
            bom_versions = extractBomVersions(summary, sheet_name, rows)

            # Extract items and BOM codes
            extracted = extractItemsAndBoms(rows)
            items = extracted['items']
            fg_items = extracted['fgItems']
            boms = extracted['boms']

            # Build sheet summary
            sheet_summary = {
                'name': sheet_name,
                'rows': len(rows),
                'headerRows': header_rows,
                'sampleText': " | ".join([rowText(r) for r in rows[:20]]),
                'itemCount': len(items),
                'bomCount': len(boms)
            }
            summary['sheets'].append(sheet_summary)

            # Aggregate data
            summary['items'].extend(items)
            summary['fgItems'].extend(fg_items)
            summary['boms'].extend(boms)
            summary['bomFamilies'].extend(extracted['bomFamilies'])
            summary['oldBoms'].extend(extracted['oldBoms'])
            summary['newBoms'].extend(extracted['newBoms'])
            summary['versionedBoms'].extend(extracted['versionedBoms'])
            summary['molds'].extend(extracted['molds'])
            summary['bomVersions'].extend(bom_versions)
            summary['headers'].extend([h['headers'] for h in header_rows])

            # Extract structured records from each header row
            for hdr in header_rows:
                records = extractStructuredRows(summary, sheet_name, rows, hdr)
                summary['records'].extend(records)

                # Enrich item lists with records
                for rec in records:
                    if rec['item']:
                        summary['items'].append(rec['item'])
                    if rec['fgItem']:
                        summary['fgItems'].append(codeValue(rec['fgItem']))
                    if rec['fgName']:
                        summary['fgNames'].append(rec['fgName'])
                    # BOM in record may be ambiguous: only count if in proper context
                    if rec['bom'] and (rec.get('bomFromColumn') or isBomCodeInContext(rec['bom'], rec['text'])):
                        add_bom_code(summary, rec['bom'])
                    elif rec['bom'] and not isBomCodeInContext(rec['bom'], rec['text']):
                        # Not a BOM, might be an item
                        summary['items'].append(rec['bom'])
                        if isFgLike(rec['bom']):
                            summary['fgItems'].append(codeValue(rec['bom']))
                    if rec['fgName']:
                        summary['productNames'].append(rec['fgName'])

            # Process BOM versions to extract product info
            for ver in bom_versions:
                if ver['parentItem']:
                    summary['items'].append(ver['parentItem'])
                if ver['isFg'] and ver['parentItem']:
                    summary['fgItems'].append(codeValue(ver['parentItem']))
                if ver['isFg'] and ver['parentName']:
                    summary['fgNames'].append(ver['parentName'])
                if ver['bom']:
                    add_bom_code(summary, ver['bom'])
                if ver['parentName']:
                    summary['productNames'].append(ver['parentName'])
                if ver['bomName']:
                    summary['productNames'].append(ver['bomName'])

        # Deduplicate arrays
        summary['items'] = unique(summary['items'])
        summary['fgItems'] = unique(summary['fgItems'])
        summary['fgNames'] = unique(summary['fgNames'])
        summary['boms'] = unique(summary['boms'])
        summary['bomFamilies'] = unique(summary['bomFamilies'])
        summary['oldBoms'] = unique(summary['oldBoms'])
        summary['newBoms'] = unique(summary['newBoms'])
        summary['versionedBoms'] = unique(summary['versionedBoms'])
        summary['molds'] = unique(summary['molds'])
        summary['productNames'] = unique(summary['productNames'])
        summary['headers'] = unique([h for hlist in summary['headers'] for h in hlist if h])

        # Count fractional quantities
        summary['fractionalCount'] = sum(1 for r in summary['records'] if isFractional(r['quantity']))

        # Compute sample text
        summary['sample'] = " | ".join([rowText(r) for r in rows[:10]]) if rows else ""

        # Detect workbook type using sheet summaries
        sheet_summaries_for_type = [
            {
                'name': s['name'],
                'sampleText': s['sampleText'],
                'bomCount': s['bomCount'],
                'headerRows': [{'headers': h} for h in s['headerRows']]
            }
            for s in summary['sheets']
        ]
        summary['type'] = detectType(sheet_summaries_for_type, filename)

        # Add file signature for cache validation
        import os
        try:
            stat = os.stat(filepath)
            summary['signature'] = f"{filepath}|{stat.st_size}|{stat_mtime_ms(stat)}"
        except Exception:
            summary['signature'] = ""

    except Exception as e:
        summary['error'] = str(e)
        summary['type'] = "Error"

    return summary


def summarize_workbook_universal(filepath: str, file_meta: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Parse a workbook and extract every non-empty row as a searchable record.
    This bypasses BOM-header/version detection and provides universal indexing.
    """
    if file_meta is None:
        file_meta = get_file_info(filepath)

    filename = file_meta['name']
    summary = {
        'file': filename,
        'path': file_meta.get('relative_path') or file_meta['path'],
        'size': file_meta['size'],
        'modified': format_modified(file_meta.get('modified', 0)),
        'type': 'Universal',
        'sheetCount': 0,
        'sheets': [],
        'records': [],
        'bomVersions': [],
        'items': [],
        'fgItems': [],
        'fgNames': [],
        'boms': [],
        'bomFamilies': [],
        'oldBoms': [],
        'newBoms': [],
        'versionedBoms': [],
        'molds': [],
        'productNames': [],
        'headers': [],
        'fractionalCount': 0,
        'sample': '',
        'error': ''
    }

    try:
        raw_data = parse_excel_file(filepath)
        summary['sheetCount'] = len(raw_data.keys())

        for sheet_name, raw_rows in raw_data.items():
            rows = sheet_to_rows(raw_rows)
            non_empty_rows = 0

            for row_idx, row in enumerate(rows):
                indexed_cells = []
                visible_values = []
                for col_idx, cell in enumerate(row):
                    cell_text = text(cell)
                    if cell_text:
                        indexed_cells.append(f"{col_idx + 1}:{cell_text}")
                        visible_values.append(cell_text)
                line_text = " | ".join(visible_values)
                if not line_text:
                    continue
                non_empty_rows += 1
                extracted = extractUniversalRowFields(visible_values)
                mold_value = extracted.get('mold', '')
                if extracted.get('item'):
                    summary['items'].append(extracted['item'])
                if extracted.get('fgItem'):
                    summary['fgItems'].append(extracted['fgItem'])
                if extracted.get('productName'):
                    summary['productNames'].append(extracted['productName'])
                if mold_value:
                    summary['molds'].extend([m.strip() for m in mold_value.split(",") if m.strip()])

                summary['records'].append({
                    'file': summary['file'],
                    'path': summary['path'],
                    'modified': summary.get('modified', ''),
                    'sheet': sheet_name,
                    'row': row_idx + 1,
                    'column': '',
                    'item': extracted.get('item', ''),
                    'fgItem': extracted.get('fgItem', ''),
                    'fgName': extracted.get('fgName', ''),
                    'productName': extracted.get('productName', '') or line_text[:200],
                    'mold': mold_value,
                    'warehouse': '',
                    'quantity': '',
                    'perSeries': '',
                    'unit': '',
                    'bom': '',
                    'bomName': '',
                    'text': line_text,
                    'cellIndexText': "\t".join(indexed_cells),
                    'searchText': searchText([
                        summary['file'], summary['path'], sheet_name, line_text,
                        extracted.get('item', ''), extracted.get('fgItem', ''),
                        extracted.get('productName', ''), mold_value
                    ])
                })

            summary['sheets'].append({
                'name': sheet_name,
                'rows': len(rows),
                'headerRows': [],
                'sampleText': " | ".join([rowText(r) for r in rows[:20]]),
                'itemCount': 0,
                'bomCount': 0,
                'nonEmptyRows': non_empty_rows
            })

        summary['items'] = unique(summary['items'])
        summary['fgItems'] = unique(summary['fgItems'])
        summary['molds'] = unique(summary['molds'])
        summary['productNames'] = unique(summary['productNames'])
        summary['fractionalCount'] = sum(1 for r in summary['records'] if isFractional(r.get('quantity', '')))
        summary['sample'] = " | ".join([r.get('text', '') for r in summary['records'][:10] if r.get('text')])

        import os
        try:
            stat = os.stat(filepath)
            summary['signature'] = f"{filepath}|{stat.st_size}|{stat_mtime_ms(stat)}"
        except Exception:
            summary['signature'] = ""

    except Exception as e:
        summary['error'] = str(e)
        summary['type'] = "Error"

    return summary


def rowText(row: List[str]) -> str:
    """Convert a row to display text (pipe-separated non-empty values)"""
    return " | ".join(filter(None, [text(c) for c in row]))
