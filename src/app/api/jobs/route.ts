import { NextResponse } from "next/server";
import { queueStats, listJobs } from "@/lib/queue/queue";

export async function GET() {
  return NextResponse.json({
    stats: queueStats(),
    recent: listJobs({ limit: 50 }),
  });
}
