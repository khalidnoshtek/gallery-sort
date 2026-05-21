import { NextResponse } from "next/server";
import path from "node:path";
import { promises as fsp } from "node:fs";
import { z } from "zod";
import { rawDb } from "@/lib/db/raw";
import { ensureRunnerStarted } from "@/lib/queue/bootstrap";
import { enqueue } from "@/lib/queue/queue";
import { logger } from "@/lib/logger";

const Body = z.object({
  name: z.string().min(1).optional(),
  rootPath: z.string().min(1),
});

export async function POST(req: Request) {
  ensureRunnerStarted();
  const body = Body.parse(await req.json());
  const abs = path.resolve(body.rootPath);

  try {
    const stat = await fsp.stat(abs);
    if (!stat.isDirectory()) return NextResponse.json({ error: "Path is not a directory" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: `Path inaccessible: ${String(err)}` }, { status: 400 });
  }

  const db = rawDb();
  const existing = db.prepare(`SELECT id FROM Library WHERE rootPath = ?`).get(abs) as { id: string } | undefined;
  const id = existing?.id ?? `lib_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  if (!existing) {
    db.prepare(`INSERT INTO Library (id, name, rootPath, createdAt, isActive) VALUES (?, ?, ?, ?, 1)`).run(
      id,
      body.name ?? path.basename(abs),
      abs,
      new Date().toISOString(),
    );
  }

  const jobId = enqueue("scan.enumerate", { libraryId: id, root: abs }, { priority: 5 });
  logger.info({ libraryId: id, jobId, root: abs }, "scan enqueued");
  return NextResponse.json({ libraryId: id, jobId });
}

export async function GET() {
  const db = rawDb();
  const libs = db.prepare(`SELECT * FROM Library ORDER BY createdAt DESC`).all() as Array<{
    id: string; name: string; rootPath: string; itemCount: number; totalBytes: bigint; lastScanAt: string | null;
  }>;
  return NextResponse.json({
    libraries: libs.map((l) => ({ ...l, totalBytes: l.totalBytes.toString() })),
  });
}
