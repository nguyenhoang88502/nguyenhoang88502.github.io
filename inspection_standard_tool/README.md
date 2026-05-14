# Inspection Standard Tool

A browser-based tool for placing inspection-standard pictures into the Excel template.

## What It Does

- Upload image files or PDF pages.
- Drag each picture into the matching template asset slot.
- Crop pictures by hand with draggable crop handles.
- Generate an Excel workbook from `template.xlsx`.
- Insert each picture proportionally so either left/right or top/bottom both touch the target cell range.
- Keep BOM checks in the web app instead of writing BOM text into the output workbook.

## Template Keys

Name image files with the same snake_case key when you want automatic assignment, for example:

```text
ib.png
charger_battery.jpg
colorbox_left.png
colorbox_right.png
trimmer_front.png
trimmer_back.png
```

The app supports direct slots and paired merge slots.

## Paired Merge Slots

- `trimmer_front` + `trimmer_back`: merged horizontally, front left and back right.
- `colorbox_left` + `colorbox_right`: merged horizontally, left then right.
- `colorbox_top` + `colorbox_bottom`: merged vertically, top then bottom.

## BOM Check

Use the BOM panel to choose which unassigned assets should be checked against the BOM workbook.

If a picture has already been assigned to an asset slot, that asset is automatically skipped by the BOM check and its matching BOM table row disappears.

The generated filename also counts missing required pictures, including the master carton label and both lithium fire label slots.

The BOM result table is grouped by section and shows:

- Item number
- Product name

Existing pictures already embedded in `template.xlsx` are preserved. The app only adds uploaded pictures to mapped placeholder regions.

## Build

Install dependencies once:

```powershell
npm install
```

Run the app locally:

```powershell
npm run dev
```

Build production files:

```powershell
npm run build
```

The built app is written to:

```text
dist/
```

Preview the production build:

```powershell
npm run preview
```

## Updating The Template

Replace:

```text
template.xlsx
public/template.xlsx
```

Then run:

```powershell
npm run build
```

The build copies `public/template.xlsx` into `dist/template.xlsx`.
