"use client";

import { useMemo, useState } from "react";
import { useLibraryStore } from "@/state/library-store";
import { computeDiagnostics } from "@/lib/lumen/diagnostics";
import { fmtCount } from "@/lib/lumen/data";
import { IconChevD } from "./icons";

export function DiagnosticsPanel() {
  const items = useLibraryStore((s) => s.items);
  const exact = useLibraryStore((s) => s.duplicatesExact);
  const near = useLibraryStore((s) => s.duplicatesNear);
  const diag = useMemo(() => computeDiagnostics(items, exact, near), [items, exact, near]);
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  const rows = [
    ["Files indexed", fmtCount(diag.totalFiles), `${fmtCount(diag.totalImages)} images · ${fmtCount(diag.totalVideos)} videos`],
    ["SHA-256 hashed", fmtCount(diag.hashed), diag.exactDupGroups > 0 ? `${diag.exactDupGroups} exact-dup group(s) · ${diag.exactDupFiles} files` : "0 byte-identical groups (your files are unique)"],
    ["Perceptual hash (dHash)", fmtCount(diag.withDhash), diag.nearDupGroups > 0 ? `${diag.nearDupGroups} near-dup cluster(s) · ${diag.nearDupFiles} files` : "0 near-duplicates detected"],
    ["Quality scored", fmtCount(diag.withQuality), `${diag.blurryCount} flagged as least-sharp (bottom 5%) · ${diag.darkCount} darkest (bottom 5%) · ${diag.brightCount} brightest (top 2%)`],
    ["Filename heuristics", `${diag.pathMatches.screenshots + diag.pathMatches.whatsapp + diag.pathMatches.transactional} matched`,
      [
        `${diag.pathMatches.screenshots} screenshot(s)`,
        `${diag.pathMatches.whatsapp} WhatsApp/messenger`,
        `${diag.pathMatches.transactional} doc/receipt/transactional`,
      ].join(" · "),
    ],
    ["AI embeddings (CLIP)", diag.ai.embedded > 0 ? fmtCount(diag.ai.embedded) : "0",
      diag.ai.embedded > 0 ? "Semantic search enabled" : "Click \"Enable AI analysis\" to compute"],
    ["Faces (face-api)", diag.ai.totalFaces > 0 ? fmtCount(diag.ai.totalFaces) : "0",
      diag.ai.withFaces > 0 ? `${diag.ai.withFaces} photo(s) contain at least one face` : "Run AI analysis to detect faces"],
  ] as const;

  return (
    <div style={{
      border: "0.5px solid var(--border-soft)",
      background: "var(--bg-2)",
      borderRadius: 12,
      marginBottom: 28,
      overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", background: "transparent", border: "0", cursor: "default",
          color: "var(--text)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.02em" }}>SCAN DIAGNOSTICS</span>
          <span style={{ fontSize: 13.5 }}>
            {fmtCount(diag.totalFiles)} files · {diag.exactDupGroups + diag.nearDupGroups} dup groups · {diag.ai.embedded > 0 ? `AI ✓` : "AI off"}
          </span>
        </div>
        <IconChevD size={14} style={{ transform: open ? "" : "rotate(-90deg)", transition: "transform .15s", color: "var(--muted)" }} />
      </button>
      {open && (
        <div style={{ borderTop: "0.5px solid var(--border-soft)" }}>
          {rows.map(([label, value, detail], i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "200px 100px 1fr", gap: 16,
              padding: "10px 18px", fontSize: 12.5,
              borderBottom: i < rows.length - 1 ? "0.5px solid var(--border-soft)" : "0",
            }}>
              <span style={{ color: "var(--secondary)" }}>{label}</span>
              <span style={{ color: "var(--text)", fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
              <span style={{ color: "var(--muted)" }}>{detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
