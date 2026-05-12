export interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
}

export type SlotAssignments = Record<string, string | undefined>;
