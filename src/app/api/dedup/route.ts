import { NextResponse } from "next/server";
import { ensureRunnerStarted } from "@/lib/queue/bootstrap";
import { enqueue } from "@/lib/queue/queue";

export async function POST(req: Request) {
  ensureRunnerStarted();
  const body = (await req.json().catch(() => ({}))) as { libraryId?: string };
  const jobId = enqueue("dedup.recompute", { libraryId: body.libraryId }, { priority: 10 });
  return NextResponse.json({ jobId });
}
