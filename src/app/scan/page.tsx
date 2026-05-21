"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IS_DEMO } from "@/lib/demo/data";
import { DemoBanner } from "@/components/layout/demo-banner";

export default function ScanPage() {
  const router = useRouter();
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (IS_DEMO) {
      setErr("This is the demo — scanning a real folder requires running the app locally. See README.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined, rootPath: path }),
      });
      if (!res.ok) throw new Error(`(${res.status}) ${await res.text()}`);
      router.push("/");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <DemoBanner />
      <h1 className="text-2xl font-semibold">Add a library</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Point at a folder on your SSD, external drive, or local disk. The scan reads only; no files are moved.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Folder path (absolute)">
          <input
            type="text"
            required
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/Volumes/SSD/Photos"
            className="w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>
        <Field label="Library name (optional)">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My SSD"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>
        {err && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
        <button
          type="submit"
          disabled={busy || !path}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Queuing…" : "Start scan"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
