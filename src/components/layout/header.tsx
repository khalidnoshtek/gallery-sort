"use client";

import { useEffect, useState } from "react";
import { IS_DEMO } from "@/lib/demo/data";

export function Header() {
  const [jobs, setJobs] = useState<{ pending: number; running: number } | null>(null);

  useEffect(() => {
    if (IS_DEMO) {
      setJobs({ pending: 0, running: 0 });
      return;
    }
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/jobs");
        if (!res.ok) return;
        const data = await res.json();
        const stats: Array<{ status: string; n: number }> = data.stats;
        if (!alive) return;
        setJobs({
          pending: stats.filter((s) => s.status === "PENDING").reduce((a, s) => a + s.n, 0),
          running: stats.filter((s) => s.status === "RUNNING").reduce((a, s) => a + s.n, 0),
        });
      } catch {}
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
      <div className="text-xs text-muted-foreground">Local · Offline · Private</div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {jobs && (jobs.pending + jobs.running > 0) ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
            {jobs.running} running · {jobs.pending} pending
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Idle
          </span>
        )}
      </div>
    </header>
  );
}
