// Filesystem adapter — the ONE abstraction that lets the same business logic
// run under Node (dev/server), Tauri (desktop), and Capacitor (Android).
//
// All non-destructive reads go through here. Destructive writes go through
// src/lib/safe-ops/ (which itself imports a destructive subset of this adapter).

export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymbolicLink: boolean;
}

export interface FileStat {
  size: number;
  mtime: Date;
  ctime: Date;
  birthtime: Date;
  inode?: number;
  isFile: boolean;
  isDirectory: boolean;
}

export interface FsAdapter {
  readDir(p: string): Promise<DirEntry[]>;
  stat(p: string): Promise<FileStat>;
  readFile(p: string): Promise<Buffer>;
  readFileStream(p: string): NodeJS.ReadableStream;
  exists(p: string): Promise<boolean>;
}

let _impl: FsAdapter | null = null;

export function setFsAdapter(impl: FsAdapter) {
  _impl = impl;
}

export function fs(): FsAdapter {
  if (!_impl) {
    throw new Error("FsAdapter not initialized. Did you forget to import the bootstrap module?");
  }
  return _impl;
}
