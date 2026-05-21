"use client";

import { IconTrash } from "./icons";

export function TrashView() {
  return (
    <div className="view">
      <div className="trash-empty">
        <IconTrash size={28} style={{ opacity: 0.3 }} />
        <h2>Trash is empty.</h2>
        <p>When you stage files for deletion they&apos;ll appear here for 30 days. Restore with one click.</p>
      </div>
    </div>
  );
}
