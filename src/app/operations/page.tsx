import { rawDb } from "@/lib/db/raw";
import { formatBytes } from "@/lib/utils";
import { UndoButton } from "@/components/operations/undo-button";

export const dynamic = "force-dynamic";

interface Op {
  id: string;
  kind: string;
  status: string;
  summary: string;
  itemCount: number;
  bytesAffected: string;
  createdAt: string;
  finishedAt: string | null;
  undoneAt: string | null;
}

function loadOps(limit = 100): Op[] {
  const db = rawDb();
  const rows = db
    .prepare(`SELECT id, kind, status, summary, itemCount, bytesAffected, createdAt, finishedAt, undoneAt FROM Operation ORDER BY createdAt DESC LIMIT ?`)
    .all(limit) as Array<Omit<Op, "bytesAffected"> & { bytesAffected: bigint }>;
  return rows.map((r) => ({ ...r, bytesAffected: r.bytesAffected.toString() }));
}

export default function OperationsPage() {
  let ops: Op[] = [];
  try {
    ops = loadOps();
  } catch {}

  return (
    <div className="mx-auto max-w-5xl px-8 py-6">
      <h1 className="text-2xl font-semibold">Operations history</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every destructive action ever taken. Each one is undoable until the trash is purged.
      </p>

      <div className="mt-8 divide-y rounded-xl border bg-card">
        {ops.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">No operations yet.</div>
        )}
        {ops.map((op) => (
          <div key={op.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="rounded bg-secondary px-1.5 py-0.5">{op.kind}</span>
                <span className={statusClass(op.status)}>{op.status}</span>
                <span className="font-mono">{new Date(op.createdAt).toLocaleString()}</span>
              </div>
              <div className="mt-1 truncate font-medium">{op.summary}</div>
              <div className="text-xs text-muted-foreground">
                {op.itemCount} item(s) · {formatBytes(BigInt(op.bytesAffected))}
              </div>
            </div>
            <div>
              {op.status === "COMPLETED" || op.status === "PARTIAL" ? <UndoButton operationId={op.id} /> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusClass(s: string): string {
  switch (s) {
    case "COMPLETED": return "rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-400";
    case "PARTIAL": return "rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-400";
    case "FAILED": return "rounded bg-destructive/15 px-1.5 py-0.5 text-destructive";
    case "UNDONE": return "rounded bg-secondary px-1.5 py-0.5";
    default: return "rounded bg-secondary px-1.5 py-0.5";
  }
}
