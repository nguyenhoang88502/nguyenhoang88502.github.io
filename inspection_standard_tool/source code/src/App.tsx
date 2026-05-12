import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type ExcelJS from "exceljs";
import AssetWorkspace from "./components/AssetWorkspace";
import DropZone from "./components/DropZone";
import GenerateButton from "./components/GenerateButton";
import Instructions from "./components/Instructions";
import { getAssetRequirements, getTemplateSlots, type TemplateSlot } from "./config";
import { isAllowedFile } from "./utils/filenameMatcher";
import { loadTemplate, insertImage, downloadWorkbook } from "./utils/excelEngine";
import { mergeImagesHorizontally } from "./utils/imageMerge";
import type { Locale, Theme } from "./i18n";
import type { SlotAssignments, UploadedImage } from "./types";
import "./App.css";

const TEMPLATE_SLOTS = getTemplateSlots();
const ASSET_REQUIREMENTS = getAssetRequirements();

const APP_COPY: Record<
  Locale,
  {
    title: string;
    subtitle: string;
    loading: string;
    retry: string;
    darkMode: string;
    lightMode: string;
    language: string;
    theme: string;
    templateLoadFailed: string;
    generateFailed: string;
  }
> = {
  en: {
    title: "Inspection Standard Image Inserter",
    subtitle:
      "Add the source images, assign them to their template keys, and merged slots will be combined automatically before Excel insertion.",
    loading: "Loading template...",
    retry: "Retry",
    darkMode: "Dark",
    lightMode: "Light",
    language: "Language",
    theme: "Theme",
    templateLoadFailed: "Template load failed",
    generateFailed: "Failed to generate Excel",
  },
  vi: {
    title: "Công cụ chèn hình Inspection Standard",
    subtitle:
      "Thêm hình nguồn, gán vào đúng khóa trong template, các ô ghép sẽ tự động được nối hình trước khi chèn vào Excel.",
    loading: "Đang tải template...",
    retry: "Thử lại",
    darkMode: "Tối",
    lightMode: "Sáng",
    language: "Ngôn ngữ",
    theme: "Giao diện",
    templateLoadFailed: "Không tải được template",
    generateFailed: "Không thể tạo file Excel",
  },
};

function fileSignature(file: File): string {
  return `${file.name.toLowerCase()}::${file.size}::${file.lastModified}`;
}

function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? filename : filename.slice(0, dot);
}

function removeImageFromOtherAssets(
  assignments: SlotAssignments,
  imageId: string
): SlotAssignments {
  const next: SlotAssignments = {};
  for (const [assetKey, assignedImageId] of Object.entries(assignments)) {
    next[assetKey] = assignedImageId === imageId ? undefined : assignedImageId;
  }
  return next;
}

async function imageForTemplateSlot(
  templateSlot: TemplateSlot,
  assignments: SlotAssignments,
  imageMap: Map<string, UploadedImage>
): Promise<File | null> {
  const files = templateSlot.assetKeys
    .map((assetKey) => {
      const imageId = assignments[assetKey];
      return imageId ? imageMap.get(imageId)?.file : undefined;
    })
    .filter((file): file is File => Boolean(file));

  if (files.length === 0) return null;
  if (files.length === 1) return files[0];

  return mergeImagesHorizontally(files, templateSlot.id);
}

export default function App() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [assignments, setAssignments] = useState<SlotAssignments>({});
  const [locale, setLocale] = useState<Locale>(() => {
    return localStorage.getItem("inspection-locale") === "vi" ? "vi" : "en";
  });
  const [theme, setTheme] = useState<Theme>(() => {
    return localStorage.getItem("inspection-theme") === "dark"
      ? "dark"
      : "light";
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateReady, setTemplateReady] = useState(false);
  const nextImageId = useRef(0);
  const previewUrls = useRef<string[]>([]);
  const copy = APP_COPY[locale];

  const assetKeySet = useMemo(
    () => new Set(ASSET_REQUIREMENTS.map((asset) => asset.id)),
    []
  );

  const createUploadedImages = useCallback((files: File[]) => {
    const validFiles = files.filter(isAllowedFile);
    return validFiles.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.push(previewUrl);
      return {
        id: `image-${Date.now()}-${nextImageId.current++}`,
        file,
        previewUrl,
      };
    });
  }, []);

  const autoAssignByFilename = useCallback(
    (newImages: UploadedImage[], currentAssignments: SlotAssignments) => {
      const next = { ...currentAssignments };

      for (const image of newImages) {
        const assetKey = stripExtension(image.file.name).toLowerCase();
        if (!assetKeySet.has(assetKey) || next[assetKey]) continue;
        next[assetKey] = image.id;
      }

      return next;
    },
    [assetKeySet]
  );

  const addImages = useCallback(
    (newFiles: File[]) => {
      const existing = new Set(images.map((image) => fileSignature(image.file)));
      const uniqueFiles = newFiles.filter(
        (file) => isAllowedFile(file) && !existing.has(fileSignature(file))
      );
      const newImages = createUploadedImages(uniqueFiles);
      if (newImages.length === 0) return;

      setImages((currentImages) => [...currentImages, ...newImages]);
      setAssignments((currentAssignments) =>
        autoAssignByFilename(newImages, currentAssignments)
      );
    },
    [autoAssignByFilename, createUploadedImages, images]
  );

  const addImagesToAsset = useCallback(
    (assetKey: string, files: File[]) => {
      const firstValidFile = files.find(isAllowedFile);
      if (!firstValidFile) return;

      const existingImage = images.find(
        (image) => fileSignature(image.file) === fileSignature(firstValidFile)
      );
      if (existingImage) {
        setAssignments((currentAssignments) => ({
          ...removeImageFromOtherAssets(currentAssignments, existingImage.id),
          [assetKey]: existingImage.id,
        }));
        return;
      }

      const [newImage] = createUploadedImages([firstValidFile]);
      if (!newImage) return;

      setImages((currentImages) => [...currentImages, newImage]);
      setAssignments((currentAssignments) => ({
        ...removeImageFromOtherAssets(currentAssignments, newImage.id),
        [assetKey]: newImage.id,
      }));
    },
    [createUploadedImages, images]
  );

  const assignImageToAsset = useCallback((assetKey: string, imageId: string) => {
    setAssignments((currentAssignments) => ({
      ...removeImageFromOtherAssets(currentAssignments, imageId),
      [assetKey]: imageId,
    }));
  }, []);

  const clearAsset = useCallback((assetKey: string) => {
    setAssignments((currentAssignments) => ({
      ...currentAssignments,
      [assetKey]: undefined,
    }));
  }, []);

  const processedSlotCount = useMemo(
    () =>
      TEMPLATE_SLOTS.filter((slot) =>
        slot.assetKeys.some((assetKey) => assignments[assetKey])
      ).length,
    [assignments]
  );

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const wb: ExcelJS.Workbook = await loadTemplate(true);
      const imageMap = new Map(images.map((image) => [image.id, image]));

      for (const templateSlot of TEMPLATE_SLOTS) {
        const image = await imageForTemplateSlot(
          templateSlot,
          assignments,
          imageMap
        );
        if (!image) continue;
        await insertImage(wb, templateSlot, image);
      }

      await downloadWorkbook(wb);
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.generateFailed);
    } finally {
      setLoading(false);
    }
  }, [assignments, copy.generateFailed, images]);

  useEffect(() => {
    loadTemplate()
      .then(() => setTemplateReady(true))
      .catch((e) => setError(`${copy.templateLoadFailed}: ${e.message}`));
  }, [copy.templateLoadFailed]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("inspection-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("inspection-locale", locale);
  }, [locale]);

  useEffect(() => {
    return () => {
      for (const previewUrl of previewUrls.current) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__toolbar" aria-label="Display settings">
          <div className="app__control">
            <span>{copy.language}</span>
            <div className="app__segmented">
              <button
                type="button"
                className={locale === "en" ? "app__segment--active" : ""}
                onClick={() => setLocale("en")}
              >
                EN
              </button>
              <button
                type="button"
                className={locale === "vi" ? "app__segment--active" : ""}
                onClick={() => setLocale("vi")}
              >
                VI
              </button>
            </div>
          </div>
          <div className="app__control">
            <span>{copy.theme}</span>
            <button
              type="button"
              className="app__theme-toggle"
              onClick={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
            >
              {theme === "dark" ? copy.lightMode : copy.darkMode}
            </button>
          </div>
        </div>
        <h1 className="app__title">{copy.title}</h1>
        <p className="app__subtitle">{copy.subtitle}</p>
      </header>

      {!templateReady && !error && (
        <div className="app__loading">{copy.loading}</div>
      )}

      {error && (
        <div className="app__error">
          <p>{error}</p>
          <button
            onClick={() => {
              setError(null);
              loadTemplate()
                .then(() => setTemplateReady(true))
                .catch(() => {});
            }}
          >
            {copy.retry}
          </button>
        </div>
      )}

      {templateReady && (
        <>
          <Instructions locale={locale} />
          <DropZone locale={locale} onFilesAdded={addImages} />
          <AssetWorkspace
            locale={locale}
            templateSlots={TEMPLATE_SLOTS}
            images={images}
            assignments={assignments}
            onAssign={assignImageToAsset}
            onClear={clearAsset}
            onFilesAdded={addImages}
            onFilesAddedToAsset={addImagesToAsset}
          />
          <GenerateButton
            locale={locale}
            matchCount={processedSlotCount}
            disabled={processedSlotCount === 0}
            loading={loading}
            onClick={handleGenerate}
          />
        </>
      )}
    </div>
  );
}
