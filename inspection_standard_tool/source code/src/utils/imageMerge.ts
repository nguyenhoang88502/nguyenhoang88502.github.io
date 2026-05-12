async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function mergeImagesHorizontally(
  files: File[],
  outputName: string
): Promise<File> {
  const images = await Promise.all(files.map(loadImage));
  const targetHeight = Math.max(...images.map((image) => image.naturalHeight));
  const widths = images.map((image) =>
    Math.round((image.naturalWidth / image.naturalHeight) * targetHeight)
  );
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);

  const canvas = document.createElement("canvas");
  canvas.width = totalWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas rendering is not available");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let left = 0;
  images.forEach((image, index) => {
    ctx.drawImage(image, left, 0, widths[index], targetHeight);
    left += widths[index];
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Failed to merge images"));
    }, "image/png");
  });

  return new File([blob], `${outputName}.png`, { type: "image/png" });
}
