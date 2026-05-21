"use client";

import { useState } from "react";
import { formatBytes } from "@/lib/utils";
import { IS_DEMO, BASE_PATH } from "@/lib/demo/data";

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
  thumbSlug?: string;
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
  const [trashedIds, setTrashedIds] = useState<Set<string>>(new Set());

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
      if (IS_DEMO) {
        await new Promise((r) => setTimeout(r, 350));
        const total = members
          .filter((m) => selected.has(m.mediaId))
          .reduce<bigint>((a, m) => a + BigInt(m.sizeBytes), 0n);
        if (!confirm) {
          setResult(`Dry-run: ${selected.size} file(s), ${formatBytes(total)} would move to Trash.`);
        } else {
          setTrashedIds(new Set(selected));
          setResult(`Trashed ${selected.size} file(s) · ${formatBytes(total)} recovered. Undo from History.`);
        }
      } else {
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
          const isTrashed = trashedIds.has(m.mediaId);
          const src = IS_DEMO
            ? (m.thumbSlug ? `${BASE_PATH}/demo/thumbs/${m.thumbSlug}.webp` : null)
            : (m.thumbId ? `/api/media/${m.mediaId}/thumbnail` : null);
          return (
            <div key={m.mediaId} className="space-y-1">
              <button
                onClick={() => !isTrashed && toggle(m.mediaId)}
                disabled={isTrashed}
                className={`relative block aspect-square w-full overflow-hidden rounded-md border bg-secondary/40 transition ${isSel && !isTrashed ? "border-destructive ring-1 ring-destructive/40" : "border-transparent"} ${isTrashed ? "opacity-30" : ""}`}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={m.filename} className="size-full object-cover" loading="lazy" />
                ) : (
                  <div className="grid size-full place-items-center text-xs text-muted-foreground">{m.filename}</div>
                )}
                {isBest && !isTrashed && (
                  <span className="absolute left-1 top-1 rounded bg-emerald-500/90 px-1 py-0.5 text-[9px] font-medium uppercase text-black">
                    keep
                  </span>
                )}
                {isSel && !isTrashed && (
                  <span className="absolute right-1 top-1 rounded bg-destructive px-1 py-0.5 text-[9px] font-medium uppercase text-destructive-foreground">
                    trash
                  </span>
                )}
                {isTrashed && (
                  <span className="absolute inset-x-1 top-1 rounded bg-zinc-700 px-1 py-0.5 text-center text-[9px] font-medium uppercase text-zinc-200">
                    in trash
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
