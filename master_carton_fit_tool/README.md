# Master Carton Fit Tool — Live Demo

**[Open the live demo](index.html)** — runs entirely in your browser, no download required. A "Download this demo (.zip)" link is also available on the page if you'd rather run it from your own machine.

## The problem

WAHL Vietnam's 2025 downtime report traced **71 labor-hours** (≈2.84M ₫ in loaded labor cost) directly to incorrect carton dimensions surfacing during trial production — not on paper, but on the line, after tooling and staffing were already committed. Four separate FG cases contributed, one alone accounting for 33.75 hours. The dimensions were wrong; nothing in the process caught it before it became downtime.

## What this is

A tool I built for WAHL Vietnam's NPI (New Product Introduction) team to catch that mismatch before the line does: check whether finished goods physically fit inside master shipping cartons, audit current BOM carton assignments, compare alternatives, and identify opportunities to consolidate carton sizes across products.

This demo uses **fictional sample data** (9 sample products, 4 sample cartons) instead of real company data. Everything else — the packing engine, the UI, the calculation modes — is the real, current version of the tool.

## What it does

- **New Product** — enter FG dimensions and target quantity, check fit against existing cartons, generate shared-carton proposals, view packing in 3D.
- **FG Lookup** — select a product, see its assigned carton, compare alternatives, review fit/capacity/utilization with 3D packing visualization and carton photos.
- **Carton Audit** — audit a specific FG/carton pairing with autofill, manual entry, or a selector for ambiguous assignments.
- **Batch Audit** — run fit checks across every product at once, in Quick or Optimized mode, plus a carton-line-reduction analysis (fewer distinct carton sizes, same fit).
- **Carton Lookup** — search a carton, see every product assigned to it, view its photos.

## How the packing check works

- **Quick Mode**: exact dimensions, 5&nbsp;mm wall deduction per side, six orthogonal orientations, rigid-grid packing (no compression, nesting, or diagonal placement).
- **Optimized Mode**: keeps carton dimensions fixed and tests product length/width/height ratios from 0.90–1.10 in 0.05 steps — 125 combinations × 6 orientations per product/carton pair — to find better-utilizing arrangements within a reasonable tolerance window.

Try product **DEMO-1009** in FG Lookup — it's deliberately oversized to show what a genuine dimensional mismatch looks like (flagged as "BOM CONFIRMED — MODEL MISMATCH" with zero packing capacity), not just the happy path.

## Production vs. this demo

| | Production (WAHL Vietnam) | This demo |
|---|---|---|
| Data source | Live Excel BOM & dimension workbooks, read directly from the shared drive | Pre-generated sample CSVs, committed to this repo |
| Preprocessing | An offline PowerShell launcher parses the workbooks, averages carton measurements, and republishes the data on every launch | Skipped — the sample CSVs are already in the format the launcher would produce |
| Hosting | Runs 100% offline on a Windows machine, no server, no internet required | Static GitHub Pages hosting (this is just the browser-side app) |
| Data | Real product/carton dimensions, real photos | Fictional products and dimensions, illustrated placeholder carton graphics |

The frontend code is identical between the two — this demo is the same `index.html` the WAHL Vietnam team runs locally, just pointed at sample data instead of the real launcher output.

## Impact and rollout

- **Fewer carton lines** — Batch Audit's carton-line-reduction analysis runs a greedy set-cover across every logged product to find where distinct carton sizes can consolidate without hurting fit.
- **Tangible artifact** — every audit and batch run exports to CSV, so a recommendation is something a meeting can actually review, not just a screen someone saw once.
- **Advisory, not automatic** — every recommendation carries the same caveat production does: confirm with a physical sample before changing a carton assignment. The tool narrows the search; it doesn't replace the check.

Rolled out as a 2-week pilot with the NPI team — run it, collect issues, confirm data ownership, then decide on wider deployment.

## Tech stack

Single-file HTML/CSS/JavaScript, zero external dependencies or build step. Runs in Chrome or Edge. The production launcher (not included here, since it has no purpose without real Excel workbooks) is a PowerShell script that parses `.xlsx` files directly from their ZIP/XML structure — no Excel installation or COM automation required.
