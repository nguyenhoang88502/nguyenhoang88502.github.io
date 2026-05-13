export interface TemplateSlot {
  id: string;
  templateKey: string;
  sheet: string;
  range: string;
  cell: string;
  label: string;
  role: string;
  assetKeys: string[];
  section: "product" | "packaging" | "marking" | "folding" | "sample";
}

export interface AssetRequirement {
  id: string;
  label: string;
  templateSlotId: string;
}

function slot(
  id: string,
  templateKey: string,
  range: string,
  label: string,
  role: string,
  assetKeys: string[],
  section: TemplateSlot["section"],
  sheet = "COVER"
): TemplateSlot {
  const cell = range.split(":")[0];
  return { id, templateKey, sheet, range, cell, label, role, assetKeys, section };
}

export const TEMPLATE_SLOTS: TemplateSlot[] = [
  slot(
    "ib_safety",
    "ib_safety",
    "AP2:BF16",
    "IB Safety",
    "Instruction book safety artwork.",
    ["ib_safety"],
    "product"
  ),
  slot(
    "trimmer_hdpe",
    "trimmer_hdpe",
    "BG2:BW16",
    "Trimmer HDPE",
    "HDPE trimmer packaging/reference image.",
    ["trimmer_hdpe"],
    "product"
  ),
  slot(
    "accessory_1",
    "acessory_1",
    "BX2:CN16",
    "Accessory 1",
    "First accessory image. The template key is misspelled as acessory_1.",
    ["accessory_1"],
    "product"
  ),
  slot(
    "accessory_2",
    "accessory_2",
    "CO2:DF16",
    "Accessory 2",
    "Second accessory image.",
    ["accessory_2"],
    "product"
  ),
  slot(
    "accessory_3",
    "accessory_3",
    "DG2:DX16",
    "Accessory 3",
    "Third accessory image.",
    ["accessory_3"],
    "product"
  ),
  slot(
    "accessory_4",
    "accessory_4",
    "DY2:EP16",
    "Accessory 4",
    "Fourth accessory image.",
    ["accessory_4"],
    "product"
  ),
  slot(
    "colorbox_front_back",
    "colorbox_front & colorbox_back",
    "AP17:BF42",
    "Colorbox Front & Back",
    "Merged colorbox front and back images.",
    ["colorbox_front", "colorbox_back"],
    "packaging"
  ),
  slot(
    "colorbox_top_bottom",
    "colorbox_top & colorbox_bottom",
    "BG17:BW42",
    "Colorbox Top & Bottom",
    "Merged colorbox top and bottom images.",
    ["colorbox_top", "colorbox_bottom"],
    "packaging"
  ),
  slot(
    "colorbox_left_right",
    "colorbox_left & colorbox_right",
    "BX17:CN42",
    "Colorbox Left & Right",
    "Merged colorbox left and right images.",
    ["colorbox_left", "colorbox_right"],
    "packaging"
  ),
  slot(
    "label",
    "label",
    "CO17:DE30",
    "Label",
    "Product label image.",
    ["label"],
    "marking"
  ),
  slot(
    "top_view_inside",
    "top_view_inside",
    "DF17:DV42",
    "Top View Inside",
    "Inside packaging top-view image.",
    ["top_view_inside"],
    "packaging"
  ),
  slot(
    "how_to_fold_1",
    "how_to_fold_1",
    "DW17:EM42",
    "How To Fold 1",
    "First folding instruction image.",
    ["how_to_fold_1"],
    "folding"
  ),
  slot(
    "how_to_fold_2",
    "how_to_fold_2",
    "EN17:FD42",
    "How To Fold 2",
    "Second folding instruction image.",
    ["how_to_fold_2"],
    "folding"
  ),
  slot(
    "how_to_fold_3",
    "how_to_fold_3",
    "FE17:FU42",
    "How To Fold 3",
    "Third folding instruction image.",
    ["how_to_fold_3"],
    "folding"
  ),
  slot(
    "colorbox_nom_label",
    "colorbox_nom_label",
    "CO31:DE42",
    "Colorbox NOM Label",
    "Colorbox NOM label image.",
    ["colorbox_nom_label"],
    "marking"
  ),
  slot(
    "lazer_actual",
    "lazer_actual",
    "Y8:AM19",
    "Laser Actual",
    "Actual laser marking image.",
    ["lazer_actual"],
    "marking"
  ),
  slot(
    "lazer_drawing",
    "lazer_drawing",
    "Y20:AM29",
    "Laser Drawing",
    "Laser marking drawing image.",
    ["lazer_drawing"],
    "marking"
  ),
  slot(
    "nom_lable",
    "nom_lable",
    "Y30:AM40",
    "NOM Label",
    "NOM label image. The template key is spelled nom_lable.",
    ["nom_lable"],
    "marking"
  ),
  slot(
    "fg_colorbox_front",
    "fg_colorbox_front",
    "C13:M40",
    "FG Colorbox Front",
    "Finished goods colorbox front image.",
    ["fg_colorbox_front"],
    "sample"
  ),
  slot(
    "trimmer_front_back",
    "trimmer_front & trimmer_back",
    "N13:X40",
    "Trimmer Front & Back",
    "Merged trimmer front and back images.",
    ["trimmer_front", "trimmer_back"],
    "sample"
  ),
  slot(
    "actual_inside_packaging",
    "actual_inside_packaging",
    "AQ47:BE57",
    "Actual Inside Packaging",
    "Actual inside packaging image.",
    ["actual_inside_packaging"],
    "packaging"
  ),
  slot(
    "mastercarton_label_drawing",
    "mastercarton_label_drawing",
    "BS58:CR69",
    "Mastercarton Label Drawing",
    "Master carton label drawing image.",
    ["mastercarton_label_drawing"],
    "marking"
  ),
];

export function getTemplateSlots(): TemplateSlot[] {
  return TEMPLATE_SLOTS;
}

export function getAssetRequirements(): AssetRequirement[] {
  return TEMPLATE_SLOTS.flatMap((templateSlot) =>
    templateSlot.assetKeys.map((assetKey) => ({
      id: assetKey,
      label: labelFromAssetKey(assetKey),
      templateSlotId: templateSlot.id,
    }))
  );
}

export function getTemplateSlotsBySection(
  section: TemplateSlot["section"]
): TemplateSlot[] {
  return TEMPLATE_SLOTS.filter((templateSlot) => templateSlot.section === section);
}

export function labelFromAssetKey(assetKey: string): string {
  return assetKey
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .replace(/\bFg\b/g, "FG")
    .replace(/\bIb\b/g, "IB")
    .replace(/\bHdpe\b/g, "HDPE")
    .replace(/\bNom\b/g, "NOM");
}
