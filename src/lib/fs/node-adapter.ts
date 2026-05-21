import { promises as fsp, createReadStream } from "node:fs";
import path from "node:path";
import { setFsAdapter, type FsAdapter, type DirEntry, type FileStat } from "./adapter";

const nodeAdapter: FsAdapter = {
  async readDir(p) {
    const entries = await fsp.readdir(p, { withFileTypes: true });
    const out: DirEntry[] = [];
    for (const e of entries) {
      out.push({
        name: e.name,
        path: path.join(p, e.name),
        isDirectory: e.isDirectory(),
        isFile: e.isFile(),
        isSymbolicLink: e.isSymbolicLink(),
      });
    }
    return out;
  },
  async stat(p) {
    const s = await fsp.stat(p);
    const stat: FileStat = {
      size: s.size,
      mtime: s.mtime,
      ctime: s.ctime,
      birthtime: s.birthtime,
      inode: s.ino,
      isFile: s.isFile(),
      isDirectory: s.isDirectory(),
    };
    return stat;
  },
  async readFile(p) {
    return fsp.readFile(p);
  },
  readFileStream(p) {
    return createReadStream(p);
  },
  async exists(p) {
    try {
      await fsp.access(p);
      return true;
    } catch {
      return false;
    }
  },
};

setFsAdapter(nodeAdapter);
export { nodeAdapter };
