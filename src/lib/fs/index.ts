// Server-side entry. The Node FS adapter is the only impl bundled here;
// the Tauri/Capacitor entry points live alongside but are not imported
// in this scaffold. We do NOT use the "server-only" package — the FS
// modules use node:fs APIs, which would fail to bundle into a client
// component anyway.

import "./node-adapter"; // side-effect: registers the Node FS adapter

export { fs, type FsAdapter, type DirEntry, type FileStat } from "./adapter";
