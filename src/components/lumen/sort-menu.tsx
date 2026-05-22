"use client";

import { useEffect, useRef, useState } from "react";
import { SORT_OPTIONS, type SortKey } from "@/lib/lumen/sort";
import { IconChevD } from "./icons";

interface Props {
  value: SortKey;
  onChange: (k: SortKey) => void;
}

export function SortMenu({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const current = SORT_OPTIONS.find((s) => s.key === value) ?? SORT_OPTIONS[0]!;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        className="btn-sm ghost"
        style={{ padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <span style={{ color: "var(--muted)", fontSize: 11.5 }}>Sort:</span>
        <span>{current.short}</span>
        <IconChevD size={11} style={{ color: "var(--muted)" }} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 180,
            background: "var(--bg-2)",
            border: "0.5px solid var(--border-soft)",
            borderRadius: 9,
            padding: 4,
            zIndex: 50,
            boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { onChange(opt.key); setOpen(false); }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: opt.key === value ? "var(--active-bg)" : "transparent",
                color: opt.key === value ? "var(--text)" : "var(--secondary)",
                border: 0,
                padding: "8px 12px",
                fontSize: 12.5,
                borderRadius: 6,
                cursor: "default",
                letterSpacing: "-0.005em",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
