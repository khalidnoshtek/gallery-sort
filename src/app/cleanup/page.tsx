import Link from "next/link";
import { formatBytes } from "@/lib/utils";
import { DemoBanner } from "@/components/layout/demo-banner";
import { IS_DEMO, demoCleanupSignals } from "@/lib/demo/data";

export const dynamic = "force-dynamic";

function loadCleanupSignals() {
  if (IS_DEMO) {
    const d = demoCleanupSignals();
    return {
      exact: { groups: d.exact.groups, bytes: BigInt(d.exact.bytes) },
      near: { groups: d.near.groups, bytes: BigInt(d.near.bytes) },
      screenshots: { n: d.screenshots.n, bytes: BigInt(d.screenshots.bytes) },
      whatsapp: { n: d.whatsapp.n, bytes: BigInt(d.whatsapp.bytes) },
      transactional: { n: d.transactional.n, bytes: BigInt(d.transactional.bytes) },
      blurry: { n: d.blurry.n, bytes: BigInt(d.blurry.bytes) },
    };
  }
  const { rawDb } = require("@/lib/db/raw") as typeof import("@/lib/db/raw");
  const db = rawDb();
  const get = <T,>(sql: string, ...params: unknown[]) => db.prepare(sql).get(...params) as T;
  return {
    exact: get<{ groups: number; bytes: bigint }>(`SELECT COUNT(*) as groups, COALESCE(SUM(totalBytes), 0) as bytes FROM DuplicateGroup WHERE kind = 'EXACT'`),
    near: get<{ groups: number; bytes: bigint }>(`SELECT COUNT(*) as groups, COALESCE(SUM(totalBytes), 0) as bytes FROM DuplicateGroup WHERE kind = 'NEAR'`),
    screenshots: get<{ n: number; bytes: bigint }>(`SELECT COUNT(*) as n, COALESCE(SUM(sizeBytes), 0) as bytes FROM MediaItem WHERE isHidden = 0 AND category = 'SCREENSHOT'`),
    whatsapp: get<{ n: number; bytes: bigint }>(`SELECT COUNT(*) as n, COALESCE(SUM(sizeBytes), 0) as bytes FROM MediaItem WHERE isHidden = 0 AND category = 'WHATSAPP_FORWARD'`),
    transactional: get<{ n: number; bytes: bigint }>(`SELECT COUNT(*) as n, COALESCE(SUM(sizeBytes), 0) as bytes FROM MediaItem WHERE isHidden = 0 AND (category IN ('TRANSACTIONAL', 'RECEIPT', 'DOCUMENT') OR intent = 'EPHEMERAL')`),
    blurry: get<{ n: number; bytes: bigint }>(`SELECT COUNT(*) as n, COALESCE(SUM(sizeBytes), 0) as bytes FROM MediaItem mi JOIN MediaQuality q ON q.mediaId = mi.id WHERE mi.isHidden = 0 AND q.isBlurry = 1`),
  };
}

export default function CleanupPage() {
  let signals;
  try {
    signals = loadCleanupSignals();
  } catch {
    signals = null;
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <DemoBanner />
      <h1 className="text-2xl font-semibold">Cleanup</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Storage hotspots. Nothing here will happen automatically — every recommendation gets a dry-run preview first.
      </p>

      {!signals ? (
        <div className="mt-10 rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          Scan a library first to see cleanup recommendations.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Tile title="Exact duplicates" count={signals.exact.groups} bytes={signals.exact.bytes} href="/duplicates" hint="Byte-identical copies. Safest cleanup category." severity="high" />
          <Tile title="Near duplicates (resizes, recompresses)" count={signals.near.groups} bytes={signals.near.bytes} href="/duplicates?kind=NEAR" hint="Resized, recompressed, or near-identical." severity="med" />
          <Tile title="Transactional / ephemeral" count={signals.transactional.n} bytes={signals.transactional.bytes} href="/library?filter=transactional" hint="Receipts, QR codes, parking spots, documents — likely keep-for-now." severity="med" />
          <Tile title="Screenshots" count={signals.screenshots.n} bytes={signals.screenshots.bytes} href="/library?filter=screenshot" hint="Often older than the thing they referenced." severity="low" />
          <Tile title="WhatsApp / messenger forwards" count={signals.whatsapp.n} bytes={signals.whatsapp.bytes} href="/library?filter=whatsapp" hint="Compressed copies, usually not yours." severity="med" />
          <Tile title="Blurry / unusable" count={signals.blurry.n} bytes={signals.blurry.bytes} href="/library?filter=blurry" hint="Detected by Laplacian-variance scoring (Phase 1)." severity="low" />
        </div>
      )}
    </div>
  );
}

function Tile({ title, count, bytes, hint, href, severity }: { title: string; count: number; bytes: bigint; hint: string; href: string; severity: "high" | "med" | "low" }) {
  const dot = severity === "high" ? "bg-amber-400" : severity === "med" ? "bg-amber-300" : "bg-zinc-400";
  return (
    <Link href={href} className="rounded-xl border bg-card p-5 transition hover:bg-accent/40">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span className={`size-1.5 rounded-full ${dot}`} />
        {title}
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-2xl font-semibold">{count.toLocaleString()}</span>
        <span className="text-sm text-muted-foreground">{formatBytes(bytes)}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Link>
  );
}
