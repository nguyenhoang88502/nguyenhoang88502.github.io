import type { Locale } from "../i18n";
import "./GenerateButton.css";

interface Props {
  locale: Locale;
  matchCount: number;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}

const COPY: Record<
  Locale,
  {
    generating: string;
    generate: string;
    images: string;
    hint: string;
  }
> = {
  en: {
    generating: "Generating...",
    generate: "Generate Excel",
    images: "images",
    hint: "Add images above, then drag each one into its labeled workspace slot.",
  },
  vi: {
    generating: "Đang tạo...",
    generate: "Tạo file Excel",
    images: "hình",
    hint: "Thêm hình ở trên, sau đó kéo từng hình vào đúng ô đã đặt tên.",
  },
};

export default function GenerateButton({
  locale,
  matchCount,
  disabled,
  loading,
  onClick,
}: Props) {
  const copy = COPY[locale];

  return (
    <div className="generate">
      <button
        className="generate__btn"
        disabled={disabled || loading}
        onClick={onClick}
      >
        {loading ? (
          <>
            <span className="generate__spinner" />
            {copy.generating}
          </>
        ) : (
          <>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            {copy.generate}
            {disabled ? "" : ` (${matchCount} ${copy.images})`}
          </>
        )}
      </button>
      {matchCount === 0 && disabled && (
        <p className="generate__hint">{copy.hint}</p>
      )}
    </div>
  );
}
