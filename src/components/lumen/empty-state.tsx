"use client";

import { IconFolder, IconKeep } from "./icons";

export function EmptyState({ onScan }: { onScan: () => void }) {
  return (
    <div className="view" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 64 }}>
      <div style={{ maxWidth: 520, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "rgba(255,255,255,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text)",
          }}
        >
          <IconFolder size={26} />
        </div>
        <div>
          <h2 style={{ fontFamily: "var(--display)", fontSize: 32, fontWeight: 300, letterSpacing: "-0.03em", margin: 0, lineHeight: 1.1 }}>
            Open a folder to begin
          </h2>
          <p style={{ color: "var(--secondary)", fontSize: 14, lineHeight: 1.55, marginTop: 14, letterSpacing: "-0.005em" }}>
            Lumen reads every image locally — finds duplicates, groups by date, sorts screenshots and
            messenger files. Nothing leaves your machine.
          </p>
        </div>
        <button className="btn primary" onClick={onScan} style={{ padding: "12px 22px" }}>
          <IconFolder size={14} /> Choose a folder
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 12, letterSpacing: "-0.005em" }}>
          <IconKeep size={13} style={{ color: "var(--good)" }} />
          <span>Read-only · zero uploads · open DevTools → Network to verify</span>
        </div>
      </div>
    </div>
  );
}
