"use client";

import { useState } from "react";

export function UndoButton({ operationId }: { operationId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function doUndo() {
    if (!confirm("Restore all files in this operation?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ops/${operationId}/undo`, { method: "POST" });
      const data = await res.json();
      setMsg(`Restored ${data.restored} · failed ${data.failed}`);
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setMsg(`Error: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      <button
        onClick={doUndo}
        disabled={busy}
        className="rounded-md border px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
      >
        {busy ? "Restoring…" : "Undo"}
      </button>
    </div>
  );
}
