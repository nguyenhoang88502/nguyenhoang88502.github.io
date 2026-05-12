import { getTemplateSlots, type TemplateSlot } from "../config";
import type { Locale } from "../i18n";

const COPY: Record<
  Locale,
  {
    sectionTitles: Record<TemplateSlot["section"], string>;
    toggle: string;
    addStrong: string;
    addText: string;
    assignStrong: string;
    assignTextBefore: string;
    assignTextAfter: string;
    combinedStrong: string;
    combinedTextBefore: string;
    combinedTextAfter: string;
    generateStrong: string;
    generateText: string;
    templateKey: string;
    sourceAssets: string;
    cellRegion: string;
    processing: string;
    merge: string;
    direct: string;
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
    toggle: "How to use this tool",
    addStrong: "Add source images",
    addText:
      " with the upload area, or drop a file directly onto a named asset target.",
    assignStrong: "Assign images",
    assignTextBefore: " to the exact template keys shown in the workspace. Files named like ",
    assignTextAfter: " are auto-assigned when possible.",
    combinedStrong: "Combined keys",
    combinedTextBefore: " such as ",
    combinedTextAfter:
      " accept two source images and are merged side by side before insertion.",
    generateStrong: "Click \"Generate Excel\"",
    generateText:
      " to insert each processed image into the exact key region in the workbook.",
    templateKey: "Template Key",
    sourceAssets: "Source Assets",
    cellRegion: "Cell Region",
    processing: "Processing",
    merge: "Merge before insert",
    direct: "Insert directly",
  },
  vi: {
    sectionTitles: {
      product: "Sản phẩm & phụ kiện",
      packaging: "Hình bao bì",
      marking: "Nhãn & khắc laser",
      folding: "Hướng dẫn gấp",
      sample: "Mẫu gửi khách hàng",
    },
    toggle: "Cách sử dụng công cụ",
    addStrong: "Thêm hình nguồn",
    addText:
      " bằng vùng tải lên, hoặc thả file trực tiếp vào ô tài sản đã đặt tên.",
    assignStrong: "Gán hình",
    assignTextBefore:
      " vào đúng khóa template hiển thị trong workspace. File đặt tên như ",
    assignTextAfter: " sẽ được tự động gán khi có thể.",
    combinedStrong: "Khóa ghép",
    combinedTextBefore: " như ",
    combinedTextAfter:
      " nhận hai hình nguồn và tự động ghép ngang trước khi chèn.",
    generateStrong: "Bấm \"Tạo file Excel\"",
    generateText:
      " để chèn từng hình đã xử lý vào đúng vùng khóa trong workbook.",
    templateKey: "Khóa template",
    sourceAssets: "Hình nguồn",
    cellRegion: "Vùng ô",
    processing: "Xử lý",
    merge: "Ghép trước khi chèn",
    direct: "Chèn trực tiếp",
  },
};

export default function Instructions({ locale }: { locale: Locale }) {
  const templateSlots = getTemplateSlots();
  const copy = COPY[locale];

  return (
    <details className="instructions">
      <summary className="instructions__toggle">{copy.toggle}</summary>
      <div className="instructions__body">
        <ol className="instructions__steps">
          <li>
            <strong>{copy.addStrong}</strong>
            {copy.addText}
          </li>
          <li>
            <strong>{copy.assignStrong}</strong>
            {copy.assignTextBefore}
            <code>ib_safety.jpg</code>
            {copy.assignTextAfter}
          </li>
          <li>
            <strong>{copy.combinedStrong}</strong>
            {copy.combinedTextBefore}
            <code>colorbox_front & colorbox_back</code>
            {copy.combinedTextAfter}
          </li>
          <li>
            <strong>{copy.generateStrong}</strong>
            {copy.generateText}
          </li>
        </ol>

        {(Object.keys(copy.sectionTitles) as TemplateSlot["section"][]).map(
          (section) => {
            const slots = templateSlots.filter(
              (slot) => slot.section === section
            );
            if (slots.length === 0) return null;
            return (
              <SectionTable
                key={section}
                title={copy.sectionTitles[section]}
                placeholders={slots}
                locale={locale}
              />
            );
          }
        )}
      </div>
    </details>
  );
}

function SectionTable({
  title,
  placeholders,
  locale,
}: {
  title: string;
  placeholders: TemplateSlot[];
  locale: Locale;
}) {
  const copy = COPY[locale];

  return (
    <div className="instructions__section">
      <h3 className="instructions__section-title">{title}</h3>
      <table className="instructions__table">
        <thead>
          <tr>
            <th>{copy.templateKey}</th>
            <th>{copy.sourceAssets}</th>
            <th>{copy.cellRegion}</th>
            <th>{copy.processing}</th>
          </tr>
        </thead>
        <tbody>
          {placeholders.map((slot) => (
            <tr key={slot.id}>
              <td>
                <code>{slot.templateKey}</code>
              </td>
              <td>{slot.assetKeys.join(", ")}</td>
              <td>
                <code>
                  {slot.sheet}!{slot.range}
                </code>
              </td>
              <td>{slot.assetKeys.length > 1 ? copy.merge : copy.direct}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
