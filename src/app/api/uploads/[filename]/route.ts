import fs from "node:fs/promises";
import path from "node:path";
import { connection, NextResponse } from "next/server";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> }
) {
  await connection();
  const { filename } = await context.params;
  const cleanName = path.basename(filename);
  if (!cleanName || cleanName !== filename || cleanName.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const uploadsDir = path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    "data",
    "uploads"
  );
  const fullPath = path.join(/*turbopackIgnore: true*/ uploadsDir, cleanName);

  try {
    const data = await fs.readFile(/*turbopackIgnore: true*/ fullPath);
    const ext = path.extname(cleanName).toLowerCase();
    const contentType = MIME_BY_EXT[ext] || "application/octet-stream";

    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
