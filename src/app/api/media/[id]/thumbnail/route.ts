import { NextResponse } from "next/server";
import { promises as fsp } from "node:fs";
import { rawDb } from "@/lib/db/raw";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = rawDb();
  const row = db
    .prepare(
      `SELECT t.path, t.format FROM MediaThumbnail t
        WHERE t.mediaId = ? AND t.variant = 'thumb256' LIMIT 1`,
    )
    .get(id) as { path: string; format: string } | undefined;

  if (!row) return new NextResponse("not found", { status: 404 });

  try {
    const buf = await fsp.readFile(row.path);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": row.format === "webp" ? "image/webp" : "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("thumb missing", { status: 410 });
  }
}
