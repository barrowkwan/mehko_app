"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MAX_IMAGE_BYTES, MAX_IMAGE_SIDE, fitWithin } from "@/lib/images";

// Re-encodes any picture the browser can decode as a JPEG of at most MAX_IMAGE_SIDE px and MAX_IMAGE_BYTES.
// Drawing onto a canvas drops all metadata (EXIF/GPS location, camera info) and applies the phone's rotation.
// The server verifies and strips again, so this is for size and convenience as well as privacy.
async function toJpeg(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    let { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_IMAGE_SIDE);
    for (const quality of [0.82, 0.7, 0.6, 0.5]) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas unavailable");
      ctx.fillStyle = "#fff"; // flatten transparency (PNG) onto white
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_IMAGE_BYTES) return new File([blob], "photo.jpg", { type: "image/jpeg" });
      ({ width, height } = fitWithin(width, height, Math.round(Math.max(width, height) * 0.8)));
    }
    throw new Error("could not make the picture small enough");
  } finally {
    bitmap.close();
  }
}

// Optional photo field for a food. Posts `image` (the processed JPEG) and, when a photo already exists,
// `remove_image` (checkbox). `currentUrl` is the existing photo's public URL.
export function ImageInput({
  currentUrl,
  alt,
  labels,
}: {
  currentUrl?: string | null;
  alt: string;
  labels?: { photo: string; help: string; remove: string; unsupported: string }; // defaults to the food-photo wording
}) {
  const tFoods = useTranslations("foods");
  const t = (key: "photo" | "photoHelp" | "removePhoto" | "photoUnsupported") =>
    labels ? { photo: labels.photo, photoHelp: labels.help, removePhoto: labels.remove, photoUnsupported: labels.unsupported }[key] : tFoods(key);
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The form is reset after a successful save: forget the preview too.
  useEffect(() => {
    const form = input.current?.form;
    const clear = () => {
      setPreview(null);
      setError(null);
    };
    form?.addEventListener("reset", clear);
    return () => form?.removeEventListener("reset", clear);
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    if (!file) return setPreview(null);
    try {
      const jpeg = await toJpeg(file);
      const dt = new DataTransfer();
      dt.items.add(jpeg);
      e.target.files = dt.files; // what the form will actually submit
      setPreview(URL.createObjectURL(jpeg));
    } catch {
      e.target.value = "";
      setPreview(null);
      setError(t("photoUnsupported"));
    }
  }

  const shown = preview ?? currentUrl ?? null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t("photo")}</span>
      <div className="flex items-center gap-3">
        {shown && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={alt} className="h-16 w-16 rounded object-cover" />
        )}
        <input ref={input} type="file" name="image" accept="image/*" onChange={onChange} className="text-sm" />
      </div>
      <p className="text-xs text-neutral-500">{t("photoHelp")}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {currentUrl && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="remove_image" /> {t("removePhoto")}
        </label>
      )}
    </div>
  );
}
