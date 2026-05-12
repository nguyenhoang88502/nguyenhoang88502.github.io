import { useMemo, useState } from "react";
import type { TemplateSlot } from "../config";
import type { MatchReport } from "../utils/filenameMatcher";
import "./PreviewTable.css";

interface Props {
  report: MatchReport;
  allPlaceholders: TemplateSlot[];
}

type FilterMode = "all" | "matched" | "unmatched" | "missing";

export default function PreviewTable({ report, allPlaceholders }: Props) {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    return allPlaceholders.map((ph) => {
      const match = report.matched.find((m) => m.placeholder.id === ph.id);
      return {
        placeholder: ph,
        file: match?.file ?? null,
        status: match ? ("matched" as const) : ("missing" as const),
      };
    });
  }, [report, allPlaceholders]);

  const unmatchedRows = useMemo(
    () => report.unmatched.map((f) => ({ filename: f.name, file: f })),
    [report.unmatched]
  );

  const filtered = useMemo(() => {
    switch (filter) {
      case "matched":
        return rows.filter((r) => r.status === "matched");
      case "missing":
        return rows.filter((r) => r.status === "missing");
      default:
        return rows;
    }
  }, [rows, filter]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  if (report.matched.length === 0 && report.unmatched.length === 0) {
    return null;
  }

  const matchedCount = report.matched.length;
  const missingCount = allPlaceholders.length - matchedCount;
  const unmatchedCount = report.unmatched.length;

  return (
    <div className="preview">
      <div className="preview__header">
        <h2 className="preview__title">Preview</h2>
        <div className="preview__tabs">
          {(["all", "matched", "missing", "unmatched"] as FilterMode[]).map(
            (f) => {
              const counts: Record<FilterMode, number> = {
                all: rows.length,
                matched: matchedCount,
                missing: missingCount,
                unmatched: unmatchedCount,
              };
              return (
                <button
                  key={f}
                  className={`preview__tab ${filter === f ? "preview__tab--active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f === "all"
                    ? `All (${counts.all})`
                    : f === "matched"
                      ? `Matched (${counts.matched})`
                      : f === "missing"
                        ? `Missing (${counts.missing})`
                        : `Unmatched (${counts.unmatched})`}
                </button>
              );
            }
          )}
        </div>
      </div>

      {(filter === "all" || filter === "matched" || filter === "missing") && (
        <div className="preview__section">
          <h3 className="preview__section-title">Placeholder Status</h3>
          <div className="preview__grid">
            {filtered.map((row) => (
              <div
                key={row.placeholder.id}
                className={`preview-card preview-card--${row.status}`}
                onClick={() => toggleExpand(row.placeholder.id)}
              >
                <div className="preview-card__thumb">
                  {row.file ? (
                    <img
                      src={URL.createObjectURL(row.file)}
                      alt={row.placeholder.label}
                    />
                  ) : (
                    <div className="preview-card__empty" />
                  )}
                </div>
                <div className="preview-card__info">
                  <span className="preview-card__label">
                    {row.placeholder.label}
                  </span>
                  <span className="preview-card__pos">
                    {row.placeholder.sheet}!{row.placeholder.cell}
                  </span>
                  {row.file && (
                    <span className="preview-card__file">{row.file.name}</span>
                  )}
                  <span
                    className={`preview-card__badge preview-card__badge--${row.status}`}
                  >
                    {row.status === "matched" ? "✓ Ready" : "○ Missing"}
                  </span>
                </div>
                {expanded === row.placeholder.id && row.file && (
                  <div className="preview-card__expand">
                    <p>
                      <strong>Filename:</strong> {row.file.name}
                    </p>
                    <p>
                      <strong>Size:</strong>{" "}
                      {(row.file.size / 1024).toFixed(1)} KB
                    </p>
                    <p>
                      <strong>Target:</strong> {row.placeholder.sheet}!
                      {row.placeholder.cell} (
                      {row.placeholder.range})
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(filter === "all" || filter === "unmatched") &&
        unmatchedRows.length > 0 && (
          <div className="preview__section">
            <h3 className="preview__section-title preview__section-title--warn">
              Unmatched Files ({unmatchedRows.length})
            </h3>
            <ul className="preview__unmatched">
              {unmatchedRows.map((u) => (
                <li key={u.filename}>
                  <span className="preview__unmatched-name">{u.filename}</span>
                  <span className="preview__unmatched-hint">
                    No matching placeholder found
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
    </div>
  );
}
