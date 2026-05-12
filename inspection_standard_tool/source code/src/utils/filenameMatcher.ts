const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);

export interface MatchTarget {
  id: string;
}

export interface MatchResult<T extends MatchTarget = MatchTarget> {
  placeholder: T;
  file: File;
}

export interface MatchReport<T extends MatchTarget = MatchTarget> {
  matched: MatchResult<T>[];
  unmatched: File[];
  missing: T[];
}

function stripExt(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return filename;
  return filename.substring(0, dot);
}

function getExt(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return "";
  return filename.substring(dot + 1).toLowerCase();
}

export function isAllowedFile(file: File): boolean {
  return ALLOWED_EXTENSIONS.has(getExt(file.name));
}

export function matchFiles(
  files: File[],
  placeholders: MatchTarget[]
): MatchReport {
  const placeholderMap = new Map<string, MatchTarget>();
  for (const ph of placeholders) {
    placeholderMap.set(ph.id.toLowerCase(), ph);
  }

  const matched: MatchResult[] = [];
  const unmatched: File[] = [];
  const usedIds = new Set<string>();

  for (const file of files) {
    const baseName = stripExt(file.name).toLowerCase();
    const ph = placeholderMap.get(baseName);
    if (ph) {
      matched.push({ placeholder: ph, file });
      usedIds.add(ph.id);
    } else {
      unmatched.push(file);
    }
  }

  const missing = placeholders.filter((ph) => !usedIds.has(ph.id));

  return { matched, unmatched, missing };
}
