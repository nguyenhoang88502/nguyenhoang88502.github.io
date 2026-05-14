"""BOM Classifier Module - Detects file types and extracts structured data"""

import re
import os
from typing import List, Dict, Tuple, Optional, Any
from pathlib import Path

from .utils import unique, isFractional, valueAt


# ============ Text Processing Utilities ============

def normalize(value: Any) -> str:
    """Normalize text: lowercase, strip whitespace"""
    return str(value or "").strip().lower()


def text(value: Any) -> str:
    """Get text representation, trimmed"""
    return str(value or "").strip()


def codeValue(value: Any) -> str:
    """Uppercase code value"""
    return text(value).upper()


# ============ BOM/FG Detection Logic ============

MOLD_CODE_RE = re.compile(
    r'\b(?:CAP\d+[A-Z]+|MDE\s*\d+(?:\.\d+)?|MOLD-\d+|TD\d{4,}[A-Z]?)\b',
    re.IGNORECASE
)

BOM_CODE_PATTERNS = {
    'versioned': re.compile(r'^3\d{6}V\d{2}$', re.IGNORECASE),
    'mold': re.compile(r'^(?:CAP\d+[A-Z]+|MDE\s*\d+(?:\.\d+)?|MOLD-\d+|TD\d{4,}[A-Z]?)$', re.IGNORECASE),
    'old': re.compile(r'^1\d{6}$'),
    'new': re.compile(r'^3\d{6}$'),
    'family': re.compile(r'^(?:\d{4}|\d+-\d+)$'),
    'bom': re.compile(r'^BOM\d{4,}$', re.IGNORECASE)
}

FG_PATTERNS = [
    (r'^(19|20)\d{2}$', None),  # Year-like patterns are NOT FG
    (r'^[13]\d{6}$', 'fg'),
    (r'^\d{4,5}-[A-Z0-9]{2,5}[A-Z]?$', 'fg'),
    (r'^\d{4,5}[A-Z]?$', 'fg')
]

ITEM_PATTERNS = [
    re.compile(r'^[13]\d{6}$'),
    re.compile(r'^\d{5}$'),
    re.compile(r'^\d+-\d+[A-Z]?$', re.IGNORECASE),
]


def bomKind(value: str) -> str:
    """Classify BOM code into category: versioned, mold, old, new, family, bom, or empty string"""
    code = codeValue(value)
    for kind, pattern in BOM_CODE_PATTERNS.items():
        if pattern.match(code):
            return kind
    return ""


def isBomLike(value: str) -> bool:
    """Check if value resembles a BOM code"""
    return bomKind(value) != ""


def fgKind(value: str) -> str:
    """Check if value is a Finished Good code (returns 'fg' or empty)"""
    code = codeValue(value)
    for pattern, kind in FG_PATTERNS:
        if kind is None:
            continue  # Skip negative patterns
        if re.match(pattern, code):
            return kind or "fg"
    return ""


def isFgLike(value: str) -> bool:
    """Check if value resembles a FG code"""
    return fgKind(value) != ""


def fgMatchesInText(value: str) -> List[str]:
    """Extract all FG codes from text"""
    matches = re.findall(r'\b(?:[13]\d{6}|\d{4,5}(?:-[A-Z0-9]{2,5})?[A-Z]?)\b', str(value or ""), re.IGNORECASE)
    return unique([codeValue(m) for m in matches if isFgLike(m)])


def moldMatchesInText(value: str) -> List[str]:
    """Extract mold/tooling codes from free text."""
    return unique([re.sub(r'\s+', ' ', codeValue(m)) for m in MOLD_CODE_RE.findall(str(value or ""))])


def isUniversalNoise(value: str) -> bool:
    """Exclude status/date/code cells when guessing descriptions from Universal rows."""
    val = text(value)
    norm = normalize(val)
    if not val or norm in {"n/a", "na", "none", "no", "yes", "null", "-"}:
        return True
    if re.match(r'^\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?$', val):
        return True
    if re.match(r'^[13]\d{6}$', val) or bomKind(val) or isItem(val):
        return True
    if moldMatchesInText(val):
        return True
    return False


def isLikelyDescription(value: str) -> bool:
    """Check whether a cell looks like a human-readable product/component description."""
    val = text(value)
    if isUniversalNoise(val):
        return False
    if not re.search(r'[A-Za-z]', val):
        return False
    return len(val) >= 4


def extractUniversalRowFields(values: List[str]) -> Dict[str, str]:
    """
    Infer core manufacturing fields from a raw Universal-mode row.

    Common legacy exports place data as:
    Item | Mold | FG | Product name | Component item | Component name | ...
    """
    clean_values = [text(v) for v in values if text(v)]
    id_cells = [
        (idx, codeValue(v))
        for idx, v in enumerate(clean_values)
        if re.match(r'^[13]\d{6}$', text(v))
    ]
    item = id_cells[0][1] if id_cells else ""
    fg_item = id_cells[1][1] if len(id_cells) > 1 else ""
    fg_index = id_cells[1][0] if len(id_cells) > 1 else -1

    product_name = ""
    if fg_index >= 0:
        for value in clean_values[fg_index + 1:]:
            if isLikelyDescription(value):
                product_name = value
                break
    if not product_name:
        for value in clean_values:
            if isLikelyDescription(value):
                product_name = value
                break

    molds = []
    for value in clean_values:
        molds.extend(moldMatchesInText(value))

    return {
        'item': item,
        'fgItem': fg_item,
        'fgName': '',
        'productName': product_name,
        'mold': ", ".join(unique(molds)),
    }


def isBomCodeInContext(value: str, context: str = "") -> bool:
    """Determine if a BOM code appears in a BOM-appropriate context"""
    kind = bomKind(value)
    if not kind:
        return False
    # Certain BOM types are always valid
    if kind in ['bom', 'versioned', 'mold']:
        return True
    # Check for BOM-related terms in surrounding context
    ctx_norm = normalize(context or "")
    return containsBomTitle(ctx_norm) or re.search(r'\bP?BOM\b', str(context or ""), re.IGNORECASE) is not None


def bomMatchesInText(value: str, context: Optional[str] = None) -> List[str]:
    """Extract all BOM codes from text, filtered by context"""
    ctx = context if context is not None else value
    pattern = r'\b(?:3\d{6}V\d{2}|CAP\d+[A-Z]+|MDE\s*\d+(?:\.\d+)?|MOLD-\d+|TD\d{4,}[A-Z]?|BOM\d{4,}|[13]\d{6}|\d{4}|\d+-\d+)\b'
    matches = re.findall(pattern, str(value or ""), re.IGNORECASE)
    result = []
    for m in matches:
        code = codeValue(m)
        if isBomCodeInContext(code, ctx):
            result.append(code)
    return unique(result)


def bomValuesByTarget(values: List[str], target: str, context: Optional[Any] = None) -> List[str]:
    """Filter BOM codes by target type"""
    ctx_text = " ".join(context) if isinstance(context, list) else str(context or "")
    codes = unique([c for v in (values or []) for c in bomMatchesInText(v, ctx_text)])
    if target == "bom":
        return codes
    return [c for c in codes if bomKind(c) == target]


def isItem(value: str) -> bool:
    """Check if value looks like a component/raw-material item number."""
    code = codeValue(value)
    return any(pattern.match(code) for pattern in ITEM_PATTERNS)


# ============ Header Aliases (Multi-language) ============

HEADER_ALIASES = {
    'fgItem': [
        "fg", "fg item", "fg number", "fg no", "fg code",
        "finished good", "finished goods", "finished good item",
        "finished good number", "parent fg", "parent item"
    ],
    'fgName': [
        "fg name", "fg product name", "finished good name",
        "finished goods name", "finished good product name",
        "finished good description", "fg description",
        "parent fg name", "parent name"
    ],
    'itemNumber': [
        "item number", "item no", "item", "item code", "part number",
        "component", "component item", "component number", "component code",
        "raw material", "raw material number", "raw material code",
        "ma hang", "ma vat tu", "ma linh kien", "mã hàng", "mã vật tư", "mã linh kiện",
        "物料编码", "物料编号", "物料号", "料号", "品号", "项目编号"
    ],
    'productName': [
        "product name", "item name", "product", "description", "name",
        "component description", "component name", "raw material description",
        "raw material name", "material description", "material name",
        "ten hang", "ten vat tu", "ten san pham", "tên hàng", "tên vật tư", "tên sản phẩm",
        "品名", "物料名称", "产品名称", "名称", "描述"
    ],
    'warehouse': [
        "warehouse", "site warehouse", "whse", "kho", "nha kho", "nhà kho",
        "仓库", "库位"
    ],
    'quantity': [
        "quantity", "qty", "usage", "bom qty",
        "so luong", "số lượng", "数量", "用量", "需求数量"
    ],
    'perSeries': [
        "per series", "per", "series", "base qty", "base quantity",
        "dinh muc", "định mức", "基准数量", "每系列", "每"
    ],
    'unit': [
        "unit", "uom", "unit of measure",
        "don vi", "đơn vị", "单位", "计量单位"
    ],
    'bom': [
        "bom", "bom number", "bom no", "bom id",
        "bom family", "bom version", "versioned bom",
        "ma bom", "mã bom", "bom编号", "bom号", "物料清单号", "清单号"
    ],
    'bomName': [
        "name", "bom name", "ten bom", "tên bom", "名称", "bom名称", "清单名称"
    ],
    'fromQty': [
        "from quantity", "from qty", "quantity from",
        "tu so luong", "từ số lượng", "起始数量", "从数量"
    ],
    'fromDate': [
        "from date", "effective from", "valid from",
        "tu ngay", "từ ngày", "生效日期", "开始日期"
    ],
    'toDate': [
        "to date", "valid to", "effective to",
        "den ngay", "đến ngày", "失效日期", "结束日期"
    ],
    'active': [
        "active", "is active",
        "hoat dong", "hoạt động", "kich hoat", "kích hoạt",
        "有效", "启用", "激活"
    ],
    'approvedBy': [
        "approved by", "approver",
        "nguoi duyet", "người duyệt", "批准人", "审批人"
    ],
    'approved': [
        "approved", "is approved",
        "da duyet", "đã duyệt", "批准", "已批准", "审批"
    ],
    'itemGroup': [
        "item group", "group",
        "nhom hang", "nhóm hàng", "nhom vat tu", "nhóm vật tư",
        "物料组", "产品组", "项目组"
    ]
}

BOM_TITLE_TERMS = [
    "bom", "bill of material", "bill of materials", "bom line",
    "bomconsistof", "pbom",
    "dinh muc", "định mức", "dinh muc nguyen vat lieu", "định mức nguyên vật liệu",
    "bang dinh muc", "bảng định mức", "bang vat tu", "bảng vật tư",
    "cau truc san pham", "cấu trúc sản phẩm",
    "物料清单", "物料表", "材料清单", "产品结构", "bom表", "配方"
]


def aliases(key_or_names) -> List[str]:
    """Get list of all alias names for a field (normalized)"""
    keys = [key_or_names] if isinstance(key_or_names, str) else key_or_names
    result = []
    for key in keys:
        if key in HEADER_ALIASES:
            result.extend(HEADER_ALIASES[key])
        else:
            result.append(key)
    return [normalize(name) for name in result]


def normalizeHeader(value: Any) -> str:
    """Normalize an Excel header while tolerating explanatory notes."""
    normalized = normalize(value)
    normalized = re.sub(r'\([^)]*\)', '', normalized)
    normalized = re.sub(r'[\r\n\t_/\\:;,\-.]+', ' ', normalized)
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    return normalized


def headerMatchesAlias(cell: Any, target_names: List[str]) -> bool:
    """Return True if a header cell matches one of the canonical aliases."""
    raw = normalize(cell)
    clean = normalizeHeader(cell)
    if raw in target_names or clean in target_names:
        return True

    for target in target_names:
        target_clean = normalizeHeader(target)
        if not target_clean:
            continue
        if clean == target_clean:
            return True
        if " " in target_clean and (
            clean.startswith(target_clean + " ") or
            clean.endswith(" " + target_clean)
        ):
            return True
    return False


def hasHeader(row: List[str], key_or_names) -> bool:
    """Check if row contains a header matching the given field names"""
    if not row or not isinstance(row, list):
        return False
    target_names = aliases(key_or_names)
    return any(headerMatchesAlias(cell, target_names) for cell in row if cell)


def hasAnyHeader(rows: List[List[str]], key_or_names) -> bool:
    """Check if any row in the list has the specified header"""
    return any(hasHeader(row, key_or_names) for row in rows if row)


def containsBomTitle(value: str) -> bool:
    """Check if text contains BOM-related keywords"""
    normalized = normalize(value)
    return any(normalize(term) in normalized for term in BOM_TITLE_TERMS)


def findHeaderRows(rows: List[List[str]]) -> List[Dict]:
    """Find rows that look like table headers (up to first 20 rows)"""
    matches = []
    for row_idx, row in enumerate(rows[:20]):
        if not row:
            continue
        text_row = [text(c) for c in row]
        has_item = hasHeader(row, "itemNumber")
        has_fg = hasHeader(row, "fgItem")
        has_fgname = hasHeader(row, "fgName")
        has_product = hasHeader(row, "productName")
        has_wh = hasHeader(row, "warehouse")
        has_qty = hasHeader(row, "quantity")
        has_bom = hasHeader(row, "bom")
        has_bomname = hasHeader(row, "bomName")
        has_group = hasHeader(row, "itemGroup")

        if ((has_item and has_product) or has_fg or has_fgname or
            (has_bom and has_bomname) or has_wh or has_qty or has_group):
            matches.append({
                'rowIndex': row_idx,
                'headers': text_row,
                'normalized': [normalize(c) for c in row]
            })
    return matches


def headerColumn(headers: List[str], names) -> int:
    """Find column index for a given header name/alias"""
    target_names = aliases(names)
    
    # Direct match
    for i, cell in enumerate(headers):
        if headerMatchesAlias(cell, target_names):
            return i
    
    # Loose match for "item number" variations
    if "item number" in target_names:
        for i, cell in enumerate([normalizeHeader(h) for h in headers]):
            if cell.startswith("item nu") or cell.startswith("item num"):
                return i
    
    return -1


# ============ Record Extraction ============

def extractStructuredRows(file_summary: Dict, sheet_name: str, rows: List[List[str]], header_match: Dict) -> List[Dict]:
    """Extract structured data rows based on detected header"""
    headers = header_match['headers']
    item_col = headerColumn(headers, ["itemNumber"])
    fg_col = headerColumn(headers, ["fgItem"])
    fgname_col = headerColumn(headers, ["fgName"])
    product_col = headerColumn(headers, ["productName"])
    wh_col = headerColumn(headers, ["warehouse"])
    qty_col = headerColumn(headers, ["quantity"])
    per_col = headerColumn(headers, ["perSeries"])
    unit_col = headerColumn(headers, ["unit"])
    bom_col = headerColumn(headers, ["bom"])
    bomname_col = headerColumn(headers, ["bomName"])

    records = []

    start_row = header_match['rowIndex'] + 1
    for row_idx in range(start_row, len(rows)):
        row = rows[row_idx]
        item = valueAt(row, item_col) if item_col >= 0 else ""
        fg_item_raw = valueAt(row, fg_col) if fg_col >= 0 else ""
        fg_item = fg_item_raw
        fg_name = valueAt(row, fgname_col) if fgname_col >= 0 else ""
        product_name = valueAt(row, product_col) if product_col >= 0 else ""
        warehouse = valueAt(row, wh_col) if wh_col >= 0 else ""
        quantity = valueAt(row, qty_col) if qty_col >= 0 else ""
        per_series = valueAt(row, per_col) if per_col >= 0 else ""
        unit_val = valueAt(row, unit_col) if unit_col >= 0 else ""
        bom = codeValue(valueAt(row, bom_col)) if bom_col >= 0 else ""
        bom_name = valueAt(row, bomname_col) if bomname_col >= 0 else ""

        line_text = " | ".join(filter(None, [text(c) for c in row]))

        # Skip empty rows
        if not line_text:
            continue

        # Skip repeated header rows
        if (isRepeatedKeyHeader(item) or isRepeatedKeyHeader(fg_item) or
            isRepeatedKeyHeader(fg_name) or isRepeatedKeyHeader(bom)):
            continue

        # Skip rows with no meaningful data
        if not hasKeyValues(item, bom, fg_item, fg_name):
            continue

        # Additional emptiness checks
        if item_col >= 0 and not any([item, fg_item, fg_name, product_name, warehouse, quantity]):
            continue
        if bom_col >= 0 and not any([bom, bom_name]):
            continue

        record = {
            'file': file_summary['file'],
            'path': file_summary['path'],
            'modified': file_summary.get('modified', ''),
            'sheet': sheet_name,
            'row': row_idx + 1,
            'item': item,
            'fgItem': fg_item,
            'fgName': fg_name,
            'productName': product_name,
            'warehouse': warehouse,
            'quantity': quantity,
            'perSeries': per_series,
            'unit': unit_val,
            'bom': bom,
            'bomName': bom_name,
            'itemIsFg': False,
            'bomFromColumn': bom_col >= 0,
            'text': line_text,
            'searchText': searchText([
                file_summary['file'], file_summary['path'], sheet_name,
                item, fg_item, fg_name, product_name, warehouse,
                quantity, per_series, unit_val, bom, bom_name, line_text
            ])
        }
        records.append(record)

    return records


def extractBomVersions(file_summary: Dict, sheet_name: str, rows: List[List[str]]) -> List[Dict]:
    """Extract BOM version information from header section"""
    versions = []
    parent = {'item': "", 'name': "", 'group': ""}
    captured_top_for_parent = False

    for row_idx, row in enumerate(rows):
        # Detect parent header (item/bom header row)
        item_header = hasHeader(row, "itemNumber") and hasHeader(row, "productName") and hasHeader(row, "itemGroup")
        fg_header = hasHeader(row, "fgItem") or hasHeader(row, "fgName")

        if (item_header or fg_header) and (row_idx + 1) < len(rows):
            next_row = rows[row_idx + 1]
            item_col = headerColumn(row, ["fgItem", "itemNumber"])
            product_col = headerColumn(row, ["fgName", "productName"])
            group_col = headerColumn(row, ["itemGroup"])

            parent = {
                'item': text(next_row[item_col]) if item_col >= 0 else "",
                'name': text(next_row[product_col]) if product_col >= 0 else "",
                'group': text(next_row[group_col]) if group_col >= 0 else ("fingoods" if fg_header else "")
            }
            captured_top_for_parent = False

        # Detect BOM version header
        bom_header = hasHeader(row, "bom") and hasHeader(row, "bomName") and hasHeader(row, "fromQty")
        if not bom_header or (row_idx + 1) >= len(rows):
            continue

        next_row = rows[row_idx + 1]
        version = {
            'file': file_summary['file'],
            'path': file_summary['path'],
            'sheet': sheet_name,
            'row': row_idx + 2,
            'parentItem': parent['item'],
            'parentName': parent['name'],
            'itemGroup': parent['group'],
            'bom': codeValue(next_row[headerColumn(row, ["bom"])]) if headerColumn(row, ["bom"]) >= 0 else "",
            'bomName': text(next_row[headerColumn(row, ["bomName"])]) if headerColumn(row, ["bomName"]) >= 0 else "",
            'fromQty': text(next_row[headerColumn(row, ["fromQty"])]) if headerColumn(row, ["fromQty"]) >= 0 else "",
            'fromDate': text(next_row[headerColumn(row, ["fromDate"])]) if headerColumn(row, ["fromDate"]) >= 0 else "",
            'toDate': text(next_row[headerColumn(row, ["toDate"])]) if headerColumn(row, ["toDate"]) >= 0 else "",
            'active': text(next_row[headerColumn(row, ["active"])]) if headerColumn(row, ["active"]) >= 0 else "",
            'approvedBy': text(next_row[headerColumn(row, ["approvedBy"])]) if headerColumn(row, ["approvedBy"]) >= 0 else "",
            'approved': text(next_row[headerColumn(row, ["approved"])]) if headerColumn(row, ["approved"]) >= 0 else "",
        }

        if not hasKeyValues(version['parentItem'], version['bom']):
            continue

        version['isFg'] = normalize(version['itemGroup']) == "fingoods" or isFgLike(version['parentItem'])
        version['isTopLevelFg'] = version['isFg'] and not captured_top_for_parent
        version['isActiveApproved'] = normalize(version['active']) == "yes" and normalize(version['approved']) == "yes"
        version['searchText'] = searchText([
            version['file'], version['path'], version['sheet'],
            version['parentItem'], version['parentName'], version['itemGroup'],
            version['bom'], version['bomName'], version['fromQty'],
            version['fromDate'], version['toDate'], version['active'],
            version['approvedBy'], version['approved']
        ])

        if version['bom'] or version['bomName'] or version['parentItem']:
            versions.append(version)
            if version['isFg']:
                captured_top_for_parent = True

    return versions


def extractRegexValues(rows: List[List[str]], pattern) -> List[str]:
    """Extract unique values from all cells matching a regex pattern"""
    found = []
    for row in rows:
        for cell in row:
            val = text(cell)
            if not val:
                continue
            matches = re.findall(pattern, val)
            found.extend(matches)
    return unique(found)


def extractItemsAndBoms(rows: List[List[str]]) -> Dict:
    """Extract all items, BOMs, and categorize them"""
    items = set()
    fg_items = set()
    boms = set()
    bom_families = set()
    old_boms = set()
    new_boms = set()
    versioned_boms = set()
    mold_boms = set()

    def addBom(code):
        kind = bomKind(code)
        if not kind:
            return False
        boms.add(code)
        if kind == "family":
            bom_families.add(code)
        elif kind == "old":
            old_boms.add(code)
        elif kind == "new":
            new_boms.add(code)
        elif kind == "versioned":
            versioned_boms.add(code)
        elif kind == "mold":
            mold_boms.add(code)
        return True

    active_item_col = -1
    active_fg_col = -1

    for row in rows:
        if hasHeader(row, "itemNumber") or hasHeader(row, "fgItem"):
            active_item_col = headerColumn(row, ["itemNumber"])
            active_fg_col = headerColumn(row, ["fgItem"])
            continue

        row_context = " | ".join([text(c) for c in row])
        for col_idx, cell in enumerate(row):
            val = text(cell)
            if not val:
                continue

            if active_item_col >= 0 and col_idx == active_item_col:
                if isItem(val):
                    items.add(codeValue(val))
                continue

            if active_fg_col >= 0 and col_idx == active_fg_col:
                if isFgLike(val):
                    fg_items.add(codeValue(val))
                continue

            # Extract BOM codes
            for code in bomMatchesInText(val, row_context):
                addBom(code)

            # Extract FG items (not in BOM context)
            for fg_code in fgMatchesInText(val):
                if not isBomCodeInContext(fg_code, row_context) and re.search(r'\bfg\b|finished good', row_context, re.IGNORECASE):
                    fg_items.add(fg_code)

            # Extract generic items (alphanumeric codes that are not BOMs)
            item_matches = re.findall(r'\b[A-Z0-9][A-Z0-9-]{2,}[A-Z0-9]\b', val, re.IGNORECASE)
            for match in item_matches:
                code = codeValue(match)
                if not isBomCodeInContext(code, row_context) and (isItem(code) or re.search(r'[A-Z]', code)):
                    items.add(code)

    return {
        'items': list(items),
        'fgItems': list(fg_items),
        'boms': list(boms),
        'bomFamilies': list(bom_families),
        'oldBoms': list(old_boms),
        'newBoms': list(new_boms),
        'versionedBoms': list(versioned_boms),
        'molds': list(mold_boms)
    }


def searchText(values: List[str]) -> str:
    """Create searchable text from multiple values"""
    return " ".join([normalize(v) for v in values if v]).strip()


# ============ File Type Detection ============

def isRepeatedKeyHeader(value: str) -> bool:
    """Check if value looks like a repeated header row (column names)"""
    key = normalize(value)
    return key in [
        "item number", "item no", "item", "fg", "fg name",
        "bom", "bom number", "bom no"
    ]


def hasKeyValues(item: str, bom: str, fg_item: str = "", fg_name: str = "") -> bool:
    """Check if any key field has a value"""
    return any(text(v) != "" for v in [item, bom, fg_item, fg_name])


def detectType(sheet_summaries: List[Dict], filename: str = "") -> str:
    """Detect overall workbook type based on sheet analysis"""
    all_header_rows = []
    for sheet in sheet_summaries:
        all_header_rows.extend(sheet.get('headerRows', []))

    has_line_headers = (hasAnyHeader(all_header_rows, "warehouse") and
                       hasAnyHeader(all_header_rows, "quantity") and
                       hasAnyHeader(all_header_rows, "perSeries"))
    has_bom_headers = (hasAnyHeader(all_header_rows, "bom") and
                       hasAnyHeader(all_header_rows, "fromQty"))
    has_parent_headers = ((hasAnyHeader(all_header_rows, "itemGroup") and
                          hasAnyHeader(all_header_rows, "productName")) or
                          hasAnyHeader(all_header_rows, "fgItem") or
                          hasAnyHeader(all_header_rows, "fgName"))
    has_bom_title = (containsBomTitle(filename) or
                     any(containsBomTitle(s.get('name', '')) or containsBomTitle(s.get('sampleText', ''))
                         for s in sheet_summaries))
    has_bom_identifier = any(s.get('bomCount', 0) > 0 for s in sheet_summaries)

    if has_line_headers and has_bom_headers:
        return "Mixed BOM report"
    if has_line_headers or (has_bom_title and hasAnyHeader(all_header_rows, "quantity")):
        return "BOM line"
    if has_bom_headers or has_parent_headers or has_bom_title or has_bom_identifier:
        return "BOM header"
    if not has_bom_title:
        return "Non-BOM"
    return "Unknown"


# ============ File Signature ============

def fileSignature(file_path: str, file_size: int, mtime: Optional[int] = None) -> str:
    """Generate a unique signature for a file (for caching)"""
    stat = os.stat(file_path) if Path(file_path).exists() else None
    size = file_size or (stat.st_size if stat else 0)
    modified = mtime or (int(stat.st_mtime * 1000) if stat else 0)
    return f"{file_path}|{size}|{modified}"
