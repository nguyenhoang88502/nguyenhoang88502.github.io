import { useMemo, useState, type DragEvent } from "react";
import { labelFromAssetKey, type TemplateSlot } from "../config";
import type { Locale } from "../i18n";
import type { SlotAssignments, UploadedImage } from "../types";
import "./AssetWorkspace.css";

interface Props {
  locale: Locale;
  templateSlots: TemplateSlot[];
  images: UploadedImage[];
  assignments: SlotAssignments;
  onAssign: (assetKey: string, imageId: string) => void;
  onClear: (assetKey: string) => void;
  onFilesAdded: (files: File[]) => void;
  onFilesAddedToAsset: (assetKey: string, files: File[]) => void;
}

const DRAG_IMAGE_ID = "application/x-inspection-image-id";

const COPY: Record<
  Locale,
  {
    sectionTitles: Record<TemplateSlot["section"], string>;
    title: string;
    summary: (assigned: number, required: number) => string;
    unassigned: string;
    emptyPool: string;
    autoMerged: string;
    directInsert: string;
    clear: string;
    dropHere: string;
    pastedImage: string;
    slotLabels: Record<string, string>;
    assetLabels: Record<string, string>;
  }
> = {
  en: {
    sectionTitles: {
      product: "Product & Accessories",
      packaging: "Packaging Views",
      marking: "Labels & Markings",
      folding: "Folding Instructions",
      sample: "Customer Sample Submission",
    },
    title: "Template Asset Workspace",
    summary: (assigned, required) =>
      `${assigned} of ${required} required source images assigned`,
    unassigned: "Unassigned Images",
    emptyPool: "Drop extra images here, then drag them into a labeled slot.",
    autoMerged: "Auto-merged",
    directInsert: "Direct insert",
    clear: "Clear",
    dropHere: "Drop image here",
    pastedImage: "Pasted image",
    slotLabels: {},
    assetLabels: {},
  },
  vi: {
    sectionTitles: {
      product: "Sản phẩm & phụ kiện",
      packaging: "Hình bao bì",
      marking: "Nhãn & khắc laser",
      folding: "Hướng dẫn gấp",
      sample: "Mẫu gửi khách hàng",
    },
    title: "Workspace gán hình theo template",
    summary: (assigned, required) =>
      `Đã gán ${assigned} / ${required} hình nguồn bắt buộc`,
    unassigned: "Hình chưa gán",
    emptyPool: "Thả hình dư ở đây, sau đó kéo vào ô đã đặt tên.",
    autoMerged: "Tự động ghép",
    directInsert: "Chèn trực tiếp",
    clear: "Xóa",
    dropHere: "Thả hình vào đây",
    pastedImage: "Hình đã dán",
    slotLabels: {
      ib_safety: "IB Safety",
      trimmer_hdpe: "Trimmer HDPE",
      accessory_1: "Phụ kiện 1",
      accessory_2: "Phụ kiện 2",
      accessory_3: "Phụ kiện 3",
      accessory_4: "Phụ kiện 4",
      colorbox_front_back: "Colorbox mặt trước & mặt sau",
      colorbox_top_bottom: "Colorbox mặt trên & mặt dưới",
      colorbox_left_right: "Colorbox mặt trái & mặt phải",
      label: "Nhãn",
      top_view_inside: "Mặt trên bên trong",
      how_to_fold_1: "Cách gấp 1",
      how_to_fold_2: "Cách gấp 2",
      how_to_fold_3: "Cách gấp 3",
      colorbox_nom_label: "Nhãn NOM colorbox",
      lazer_actual: "Laser thực tế",
      lazer_drawing: "Bản vẽ laser",
      nom_lable: "Nhãn NOM",
      fg_colorbox_front: "FG colorbox mặt trước",
      trimmer_front_back: "Trimmer mặt trước & mặt sau",
      actual_inside_packaging: "Bao bì bên trong thực tế",
      mastercarton_label_drawing: "Bản vẽ nhãn thùng carton",
    },
    assetLabels: {
      ib_safety: "IB Safety",
      trimmer_hdpe: "Trimmer HDPE",
      accessory_1: "Phụ kiện 1",
      accessory_2: "Phụ kiện 2",
      accessory_3: "Phụ kiện 3",
      accessory_4: "Phụ kiện 4",
      colorbox_front: "Colorbox mặt trước",
      colorbox_back: "Colorbox mặt sau",
      colorbox_top: "Colorbox mặt trên",
      colorbox_bottom: "Colorbox mặt dưới",
      colorbox_left: "Colorbox mặt trái",
      colorbox_right: "Colorbox mặt phải",
      label: "Nhãn",
      top_view_inside: "Mặt trên bên trong",
      how_to_fold_1: "Cách gấp 1",
      how_to_fold_2: "Cách gấp 2",
      how_to_fold_3: "Cách gấp 3",
      colorbox_nom_label: "Nhãn NOM colorbox",
      lazer_actual: "Laser thực tế",
      lazer_drawing: "Bản vẽ laser",
      nom_lable: "Nhãn NOM",
      fg_colorbox_front: "FG colorbox mặt trước",
      trimmer_front: "Trimmer mặt trước",
      trimmer_back: "Trimmer mặt sau",
      actual_inside_packaging: "Bao bì bên trong thực tế",
      mastercarton_label_drawing: "Bản vẽ nhãn thùng carton",
    },
  },
};

export default function AssetWorkspace({
  locale,
  templateSlots,
  images,
  assignments,
  onAssign,
  onClear,
  onFilesAdded,
  onFilesAddedToAsset,
}: Props) {
  const [activeAssetKey, setActiveAssetKey] = useState<string | null>(null);
  const copy = COPY[locale];
  const imageMap = useMemo(
    () => new Map(images.map((image) => [image.id, image])),
    [images]
  );
  const assignedIds = useMemo(
    () => new Set(Object.values(assignments).filter(Boolean) as string[]),
    [assignments]
  );
  const unassignedImages = images.filter((image) => !assignedIds.has(image.id));
  const requiredCount = templateSlots.reduce(
    (sum, slot) => sum + slot.assetKeys.length,
    0
  );
  const assignedCount = templateSlots.reduce(
    (sum, slot) =>
      sum + slot.assetKeys.filter((assetKey) => assignments[assetKey]).length,
    0
  );

  const handleAssetDrop = (
    event: DragEvent<HTMLDivElement>,
    assetKey: string
  ) => {
    event.preventDefault();
    setActiveAssetKey(null);

    const imageId = event.dataTransfer.getData(DRAG_IMAGE_ID);
    if (imageId) {
      onAssign(assetKey, imageId);
      return;
    }

    const droppedFiles = Array.from(event.dataTransfer.files);
    if (droppedFiles.length > 0) {
      onFilesAddedToAsset(assetKey, droppedFiles);
    }
  };

  const handlePoolDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files);
    if (droppedFiles.length > 0) {
      onFilesAdded(droppedFiles);
    }
  };

  return (
    <section className="workspace" aria-label="Image assignment workspace">
      <div className="workspace__header">
        <div>
          <h2 className="workspace__title">{copy.title}</h2>
          <p className="workspace__summary">
            {copy.summary(assignedCount, requiredCount)}
          </p>
        </div>
      </div>

      <div className="workspace__layout">
        <div className="workspace__slots">
          {(Object.keys(copy.sectionTitles) as TemplateSlot["section"][]).map(
            (section) => {
              const slots = templateSlots.filter(
                (slot) => slot.section === section
              );
              if (slots.length === 0) return null;
              return (
                <SlotSection
                  key={section}
                  title={copy.sectionTitles[section]}
                  slots={slots}
                  assignments={assignments}
                  activeAssetKey={activeAssetKey}
                  imageMap={imageMap}
                  locale={locale}
                  onClear={onClear}
                  onDragEnter={setActiveAssetKey}
                  onDragLeave={() => setActiveAssetKey(null)}
                  onDrop={handleAssetDrop}
                />
              );
            }
          )}
        </div>

        <aside
          className="asset-pool"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handlePoolDrop}
        >
          <div className="asset-pool__header">
            <h3 className="asset-pool__title">{copy.unassigned}</h3>
            <span className="asset-pool__count">{unassignedImages.length}</span>
          </div>
          {unassignedImages.length > 0 ? (
            <div className="asset-pool__grid">
              {unassignedImages.map((image) => (
                <ImageThumb key={image.id} image={image} />
              ))}
            </div>
          ) : (
            <div className="asset-pool__empty">
              {copy.emptyPool}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function SlotSection({
  title,
  slots,
  assignments,
  activeAssetKey,
  imageMap,
  locale,
  onClear,
  onDragEnter,
  onDragLeave,
  onDrop,
}: {
  title: string;
  slots: TemplateSlot[];
  assignments: SlotAssignments;
  activeAssetKey: string | null;
  imageMap: Map<string, UploadedImage>;
  locale: Locale;
  onClear: (assetKey: string) => void;
  onDragEnter: (assetKey: string) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>, assetKey: string) => void;
}) {
  return (
    <div className="slot-section">
      <h3 className="slot-section__title">{title}</h3>
      <div className="slot-grid">
        {slots.map((slot) => (
          <TemplateSlotCard
            key={slot.id}
            slot={slot}
            assignments={assignments}
            activeAssetKey={activeAssetKey}
            imageMap={imageMap}
            locale={locale}
            onClear={onClear}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateSlotCard({
  slot,
  assignments,
  activeAssetKey,
  imageMap,
  locale,
  onClear,
  onDragEnter,
  onDragLeave,
  onDrop,
}: {
  slot: TemplateSlot;
  assignments: SlotAssignments;
  activeAssetKey: string | null;
  imageMap: Map<string, UploadedImage>;
  locale: Locale;
  onClear: (assetKey: string) => void;
  onDragEnter: (assetKey: string) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>, assetKey: string) => void;
}) {
  const complete = slot.assetKeys.every((assetKey) => assignments[assetKey]);
  const copy = COPY[locale];

  return (
    <div className={`slot-card ${complete ? "slot-card--assigned" : ""}`}>
      <div className="slot-card__meta">
        <span className="slot-card__label">
          {copy.slotLabels[slot.id] ?? slot.label}
        </span>
        <span className="slot-card__target">
          {slot.sheet}!{slot.range}
        </span>
      </div>
      <div
        className={`slot-card__body ${
          slot.assetKeys.length > 1 ? "slot-card__body--split" : ""
        }`}
      >
        {slot.assetKeys.map((assetKey) => {
          const assignedImageId = assignments[assetKey];
          const assignedImage = assignedImageId
            ? imageMap.get(assignedImageId)
            : undefined;
          return (
            <AssetDropTarget
              key={assetKey}
              assetKey={assetKey}
              assignedImage={assignedImage}
              isActive={activeAssetKey === assetKey}
              locale={locale}
              onClear={onClear}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            />
          );
        })}
      </div>
      <div className="slot-card__footer">
        <span>{slot.templateKey}</span>
        <span>
          {slot.assetKeys.length > 1 ? copy.autoMerged : copy.directInsert}
        </span>
      </div>
    </div>
  );
}

function AssetDropTarget({
  assetKey,
  assignedImage,
  isActive,
  locale,
  onClear,
  onDragEnter,
  onDragLeave,
  onDrop,
}: {
  assetKey: string;
  assignedImage?: UploadedImage;
  isActive: boolean;
  locale: Locale;
  onClear: (assetKey: string) => void;
  onDragEnter: (assetKey: string) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>, assetKey: string) => void;
}) {
  const handleDragStart = (
    event: DragEvent<HTMLDivElement>,
    imageId: string
  ) => {
    event.dataTransfer.setData(DRAG_IMAGE_ID, imageId);
    event.dataTransfer.effectAllowed = "move";
  };
  const copy = COPY[locale];
  const label = copy.assetLabels[assetKey] ?? labelFromAssetKey(assetKey);

  return (
    <div
      className={`asset-target ${assignedImage ? "asset-target--assigned" : ""} ${
        isActive ? "asset-target--active" : ""
      }`}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={() => onDragEnter(assetKey)}
      onDragLeave={onDragLeave}
      onDrop={(event) => onDrop(event, assetKey)}
    >
      {assignedImage ? (
        <div
          className="asset-target__preview"
          draggable
          onDragStart={(event) => handleDragStart(event, assignedImage.id)}
        >
          <img src={assignedImage.previewUrl} alt={label} />
          <span className="asset-target__filename">
            {assignedImage.file.name || copy.pastedImage}
          </span>
          <button
            type="button"
            className="asset-target__clear"
            onClick={() => onClear(assetKey)}
          >
            {copy.clear}
          </button>
        </div>
      ) : (
        <div className="asset-target__placeholder">
          <span className="asset-target__name">{label}</span>
          <span className="asset-target__hint">{copy.dropHere}</span>
        </div>
      )}
    </div>
  );
}

function ImageThumb({ image }: { image: UploadedImage }) {
  const name = image.file.name || "Pasted image";

  return (
    <div
      className="image-thumb"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_IMAGE_ID, image.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      title={name}
    >
      <img src={image.previewUrl} alt={name} />
      <span className="image-thumb__name">{name}</span>
    </div>
  );
}
