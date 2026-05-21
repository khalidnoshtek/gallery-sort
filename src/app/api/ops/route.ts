import { NextResponse } from "next/server";
import { z } from "zod";
import { plan, execute, type Intent } from "@/lib/safe-ops";

const Body = z.object({
  intent: z.union([
    z.object({ kind: z.literal("TRASH"), mediaIds: z.array(z.string()), reason: z.string() }),
    z.object({ kind: z.literal("RENAME"), renames: z.array(z.object({ mediaId: z.string(), newName: z.string() })) }),
  ]),
  confirm: z.boolean().optional(),
});

export async function POST(req: Request) {
  const body = Body.parse(await req.json());
  const planned = await plan(body.intent as Intent);
  if (!body.confirm) {
    return NextResponse.json({ plan: serializePlan(planned), executed: false });
  }
  const result = await execute(planned);
  return NextResponse.json({ plan: serializePlan(planned), executed: true, result });
}

function serializePlan(p: Awaited<ReturnType<typeof plan>>) {
  return {
    ...p,
    totalBytes: p.totalBytes.toString(),
    ops: p.ops.map((o) => ({ ...o, sizeBytes: o.sizeBytes.toString() })),
  };
}
