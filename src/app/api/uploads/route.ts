import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

function getUploadsDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), "data", "uploads");
}

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No image file provided." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported image format. Upload JPG, PNG, WebP, GIF, or SVG." },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Image exceeds the 8 MB limit." },
        { status: 400 }
      );
    }

    const ext =
      path
        .extname(file.name)
        .toLowerCase()
        .replace(/[^.a-z0-9]/g, "") || ".jpg";
    const safeName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    const uploadsDir = getUploadsDir();
    await fs.mkdir(/*turbopackIgnore: true*/ uploadsDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(
      /*turbopackIgnore: true*/ path.join(uploadsDir, safeName),
      buffer
    );

    return NextResponse.json({
      ok: true,
      filename: safeName,
      url: `/api/uploads/${safeName}`,
    });
  } catch (err) {
    console.error("[api/uploads] Upload error:", err);
    return NextResponse.json(
      { error: "Failed to store uploaded image." },
      { status: 500 }
    );
  }
}
