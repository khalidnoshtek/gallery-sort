import { NextResponse } from "next/server";
import { undo } from "@/lib/safe-ops";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await undo(id);
  return NextResponse.json(result);
}
