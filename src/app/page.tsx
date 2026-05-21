import { rawDb } from "@/lib/db/raw";
import { formatBytes } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Stats {
  totalItems: number;
  totalBytes: bigint;
  byCategory: Array<{ category: string; n: number; bytes: bigint }>;
  exactDupGroups: number;
  exactDupBytes: bigint;
  nearDupGroups: number;
  unhashed: number;
  unthumbed: number;
  pendingJobs: number;
}

function getStats(): Stats {
  const db = rawDb();
  const total = db.prepare(`SELECT COUNT(*) as n, COALESCE(SUM(sizeBytes), 0) as b FROM MediaItem WHERE isHidden = 0`).get() as { n: number; b: bigint };
  const byCat = db
    .prepare(`SELECT category, COUNT(*) as n, COALESCE(SUM(sizeBytes), 0) as bytes FROM MediaItem WHERE isHidden = 0 GROUP BY category ORDER BY n DESC`)
    .all() as Array<{ category: string; n: number; bytes: bigint }>;
  const exact = db.prepare(`SELECT COUNT(*) as g, COALESCE(SUM(totalBytes), 0) as b FROM DuplicateGroup WHERE kind = 'EXACT'`).get() as { g: number; b: bigint };
  const near = db.prepare(`SELECT COUNT(*) as g FROM DuplicateGroup WHERE kind = 'NEAR'`).get() as { g: number };
  const unhashed = db.prepare(`SELECT COUNT(*) as n FROM MediaItem WHERE isHashed = 0`).get() as { n: number };
  const unthumbed = db.prepare(`SELECT COUNT(*) as n FROM MediaItem WHERE isThumbed = 0`).get() as { n: number };
  const pending = db.prepare(`SELECT COUNT(*) as n FROM Job WHERE status IN ('PENDING','RUNNING')`).get() as { n: number };

  return {
    totalItems: total.n,
    totalBytes: total.b,
    byCategory: byCat,
    exactDupGroups: exact.g,
    exactDupBytes: exact.b,
    nearDupGroups: near.g,
    unhashed: unhashed.n,
    unthumbed: unthumbed.n,
    pendingJobs: pending.n,
  };
}

export default function Dashboard() {
  let stats: Stats | null = null;
  try {
    stats = getStats();
  } catch {
    // DB not initialized yet
  }

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Library overview</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Privacy-first · everything stays on this device.
      </p>

      {!stats || stats.totalItems === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card title="Items" value={stats.totalItems.toLocaleString()} hint={formatBytes(stats.totalBytes)} />
          <Card title="Exact duplicates" value={`${stats.exactDupGroups} groups`} hint={`Up to ${formatBytes(stats.exactDupBytes)} recoverable`} href="/duplicates" />
          <Card title="Near duplicates" value={`${stats.nearDupGroups} clusters`} hint="Similar shots, resizes, recompresses" href="/duplicates?kind=NEAR" />
          <Card title="Pending jobs" value={stats.pendingJobs.toLocaleString()} hint={`${stats.unhashed} unhashed · ${stats.unthumbed} unthumbed`} />

          <div className="md:col-span-2 lg:col-span-4 rounded-xl border bg-card p-6">
            <h2 className="text-sm font-medium text-muted-foreground">By category</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
              {stats.byCategory.map((c) => (
                <div key={c.category} className="rounded-lg bg-secondary/50 p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{prettyCat(c.category)}</div>
                  <div className="mt-1 text-lg font-semibold">{c.n.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{formatBytes(c.bytes)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, value, hint, href }: { title: string; value: string; hint: string; href?: string }) {
  const body = (
    <div className="rounded-xl border bg-card p-5 transition hover:bg-accent/40">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-xl border bg-card p-10 text-center">
      <h2 className="text-xl font-semibold">No library yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Point Gallery Sort at a folder to begin. Scanning runs in the background.
        Nothing is touched on disk without your confirmation.
      </p>
      <Link
        href="/scan"
        className="mt-6 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Add a library
      </Link>
    </div>
  );
}

function prettyCat(c: string): string {
  return c.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}
