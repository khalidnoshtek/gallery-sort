"use client";

import { useState } from "react";
import { formatBytes } from "@/lib/utils";

interface Group {
  id: string;
  kind: string;
  memberCount: number;
  totalBytes: string;
  bestMediaId: string | null;
}

interface Member {
  groupId: string;
  mediaId: string;
  score: number;
  reason: string | null;
  filename: string;
  path: string;
  sizeBytes: string;
  thumbId: string | null;
}

export function DuplicateGroupView({ group, members }: { group: Group; members: Member[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    const s = new Set<string>();
    members.forEach((m) => {
      if (m.mediaId !== group.bestMediaId) s.add(m.mediaId);
    });
    return s;
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function trash(confirm: boolean) {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: { kind: "TRASH", mediaIds: [...selected], reason: `Duplicate group ${group.id}` },
          confirm,
        }),
      });
      const data = await res.json();
      if (!confirm) {
        setResult(`Dry-run: ${data.plan.ops.length} file(s), ${formatBytes(BigInt(data.plan.totalBytes))} to trash`);
      } else if (data.executed) {
        setResult(`Trashed ${data.result.succeeded} · failed ${data.result.failed}. Undo from History.`);
      }
    } catch (err) {
      setResult(`Error: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{group.kind} · {group.memberCount} files</div>
          <div className="text-sm font-medium">{formatBytes(BigInt(group.totalBytes))} total · {selected.size} selected to trash</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => trash(false)}
            disabled={busy || selected.size === 0}
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
          >
            Dry-run
          </button>
          <button
            onClick={() => trash(true)}
            disabled={busy || selected.size === 0}
            className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
          >
            Move {selected.size} to Trash
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {members.map((m) => {
          const isBest = m.mediaId === group.bestMediaId;
          const isSel = selected.has(m.mediaId);
          return (
            <div key={m.mediaId} className="space-y-1">
              <button
                onClick={() => toggle(m.mediaId)}
                className={`relative block aspect-square w-full overflow-hidden rounded-md border bg-secondary/40 transition ${isSel ? "border-destructive ring-1 ring-destructive/40" : "border-transparent"}`}
              >
                {m.thumbId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/media/${m.mediaId}/thumbnail`} alt={m.filename} className="size-full object-cover" loading="lazy" />
                ) : (
                  <div className="grid size-full place-items-center text-xs text-muted-foreground">{m.filename}</div>
                )}
                {isBest && (
                  <span className="absolute left-1 top-1 rounded bg-emerald-500/90 px-1 py-0.5 text-[9px] font-medium uppercase text-black">
                    keep
                  </span>
                )}
                {isSel && (
                  <span className="absolute right-1 top-1 rounded bg-destructive px-1 py-0.5 text-[9px] font-medium uppercase text-destructive-foreground">
                    trash
                  </span>
                )}
              </button>
              <div className="truncate text-[10px] text-muted-foreground" title={m.path}>{m.filename}</div>
              <div className="text-[10px] text-muted-foreground">{formatBytes(BigInt(m.sizeBytes))}{m.reason ? ` · ${m.reason}` : ""}</div>
            </div>
          );
        })}
      </div>
      {result && <div className="border-t bg-secondary/40 px-4 py-2 text-xs">{result}</div>}
    </div>
  );
}
