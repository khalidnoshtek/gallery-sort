import { NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw";
import { aiHealth } from "@/lib/ai/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  try {
    rawDb().prepare("SELECT 1").get();
    checks.db = { ok: true };
  } catch (err) {
    checks.db = { ok: false, detail: String(err) };
  }

  const ai = await aiHealth();
  checks.ai = ai.ok ? { ok: true } : { ok: false, detail: "sidecar unreachable" };

  const ok = checks.db.ok;
  return NextResponse.json(
    { ok, version: process.env.npm_package_version ?? "0.1.0", checks },
    { status: ok ? 200 : 503 },
  );
}
