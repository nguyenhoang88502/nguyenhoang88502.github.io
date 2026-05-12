import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { Locale } from "../i18n";
import { isAllowedFile } from "../utils/filenameMatcher";
import "./DropZone.css";

interface Props {
  locale: Locale;
  onFilesAdded: (files: File[]) => void;
}

const COPY: Record<
  Locale,
  {
    dropActive: string;
    title: string;
    or: string;
    browse: string;
    hint: string;
    formats: string;
    skipped: string;
    unsupported: string;
  }
> = {
  en: {
    dropActive: "Drop images to add them",
    title: "Add images to workspace",
    or: "or",
    browse: "Browse Files",
    hint: "You can also paste images with Ctrl+V or drop a file onto a named slot below.",
    formats: "JPG, JPEG, PNG",
    skipped: "Skipped",
    unsupported: "unsupported format",
  },
  vi: {
    dropActive: "Thả hình để thêm vào",
    title: "Thêm hình vào workspace",
    or: "hoặc",
    browse: "Chọn file",
    hint: "Bạn cũng có thể dán hình bằng Ctrl+V hoặc thả file vào ô được đặt tên bên dưới.",
    formats: "JPG, JPEG, PNG",
    skipped: "Đã bỏ qua",
    unsupported: "định dạng không hỗ trợ",
  },
};

export default function DropZone({ locale, onFilesAdded }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const copy = COPY[locale];

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const onDrop = useCallback(
    (accepted: File[]) => {
      setDragOver(false);
      const valid: File[] = [];
      for (const f of accepted) {
        if (isAllowedFile(f)) {
          valid.push(f);
        } else {
          showToast(`${copy.skipped} "${f.name}" - ${copy.unsupported}`);
        }
      }
      if (valid.length > 0) onFilesAdded(valid);
    },
    [copy.skipped, copy.unsupported, onFilesAdded, showToast]
  );

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] },
    noClick: true,
    noKeyboard: true,
    onDragEnter: () => setDragOver(true),
    onDragLeave: () => setDragOver(false),
  });

  useEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const blob = items[i].getAsFile();
        if (blob && isAllowedFile(blob)) files.push(blob);
      }
      if (files.length > 0) {
        e.preventDefault();
        onFilesAdded(files);
      }
    };
    el.addEventListener("paste", handler);
    return () => el.removeEventListener("paste", handler);
  }, [onFilesAdded]);

  return (
    <div className="dropzone-wrapper" ref={zoneRef}>
      <div
        {...getRootProps()}
        className={`dropzone ${dragOver ? "dropzone--active" : ""}`}
        tabIndex={0}
      >
        <input {...getInputProps()} />
        <div className="dropzone__icon">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
        </div>
        <p className="dropzone__title">
          {dragOver ? copy.dropActive : copy.title}
        </p>
        <p className="dropzone__sub">{copy.or}</p>
        <button type="button" className="dropzone__btn" onClick={open}>
          {copy.browse}
        </button>
        <p className="dropzone__hint">
          {copy.hint.split("Ctrl+V")[0]}
          <kbd>Ctrl+V</kbd>
          {copy.hint.split("Ctrl+V")[1]}
        </p>
        <p className="dropzone__formats">{copy.formats}</p>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
