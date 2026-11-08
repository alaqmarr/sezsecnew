"use client";

import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Crop,
  Link as LinkIcon,
  Maximize2,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from "lucide-react";
import { cn } from "@sezsec/shared";
import { Button } from "./button.component";
import { Input } from "./input.component";
import { IosSpinner } from "./ios-loader.component";
import { notify } from "./toast.helper";

async function uploadBlobFile(fileOrBlob: Blob, filename: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", fileOrBlob, filename);
  const res = await fetch("/api/uploads", {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || "Upload failed");
  }
  return data.url as string;
}

async function renderAspectCanvasBlob(options: {
  src: string;
  aspectRatio: number;
  mode: "fit" | "crop";
  zoom: number;
  panX: number; // -100 to 100
  panY: number; // -100 to 100
}): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not decode image"));
    el.src = options.src;
  });

  const outWidth = 1920;
  const outHeight = Math.round(outWidth / options.aspectRatio);
  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  const imgRatio = img.naturalWidth / img.naturalHeight;

  if (options.mode === "fit") {
    // Draw soft matching backdrop first so non-4:1 images never have harsh bars
    ctx.save();
    const coverScale = Math.max(
      outWidth / img.naturalWidth,
      outHeight / img.naturalHeight
    );
    const bgW = img.naturalWidth * coverScale * 1.08;
    const bgH = img.naturalHeight * coverScale * 1.08;
    ctx.filter = "blur(28px) brightness(0.85)";
    ctx.drawImage(img, (outWidth - bgW) / 2, (outHeight - bgH) / 2, bgW, bgH);
    ctx.restore();

    // Draw 100% of the image completely visible & centered
    const containScale = Math.min(
      outWidth / img.naturalWidth,
      outHeight / img.naturalHeight
    );
    const fgW = img.naturalWidth * containScale;
    const fgH = img.naturalHeight * containScale;
    ctx.drawImage(img, (outWidth - fgW) / 2, (outHeight - fgH) / 2, fgW, fgH);
  } else {
    // Crop & zoom mode
    const baseScale =
      imgRatio > options.aspectRatio
        ? outHeight / img.naturalHeight
        : outWidth / img.naturalWidth;
    const scale = baseScale * options.zoom;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const maxOffsetX = Math.max(0, (drawW - outWidth) / 2);
    const maxOffsetY = Math.max(0, (drawH - outHeight) / 2);
    const offsetX = (options.panX / 100) * maxOffsetX;
    const offsetY = (options.panY / 100) * maxOffsetY;
    const dx = (outWidth - drawW) / 2 - offsetX;
    const dy = (outHeight - drawH) / 2 - offsetY;
    ctx.drawImage(img, dx, dy, drawW, drawH);
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Could not encode banner image"));
        else resolve(blob);
      },
      "image/webp",
      0.92
    );
  });
}

export function ImageUploader({
  label = "Image",
  value,
  onChange,
  aspectRatio,
  hint = "Upload JPG, PNG, WebP (up to 8 MB) or paste an image URL",
}: {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  aspectRatio?: number;
  hint?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Composer state when aspectRatio is specified (e.g. 4:1 for homepage banners)
  const [composerSrc, setComposerSrc] = useState<string | null>(null);
  const [composerFilename, setComposerFilename] = useState("banner.webp");
  const [composerMode, setComposerMode] = useState<"fit" | "crop">("fit");
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";

    if (aspectRatio) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const probe = new Image();
        probe.onload = () => {
          const ratio = probe.naturalWidth / probe.naturalHeight;
          // Default to crop if close to target ratio, otherwise fit so 100% stays visible by default
          setComposerMode(Math.abs(ratio - aspectRatio) < 0.25 ? "crop" : "fit");
          setZoom(1);
          setPanX(0);
          setPanY(0);
          setComposerFilename(
            file.name.replace(/\.[^.]+$/, "") + ".webp"
          );
          setComposerSrc(dataUrl);
        };
        probe.src = dataUrl;
      };
      reader.readAsDataURL(file);
      return;
    }

    setUploading(true);
    try {
      const url = await uploadBlobFile(file, file.name);
      onChange(url);
      notify.success("Image uploaded");
    } catch (err) {
      notify.error(
        "Upload failed",
        err instanceof Error ? err.message : "Could not upload image"
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirmComposer() {
    if (!composerSrc || !aspectRatio) return;
    setUploading(true);
    try {
      const blob = await renderAspectCanvasBlob({
        src: composerSrc,
        aspectRatio,
        mode: composerMode,
        zoom,
        panX,
        panY,
      });
      const url = await uploadBlobFile(blob, composerFilename);
      onChange(url);
      setComposerSrc(null);
      notify.success("Banner framed & uploaded");
    } catch (err) {
      notify.error(
        "Upload failed",
        err instanceof Error ? err.message : "Could not process image"
      );
    } finally {
      setUploading(false);
    }
  }

  const isBannerRatio = aspectRatio === 4;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-[#3D2E2A]">
          {label}
        </span>
        <button
          type="button"
          onClick={() => setShowUrlInput((s) => !s)}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#6A1B1B] hover:underline cursor-pointer"
        >
          <LinkIcon className="h-3 w-3" />
          {showUrlInput ? "Hide URL field" : "Paste URL instead"}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {value ? (
        <div className="overflow-hidden rounded-xl border border-[#DCD2C2] bg-[#FAF7F2]">
          <div
            className={cn(
              "relative w-full overflow-hidden bg-[#F3EFE6]",
              isBannerRatio ? "aspect-[4/1]" : "aspect-[16/7]"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Uploaded preview"
              className={cn(
                "h-full w-full",
                isBannerRatio ? "object-contain" : "object-cover"
              )}
            />
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-[#EAE2D6] px-3.5 py-2">
            <span className="truncate text-xs text-[#7B6B63]">{value}</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                size="xs"
                variant="secondary"
                loading={uploading}
                onClick={() => fileRef.current?.click()}
              >
                Replace
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => onChange("")}
                icon={<Trash2 className="h-3.5 w-3.5 text-[#991B1B]" />}
              />
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#C9BBA6] bg-[#FAF7F2] px-4 py-7 text-center transition-colors hover:border-[#6A1B1B] hover:bg-[#FBF6EB] cursor-pointer"
        >
          {uploading ? (
            <div className="flex items-center gap-2 text-sm font-medium text-[#6A1B1B]">
              <IosSpinner size="md" tone="maroon" />
              <span>Uploading image to server…</span>
            </div>
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D9C398] bg-white text-[#6A1B1B]">
                <Upload className="h-4 w-4" />
              </div>
              <div className="text-sm font-semibold text-[#231917]">
                Click to select an image file
              </div>
              <p className="text-xs text-[#7B6B63]">{hint}</p>
            </>
          )}
        </button>
      )}

      {showUrlInput ? (
        <Input
          placeholder="https://example.com/banner.jpg or /api/uploads/..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}

      {/* Aspect-Ratio Framing Modal (4:1 Banner Consistency Across All Devices) */}
      {composerSrc && aspectRatio && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
              <div
                onClick={() => {
                  if (!uploading) setComposerSrc(null);
                }}
                className="fixed inset-0 bg-[#231917]/75 backdrop-blur-xs"
              />
              <div className="relative z-10 flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#D9C398] bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#EAE2D6] px-5 py-3.5">
                  <div>
                    <h3 className="font-editorial text-xl font-bold text-[#231917]">
                      Adjust 4:1 Banner Composition
                    </h3>
                    <p className="text-xs text-[#6B5B53]">
                      What you see inside this 4:1 frame stays 100% visible on
                      every mobile, tablet, and desktop screen.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => setComposerSrc(null)}
                    className="rounded-lg p-1.5 text-[#5E4F4A] hover:bg-[#F3EFE6] cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 p-5">
                  {/* Mode Switcher */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setComposerMode("fit")}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer",
                        composerMode === "fit"
                          ? "border-[#6A1B1B] bg-[#6A1B1B] text-[#FAF7F2]"
                          : "border-[#DCD2C2] bg-[#FAF7F2] text-[#3D2E2A]"
                      )}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span>Fit Entire Artwork (Zero Cropping)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposerMode("crop")}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer",
                        composerMode === "crop"
                          ? "border-[#6A1B1B] bg-[#6A1B1B] text-[#FAF7F2]"
                          : "border-[#DCD2C2] bg-[#FAF7F2] text-[#3D2E2A]"
                      )}
                    >
                      <Crop className="h-3.5 w-3.5" />
                      <span>Fill &amp; Crop to 4:1</span>
                    </button>
                  </div>

                  {/* Live Exact 4:1 Preview */}
                  <div className="relative aspect-[4/1] w-full overflow-hidden rounded-xl border-2 border-[#B8924A] bg-[#231917]">
                    {composerMode === "fit" ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={composerSrc}
                          alt=""
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover opacity-40 blur-xl"
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={composerSrc}
                          alt="Full fit preview"
                          className="relative z-10 h-full w-full object-contain"
                        />
                      </>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={composerSrc}
                        alt="Crop preview"
                        style={{
                          objectPosition: `${50 + panX / 2}% ${50 + panY / 2}%`,
                          transform: `scale(${zoom})`,
                        }}
                        className="h-full w-full object-cover transition-transform duration-75"
                      />
                    )}
                  </div>

                  {composerMode === "crop" ? (
                    <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] p-3.5 sm:grid-cols-3">
                      <label className="space-y-1 text-xs font-medium text-[#4E3F3A]">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <ZoomIn className="h-3.5 w-3.5 text-[#6A1B1B]" />
                          Zoom ({zoom.toFixed(2)}x)
                        </span>
                        <input
                          type="range"
                          min={1}
                          max={2.5}
                          step={0.05}
                          value={zoom}
                          onChange={(e) => setZoom(Number(e.target.value))}
                          className="w-full accent-[#6A1B1B]"
                        />
                      </label>
                      <label className="space-y-1 text-xs font-medium text-[#4E3F3A]">
                        <span className="font-semibold">
                          Horizontal Offset ({panX}%)
                        </span>
                        <input
                          type="range"
                          min={-100}
                          max={100}
                          step={2}
                          value={panX}
                          onChange={(e) => setPanX(Number(e.target.value))}
                          className="w-full accent-[#6A1B1B]"
                        />
                      </label>
                      <label className="space-y-1 text-xs font-medium text-[#4E3F3A]">
                        <span className="font-semibold">
                          Vertical Offset ({panY}%)
                        </span>
                        <input
                          type="range"
                          min={-100}
                          max={100}
                          step={2}
                          value={panY}
                          onChange={(e) => setPanY(Number(e.target.value))}
                          className="w-full accent-[#6A1B1B]"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-end gap-2.5 border-t border-[#EAE2D6] bg-[#FAF7F2] px-5 py-3.5">
                  <Button
                    variant="secondary"
                    disabled={uploading}
                    onClick={() => setComposerSrc(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    loading={uploading}
                    icon={<Check className="h-4 w-4" />}
                    onClick={handleConfirmComposer}
                  >
                    Save 4:1 Banner
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
