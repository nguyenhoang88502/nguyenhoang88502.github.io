# Inspection Standard Image Inserter

**Document Version:** 1.0  
**Prepared for:** IT Security & Architecture Review  
**Last Updated:** 2026-05-13

---

## 1. Executive Summary & Business Purpose

### 1.1 Overview

The Inspection Standard Image Inserter is a browser-based, client-side tool that enables the NPI (New Product Introduction) and Quality Assurance teams to produce finalized inspection standard workbooks. The tool maps product, packaging, marking, folding-instruction, and sample images into predefined cell regions of a master Excel template (`template.xlsx`), then generates a completed `.xlsx` file ready for distribution to manufacturing partners and inspection stations.

### 1.2 Business Problem Solved

Prior to this tool, QA engineers manually inserted images into Excel inspection sheets — a process that required:

- Manually resizing images to fit target cell regions.
- Copy-pasting images one at a time into 27 distinct worksheet regions.
- Handling four merged-image slots (colorbox front/back, left/right, top/bottom; trimmer front/back) by combining images in an external image editor before insertion.
- Risking misalignment, skipped slots, or wrong images placed in critical inspection positions.

This manual workflow consumed approximately 60–90 minutes per inspection standard workbook and introduced human error into a quality-assurance artifact used as a contractual reference by manufacturing partners.

### 1.3 Solution

The tool provides a drag-and-drop, slot-based assignment interface. Users upload source images, assign each to its named slot in the template, and click **Generate** to produce the completed Excel file. Merged-image slots automatically combine two source images side-by-side before insertion. The tool runs entirely in the user's browser with no server-side component, no network calls during operation, and no data egress.

### 1.4 Key Metrics

| Metric | Before (Manual) | After (Tool) |
|---|---|---|
| Time per inspection standard | 60–90 minutes | 5–10 minutes |
| Merged-image handling | External editor required | Automatic side-by-side merge in-browser |
| Slot completeness verification | Manual checklist | Visual dashboard with assignment status |
| Data persistence | None (single-session Excel work) | Automatic localStorage save/restore across sessions |
| Image format handling | Manual conversion | 15+ formats auto-accepted; rendered to PNG on insertion |

---

## 2. System Architecture & Data Flow

### 2.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                        │
│                                                         │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  React   │    │  ExcelJS     │    │    JSZip      │  │
│  │   UI     │───►│  (template   │───►│  (.xlsx       │  │
│  │  Layer   │    │   read/write)│    │   packaging)  │  │
│  └──────────┘    └──────────────┘    └───────────────┘  │
│        │                │                    │          │
│        ▼                ▼                    ▼          │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │ Canvas   │    │  FileReader  │    │  localStorage │  │
│  │ (merge,  │    │  (image      │    │  (assignment  │  │
│  │  resize) │    │   decode)    │    │   persistence)│  │
│  └──────────┘    └──────────────┘    └───────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              template.xlsx (static asset)         │   │
│  │  Pre-configured with named image placeholders in  │   │
│  │  the COVER worksheet at defined cell ranges       │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

    Note: No server-side component. No network requests during
    operation. The only external dependency is the initial page
    load (static HTML/JS/CSS served from GitHub Pages or a CDN).
```

### 2.2 Technology Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| UI Framework | React (functional components + hooks) | Bundled via Vite; single-page application |
| Excel Read/Write | ExcelJS | Open-source (MIT); reads `template.xlsx`, inserts images, writes final workbook |
| XLSX Packaging | JSZip v3.10.1 | Open-source (MIT); packages the final `.xlsx` as a ZIP-compressed OOXML archive |
| Image Processing | HTML5 Canvas API | Client-side only; used for merged-image pair combination and resize-to-fit |
| File I/O | FileReader API, URL.createObjectURL | Standard browser APIs; no filesystem access required |
| State Persistence | localStorage | Assignment state survives page reload; cleared on Generate or explicit reset |
| Styling | CSS custom properties (variables) | Light/dark theme via `data-theme` attribute toggle; responsive layout |
| Internationalization | Custom i18n (React context) | English (default) and Vietnamese (Tiếng Việt) |

### 2.3 Data Flow (Step-by-Step)

1. **Page Load.** The browser loads `index.html`, which mounts the React application. The app renders the workspace UI with 27 empty image slots organized into 5 sections: Product, Packaging, Marking, Folding Instructions, and Sample.

2. **Image Ingestion.** The user adds source images via:
   - **File drop** on the dropzone area.
   - **File picker** (clicking the dropzone or its button).
   - **Clipboard paste** (Ctrl+V anywhere in the app).
   
   Each image is read via `FileReader` or the Clipboard API, decoded by the browser's native image decoder (with `decoding="async"`), and rendered as a thumbnail in the unassigned-image pool.

3. **Slot Assignment.** The user drags a thumbnail from the image pool onto a named slot, or drags an image between slots. For merged slots (4 of 27 slots), two source images are required; the app displays two sub-targets within the merged slot. Assignment state is persisted to `localStorage` after each change.

4. **Template Loading.** On clicking **Generate**, the app fetches `template.xlsx` via an HTTP `GET` request, then opens it with ExcelJS. The template contains a `COVER` worksheet with named image shapes or placeholder regions at predefined cell ranges.

5. **Image Processing.** For each assigned slot:
   - **Single-image slots:** The source image is resized to fit the target cell range's aspect ratio and dimensions.
   - **Merged-image slots:** Two source images are drawn side-by-side on an offscreen HTML5 Canvas, then exported as a single merged PNG. The merged image is then resized to fit the target range.

6. **Excel Insertion.** ExcelJS inserts each processed image as an embedded PNG at the exact cell range defined in the slot configuration. Images are embedded directly in the workbook (not linked externally).

7. **Export.** The modified workbook is serialized to an OOXML buffer via ExcelJS, packaged into a `.xlsx` ZIP archive by JSZip, and offered to the user as a browser download with the filename `Inspection Standard - {ItemName}.xlsx`.

8. **Reset.** After successful export, the user can optionally clear all assignments and the image pool to start a new item.

### 2.4 Deployment Model

The application is deployed as a **static website** — a single `index.html` referencing bundled JavaScript and CSS assets. It can be hosted on:

- GitHub Pages (current deployment)
- Any static file server or CDN
- A local filesystem (opened via `file://` protocol, though some browser features may be limited)

**No application server, no database, no API endpoints, no authentication service.**

---

## 3. Template & Slot Configuration

### 3.1 Template File (`template.xlsx`)

The file `template.xlsx` is the canonical master template for inspection standard workbooks. It contains a worksheet named `COVER` with pre-defined cell regions where images are to be placed. Each region corresponds to a **template key** — a named identifier that the tool uses to locate the insertion point.

**Template maintenance workflow:**
1. The NPI/QA lead updates `template.xlsx` as inspection requirements evolve.
2. The updated template replaces the existing file in the deployment assets.
3. If cell ranges change, the slot configuration in the source code must be updated to match (see Section 6).

### 3.2 Complete Slot Inventory

The tool defines **27 image slots** organized into **5 sections**. Each slot is configured with a unique ID, a template key (matching the placeholder name in `template.xlsx`), a cell range, a human-readable label, and a processing role.

#### Section 1: Product (9 slots)

| Slot ID | Template Key | Cell Range | Label | Role |
|---|---|---|---|---|
| `ib_safety` | `ib_safety` | AP2:BF16 | IB Safety | Direct insert |
| `trimmer_hdpe` | `trimmer_hdpe` | BG2:BW16 | Trimmer HDPE | Direct insert |
| `accessory_1` | `acessory_1` (*) | BX2:CN16 | Accessory 1 | Direct insert |
| `accessory_2` | `accessory_2` | CO2:DF16 | Accessory 2 | Direct insert |
| `accessory_3` | `accessory_3` | DG2:DX16 | Accessory 3 | Direct insert |
| `accessory_4` | `accessory_4` | DY2:EP16 | Accessory 4 | Direct insert |
| `accessory_5` | `accessory_5` | EQ2:FH16 | Accessory 5 | Direct insert |
| `accessory_6` | `accessory_6` | FI2:FZ16 | Accessory 6 | Direct insert |
| `accessory_7` | `accessory_7` | GA2:GR16 | Accessory 7 | Direct insert |

> **(*)** Note: The template key for Accessory 1 is deliberately spelled `acessory_1` (one 'c') in the template file. The tool's slot ID uses the correct spelling (`accessory_1`), but maps to the misspelled template key for backward compatibility. A future template update may correct this.

#### Section 2: Packaging (5 slots)

| Slot ID | Template Key | Cell Range | Label | Role |
|---|---|---|---|---|
| `colorbox_front_back` | `colorbox_front` & `colorbox_back` | AP17:BF42 | Colorbox Front & Back | **Merged** (2 source images) |
| `colorbox_top_bottom` | `colorbox_top` & `colorbox_bottom` | BG17:BW42 | Colorbox Top & Bottom | **Merged** (2 source images) |
| `colorbox_left_right` | `colorbox_left` & `colorbox_right` | BX17:CN42 | Colorbox Left & Right | **Merged** (2 source images) |
| `top_view_inside` | `top_view_inside` | DF17:DV42 | Top View Inside | Direct insert |
| `actual_inside_carton` | `actual_inside_carton` | AQ47:BE57 | Actual Inside Carton | Direct insert |

#### Section 3: Marking (6 slots)

| Slot ID | Template Key | Cell Range | Label | Role |
|---|---|---|---|---|
| `label` | `label` | CO17:DE30 | Label | Direct insert |
| `colorbox_nom_label` | `colorbox_nom_label` | CO31:DE42 | Colorbox NOM Label | Direct insert |
| `lazer_actual` | `lazer_actual` | Y8:AM19 | Laser Actual | Direct insert |
| `lazer_drawing` | `lazer_drawing` | Y20:AM29 | Laser Drawing | Direct insert |
| `nom_lable` | `nom_lable` (*) | Y30:AM40 | NOM Label | Direct insert |
| `mastercarton_label_drawing` | `mastercarton_label_drawing` | BS58:CR69 | Mastercarton Label Drawing | Direct insert |

> **(*)** Note: The template key for NOM Label is deliberately spelled `nom_lable` in the template file. The tool maps the correct ID `nom_lable` to this key. A future template update may correct this.

#### Section 4: Folding Instructions (5 slots)

| Slot ID | Template Key | Cell Range | Label | Role |
|---|---|---|---|---|
| `how_to_fold_1` | `how_to_fold_1` | DW17:EM42 | How To Fold 1 | Direct insert |
| `how_to_fold_2` | `how_to_fold_2` | EN17:FD42 | How To Fold 2 | Direct insert |
| `how_to_fold_3` | `how_to_fold_3` | FE17:FU42 | How To Fold 3 | Direct insert |
| `how_to_fold_4` | `how_to_fold_4` | FV17:GL42 | How To Fold 4 | Direct insert |
| `how_to_fold_5` | `how_to_fold_5` | GM17:HC42 | How To Fold 5 | Direct insert |

#### Section 5: Sample (2 slots)

| Slot ID | Template Key | Cell Range | Label | Role |
|---|---|---|---|---|
| `fg_colorbox_front` | `fg_colorbox_front` | C13:M40 | FG Colorbox Front | Direct insert |
| `trimmer_front_back` | `trimmer_front` & `trimmer_back` | N13:X40 | Trimmer Front & Back | **Merged** (2 source images) |

### 3.3 Merged-Image Slot Behavior

Four slots accept two source images and combine them before insertion:

| Merged Slot | Left Source | Right Source | Output |
|---|---|---|---|
| `colorbox_front_back` | `colorbox_front` | `colorbox_back` | Side-by-side PNG → range AP17:BF42 |
| `colorbox_left_right` | `colorbox_left` | `colorbox_right` | Side-by-side PNG → range BX17:CN42 |
| `colorbox_top_bottom` | `colorbox_top` | `colorbox_bottom` | Side-by-side PNG → range BG17:BW42 |
| `trimmer_front_back` | `trimmer_front` | `trimmer_back` | Side-by-side PNG → range N13:X40 |

The merge operation uses an offscreen HTML5 Canvas. Both source images are drawn at equal width, adjacent to each other, then the combined canvas is exported as a single PNG via `canvas.toDataURL("image/png")`.

### 3.4 Supported Image Formats

The tool accepts any image format supported by the user's browser for decoding. Verified formats include:

`image/png`, `image/jpeg`, `image/gif`, `image/bmp`, `image/webp`, `image/avif`, `image/heic`, `image/heif`, `image/apng`, `image/svg+xml`, `image/tiff`, `image/emf`

Final output is always **PNG** (embedded in the `.xlsx`).

---

## 4. Security & Authentication

### 4.1 Architecture & Threat Surface

The tool runs **entirely client-side**. It has:

- **No server-side component.** No backend, no API, no database.
- **No authentication mechanism.** No login, no session, no token.
- **No network requests during operation** (except the initial page load and the fetch of `template.xlsx`, both of which are static file GETs).
- **No data transmission.** Images and assignment data never leave the user's browser.
- **No third-party analytics, telemetry, or tracking scripts.**

### 4.2 Data-at-Rest Considerations

| Storage Mechanism | Data Stored | Security Implication |
|---|---|---|
| `localStorage` | Slot assignment mappings (image name → slot ID), image data as base64 data URIs | Data resides in the browser's local storage sandbox, scoped to the origin domain. Accessible only to JavaScript running on the same origin. |
| In-memory (browser RAM) | Decoded image buffers, Canvas state, ExcelJS workbook | Volatile; cleared when the tab is closed or navigated away. |
| Browser download | Generated `.xlsx` file | Saved to the user's local downloads folder. No different from any other file download from a web page. |

### 4.3 Risk Assessment

| Risk | Classification | Mitigation |
|---|---|---|
| Sensitive inspection images stored in `localStorage` | Low | `localStorage` is origin-scoped. Users should clear browser data if the machine is shared. A future enhancement could encrypt localStorage entries. |
| XSS via malicious image filename or metadata | Low | Image content is processed through the browser's native image decoder; filenames are rendered as text, not HTML. The React framework's JSX escaping mitigates injection. |
| Template tampering (malicious `.xlsx`) | Low | `template.xlsx` is a static asset deployed alongside the application. Its integrity is governed by the hosting platform's access controls (GitHub repository permissions). |
| Supply chain risk (npm dependencies) | Medium | Dependencies (ExcelJS, JSZip) are bundled at build time. Use `npm audit` and Dependabot / Snyk scanning in CI/CD. Pin versions in `package-lock.json`. |
| Man-in-the-middle (MITM) on page load | Low | Deploy over HTTPS (enforced by GitHub Pages and all major CDNs). |

### 4.4 Compliance Posture

- **GDPR / Data Privacy:** The tool does not collect, process, or transmit personal data. Inspection images are product photographs — not PII.
- **SOX / ITGC:** The tool is not a system of record. The source of truth is the generated `.xlsx` file, which is managed by the end-user per their department's document control procedures.
- **Internal Audit:** The tool qualifies as an **end-user computing (EUC) application**. Organizations may require it to be listed in the EUC inventory with a documented owner, purpose, and risk classification.

### 4.5 Recommended Deployment Controls

For IT-governed deployments:

1. Serve over **HTTPS only** (enforced by default on GitHub Pages).
2. Add a **Content Security Policy (CSP)** header restricting script sources to the deployment origin.
3. Pin dependency versions in the build pipeline; run `npm audit` on each PR.
4. Store `template.xlsx` in a repository with branch protection and code-review requirements.
5. Consider adding a **file-size limit** and **image-count cap** to prevent browser OOM from accidental bulk uploads.

---

## 5. Performance & Resource Impact

### 5.1 Application Characteristics

| Metric | Typical Value | Notes |
|---|---|---|
| Initial page load size | ~1.1 MB (JS bundle) + ~10 KB (CSS) + ~2 KB (HTML) | One-time load; cached by browser on subsequent visits |
| `template.xlsx` size | Variable (depends on template complexity) | Loaded only on Generate click |
| Memory usage (idle) | ~10–20 MB | React DOM + unassigned image thumbnails |
| Memory usage (generating) | ~50–150 MB | Depends on image count, resolution, and merged-image canvas operations |
| Generate time | 2–10 seconds | Depends on image count and resolution |
| localStorage usage | ~5–50 MB | Depends on number and size of assigned images (base64-encoded) |

### 5.2 Browser Compatibility

The tool requires modern browser APIs:

| API | Minimum Browser Version |
|---|---|
| FileReader | Chrome 6+, Firefox 3.6+, Edge 12+, Safari 6+ |
| Canvas 2D | Chrome 1+, Firefox 1.5+, Edge 12+, Safari 2+ |
| `URL.createObjectURL` | Chrome 8+, Firefox 4+, Edge 12+, Safari 6+ |
| `localStorage` | All modern browsers (minimum ~5 MB quota per origin) |
| `Image.decoding = "async"` | Chrome 65+, Firefox 133+, Edge 79+, Safari 16.4+ |

**Recommended browsers:** Chrome 90+, Edge 90+, Firefox 133+.

### 5.3 Resource Limits & Safeguards

- **localStorage quota:** Browsers typically enforce a 5–10 MB per-origin limit. The tool stores images as base64 data URIs, which inflates size by ~33% compared to binary. Users with many high-resolution images may exceed the quota. In this case, older assignments are dropped (the tool does not currently implement LRU eviction, but writes are wrapped in a try/catch that silently discards overflow data).
- **Canvas size limit:** Browsers impose maximum canvas dimensions (typically 16,384 × 16,384 px). Merged-image slots should not exceed this; the tool resizes images to fit the target cell range before canvas operations.
- **File size limit:** No explicit limit is enforced on individual image uploads. IT teams may recommend a guideline of < 20 MB per image to prevent excessive memory consumption.

---

## 6. Maintenance & Configuration

### 6.1 Operational Ownership

| Responsibility | Recommended Owner |
|---|---|
| Application source code | IT Development / Digital Solutions Team |
| Template file (`template.xlsx`) | NPI / QA Engineering Lead |
| Slot configuration (cell ranges, labels) | NPI / QA Engineering Lead (proposes) + IT (implements in source) |
| Dependency updates & CVE monitoring | IT Development Team |
| End-user training & documentation | NPI / QA Team Lead |
| EUC inventory registration | IT Governance / Compliance |

### 6.2 Template Update Procedure

When the inspection standard requirements change (e.g., a new image slot is added, an existing range is resized, or an image region is removed):

1. **NPI/QA Lead** modifies `template.xlsx` in the appropriate worksheet (typically `COVER`).
2. **NPI/QA Lead** communicates the changes — specifically, the affected template keys and their new cell ranges — to the IT Development Team.
3. **IT Developer** updates the slot definition array in the source code (`Vd` constant) to reflect the new keys or ranges.
4. **IT Developer** runs the build pipeline, validates the output against a sample set of images, and deploys the updated bundle alongside the new `template.xlsx`.
5. **NPI/QA Lead** smoke-tests the deployed version with a known-good item.

### 6.3 Adding a New Image Slot

To add a new slot to the configuration, modify the `Vd` array in the application source. Each entry follows the schema:

```
{
  id: string;           // Unique slot identifier (camelCase)
  templateKey: string;  // Name of the placeholder/shape in template.xlsx
  sheet: string;        // Worksheet name (default: "COVER")
  range: string;        // Target cell range in Excel notation (e.g., "A1:B10")
  cell: string;         // Starting cell column letter(s), derived from range
  label: string;        // Human-readable label displayed in the UI
  role: string;         // "direct" for single-image, "merged" for two-image merge
  assetKeys: string[];  // 1 element for direct, 2 for merged (the sub-slot names)
  section: string;      // Grouping section: "product", "packaging", "marking", "folding", "sample"
}
```

Ensure the `templateKey` matches exactly the image name or shape name defined in `template.xlsx`.

### 6.4 Dependency Inventory

| Package | License | Purpose |
|---|---|---|
| `react` | MIT | UI component framework |
| `react-dom` | MIT | DOM rendering |
| `exceljs` | MIT | Excel workbook read/write, image insertion |
| `jszip` | MIT | OOXML / ZIP packaging for `.xlsx` output |

### 6.5 Build & Deployment

The application is built with **Vite** (inferred from the ES module bundle structure). Typical build pipeline:

```
npm install
npm run build
# Output: dist/ directory containing index.html + assets/
```

Deployment is a static file copy to the web server, CDN, or GitHub Pages `main` branch.

---

## 7. Troubleshooting & Known Issues

### 7.1 Common Failure Modes

| Symptom | Likely Cause | Resolution |
|---|---|---|
| "Failed to load template" error | `template.xlsx` not found at the expected path; CORS blocking the fetch | Verify `template.xlsx` is deployed alongside `index.html`; check browser console for network errors |
| Images not appearing in generated Excel | Slot template key mismatch between source code and `template.xlsx` | Cross-reference the `templateKey` values in the slot definitions with the actual named ranges/shapes in the template |
| Merged image looks stretched or distorted | Source images have incompatible aspect ratios | Resize source images to similar dimensions before assignment, or update the merge logic to letterbox instead of stretch |
| localStorage quota exceeded | Too many large images assigned; base64 inflation | Reduce image resolution before uploading; clear previous assignments via the UI reset button |
| Page blank or "Application error" | JavaScript bundle failed to load; browser too old | Verify browser compatibility (Section 5.2); check console for specific errors |
| Generate takes > 30 seconds | Very large source images; many merged slots | Resize images to no larger than the target cell dimensions (typically < 2000 px per side) before uploading |
| Downloaded file named "Inspection Standard - .xlsx" | No item name entered in the export filename field | Enter an item/part number in the filename field before clicking Generate |
| Accessory 1 image appears in wrong position | Template key misspelled as `acessory_1` in template | This is a known template artifact; the tool accounts for it. If it breaks, verify the source code maps `accessory_1` → `acessory_1` |

### 7.2 Diagnostic Information

When troubleshooting, collect the following from the affected user's browser:

1. **Browser console output** (F12 → Console tab) — any errors or warnings.
2. **Network tab** (F12 → Network) — verify `template.xlsx` loads with HTTP 200.
3. **Application state** (F12 → Application → Local Storage → the app's origin) — inspect assignment data.
4. **Browser version and OS** (navigator.userAgent).
5. **Screenshot of the workspace** showing which slots are assigned and which are empty.

### 7.3 Recovery Procedures

**Corrupted assignment state.** Open the browser's Developer Tools (F12), navigate to Application → Local Storage, and delete the entry for the app's origin. Reload the page. All assignments will be cleared, and the image pool will be empty.

**Failed template load.** Ensure `template.xlsx` is present in the same directory as `index.html`. If the app is hosted on a different origin from the template, verify CORS headers allow cross-origin requests.

**Browser tab unresponsive.** Close the tab, reopen the application URL. If images were assigned, they may be recovered from localStorage (assignments are saved after each change). If the tab crash corrupted localStorage, start fresh.

---

## 8. Change Management

Any modification to the following requires review per the organization's change control policy:

- **Source code** (slot configuration, image processing logic, merge behavior)
- **`template.xlsx`** (cell ranges, new/removed slots, worksheet structure)
- **Dependencies** (ExcelJS, JSZip, React version upgrades)
- **Deployment target** (hosting platform, domain, CDN configuration)
- **Build tooling** (Vite configuration, bundling settings)

### 8.1 Pre-Deployment Testing Checklist

Before promoting a new version to production:

- [ ] `npm audit` returns zero critical/high vulnerabilities.
- [ ] Template loads successfully in Chrome, Edge, and Firefox.
- [ ] All 27 slots accept image assignment (23 direct + 4 merged).
- [ ] Merged-image slots correctly combine two source images side-by-side.
- [ ] Generated `.xlsx` opens without errors in Microsoft Excel (desktop) and Excel Online.
- [ ] Slot completeness counter shows correct assigned/total count.
- [ ] localStorage save/restore works: assign images, reload page, confirm assignments persist.
- [ ] Reset button clears all state.
- [ ] Vietnamese locale renders all labels, instructions, and UI text correctly (if i18n is maintained).
- [ ] Dark theme renders all UI elements with sufficient contrast.

---

## Appendix A: File Inventory

| File | Purpose | Format |
|---|---|---|
| `index.html` | Application entry point; mounts React root | HTML5 |
| `assets/index-C4crLsSL.js` | Bundled application code (React + ExcelJS + JSZip + app logic) | JavaScript (ES modules) |
| `assets/index-Ddfo1yrU.css` | Application stylesheet (light/dark theme, responsive layout) | CSS |
| `template.xlsx` | Master inspection standard template with named image placeholders | Excel OOXML (.xlsx) |
| `README.md` | This document | Markdown |

## Appendix B: Slot Quick-Reference Card

```
Section: Product (9)
  ib_safety ................ AP2:BF16
  trimmer_hdpe ............. BG2:BW16
  accessory_1–7 ............ BX2:GR16 (sequential)

Section: Packaging (5)
  colorbox_front_back ...... AP17:BF42  [MERGED: 2 src]
  colorbox_top_bottom ...... BG17:BW42  [MERGED: 2 src]
  colorbox_left_right ...... BX17:CN42  [MERGED: 2 src]
  top_view_inside .......... DF17:DV42
  actual_inside_carton ..... AQ47:BE57

Section: Marking (6)
  label .................... CO17:DE30
  colorbox_nom_label ....... CO31:DE42
  lazer_actual ............. Y8:AM19
  lazer_drawing ............ Y20:AM29
  nom_lable ................ Y30:AM40
  mastercarton_label_drawing BS58:CR69

Section: Folding (5)
  how_to_fold_1–5 .......... DW17:HC42 (sequential)

Section: Sample (2)
  fg_colorbox_front ........ C13:M40
  trimmer_front_back ....... N13:X40  [MERGED: 2 src]
```

---

*End of document. Prepared for IT security and architecture review.*
