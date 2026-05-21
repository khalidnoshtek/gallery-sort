import { formatBytes } from "@/lib/utils";
import { DuplicateGroupView } from "@/components/duplicates/duplicate-group";
import { DemoBanner } from "@/components/layout/demo-banner";
import { IS_DEMO, demoDuplicateGroups } from "@/lib/demo/data";

export const dynamic = "force-dynamic";

interface GroupRow {
  id: string;
  kind: string;
  memberCount: number;
  totalBytes: string;
  bestMediaId: string | null;
  bestPath: string | null;
}

interface MemberRow {
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

function loadGroups(kind: "EXACT" | "NEAR") {
  if (IS_DEMO) {
    const groups = demoDuplicateGroups(kind);
    const flatMembers: MemberRow[] = groups.flatMap((g) =>
      g.members.map((m) => ({
        groupId: g.id,
        mediaId: m.mediaId,
        score: m.score,
        reason: m.reason,
        filename: m.filename,
        path: m.path,
        sizeBytes: m.sizeBytes,
        thumbId: m.thumbSlug,
        thumbSlug: m.thumbSlug,
      })),
    );
    return {
      groups: groups.map<GroupRow>((g) => ({
        id: g.id,
        kind: g.kind,
        memberCount: g.memberCount,
        totalBytes: g.totalBytes,
        bestMediaId: g.bestMediaId,
        bestPath: g.bestPath,
      })),
      members: flatMembers,
    };
  }
  const { rawDb } = require("@/lib/db/raw") as typeof import("@/lib/db/raw");
  const db = rawDb();
  const groups = db
    .prepare(
      `SELECT g.id, g.kind, g.memberCount, g.totalBytes, g.bestMediaId, mi.path AS bestPath
         FROM DuplicateGroup g
         LEFT JOIN MediaItem mi ON mi.id = g.bestMediaId
        WHERE g.kind = ?
        ORDER BY g.totalBytes DESC
        LIMIT 50`
    )
    .all(kind) as Array<{ id: string; kind: string; memberCount: number; totalBytes: bigint; bestMediaId: string | null; bestPath: string | null }>;

  if (groups.length === 0) return { groups: [], members: [] };

  const ids = groups.map((g) => g.id);
  const placeholders = ids.map(() => "?").join(",");
  const members = db
    .prepare(
      `SELECT m.groupId, m.mediaId, m.score, m.reason, mi.filename, mi.path, mi.sizeBytes,
              t.id AS thumbId
         FROM DuplicateMember m
         JOIN MediaItem mi ON mi.id = m.mediaId
         LEFT JOIN MediaThumbnail t ON t.mediaId = mi.id AND t.variant = 'thumb256'
        WHERE m.groupId IN (${placeholders})
        ORDER BY m.score DESC`
    )
    .all(...ids) as Array<{ groupId: string; mediaId: string; score: number; reason: string | null; filename: string; path: string; sizeBytes: bigint; thumbId: string | null }>;

  return {
    groups: groups.map<GroupRow>((g) => ({ ...g, totalBytes: g.totalBytes.toString() })),
    members: members.map<MemberRow>((m) => ({ ...m, sizeBytes: m.sizeBytes.toString() })),
  };
}

export default async function DuplicatesPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const sp = await searchParams;
  const kind: "EXACT" | "NEAR" = sp.kind === "NEAR" ? "NEAR" : "EXACT";

  let data: { groups: GroupRow[]; members: MemberRow[] } = { groups: [], members: [] };
  try {
    data = loadGroups(kind);
  } catch {}

  const totalRecoverable = data.groups.reduce<bigint>((acc, g) => {
    const members = data.members.filter((m) => m.groupId === g.id);
    if (members.length < 2) return acc;
    const best = members.find((m) => m.mediaId === g.bestMediaId) ?? members[0]!;
    const others = members.filter((m) => m.mediaId !== best.mediaId);
    return acc + others.reduce<bigint>((a, m) => a + BigInt(m.sizeBytes), 0n);
  }, 0n);

  return (
    <div className="px-8 py-6">
      <DemoBanner />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Duplicates ({kind === "EXACT" ? "exact" : "near"})</h1>
          <p className="text-sm text-muted-foreground">
            {data.groups.length} groups · up to {formatBytes(totalRecoverable)} recoverable
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <a href="/duplicates" className={`rounded px-3 py-1 ${kind === "EXACT" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>Exact</a>
          <a href="/duplicates?kind=NEAR" className={`rounded px-3 py-1 ${kind === "NEAR" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>Near</a>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {data.groups.length === 0 && (
          <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
            No duplicate groups yet. Run a scan, then trigger duplicate detection from the dashboard.
          </div>
        )}
        {data.groups.map((g) => (
          <DuplicateGroupView
            key={g.id}
            group={g}
            members={data.members.filter((m) => m.groupId === g.id)}
          />
        ))}
      </div>
    </div>
  );
}
