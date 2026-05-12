import ExcelJS from "exceljs";
import type { TemplateSlot } from "../config";

let templateBufferCache: ArrayBuffer | null = null;
let workbookCache: ExcelJS.Workbook | null = null;

async function getTemplateBuffer(): Promise<ArrayBuffer> {
  if (templateBufferCache) return templateBufferCache.slice(0);
  const resp = await fetch("./template.xlsx");
  if (!resp.ok) throw new Error("Failed to load template");
  templateBufferCache = await resp.arrayBuffer();
  return templateBufferCache.slice(0);
}

export async function loadTemplate(fresh = false): Promise<ExcelJS.Workbook> {
  if (workbookCache && !fresh) return workbookCache;
  const buffer = await getTemplateBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (!fresh) workbookCache = workbook;
  return workbook;
}

export async function insertImage(
  wb: ExcelJS.Workbook,
  templateSlot: TemplateSlot,
  image: Blob & { name?: string }
): Promise<void> {
  const sheet = wb.getWorksheet(templateSlot.sheet);
  if (!sheet) throw new Error(`Sheet "${templateSlot.sheet}" not found`);

  const buffer = await image.arrayBuffer();

  const ext = image.name?.split(".").pop()?.toLowerCase();
  const isPng = image.type === "image/png" || ext === "png";
  let imgId: number;
  if (isPng) {
    imgId = wb.addImage({
      buffer: buffer as ArrayBuffer,
      extension: "png",
    });
  } else {
    imgId = wb.addImage({
      buffer: buffer as ArrayBuffer,
      extension: "jpeg",
    });
  }

  sheet.addImage(imgId, templateSlot.range);
}

export async function downloadWorkbook(wb: ExcelJS.Workbook): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Inspection_Standard.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
