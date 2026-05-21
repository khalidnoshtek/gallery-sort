// Filesystem-handle registry.
//
// We keep the FileSystemDirectoryHandle of the picked library root + a
// per-item map (itemId → { parentDir, filename }) so that the cleanup
// operations can reach back to the actual file on disk. Lives at module
// scope because handles can't be serialized into Zustand state cleanly.

interface ItemHandle {
  parentDir: FileSystemDirectoryHandle;
  filename: string;
}

const state: {
  rootDir: FileSystemDirectoryHandle | null;
  byId: Map<string, ItemHandle>;
} = {
  rootDir: null,
  byId: new Map(),
};

export const fsHandles = {
  setRoot(root: FileSystemDirectoryHandle) {
    state.rootDir = root;
  },
  getRoot(): FileSystemDirectoryHandle | null {
    return state.rootDir;
  },
  setFile(id: string, parentDir: FileSystemDirectoryHandle, filename: string) {
    state.byId.set(id, { parentDir, filename });
  },
  get(id: string): ItemHandle | undefined {
    return state.byId.get(id);
  },
  hasWriteAccess(): boolean {
    return state.rootDir !== null;
  },
  clear() {
    state.rootDir = null;
    state.byId.clear();
  },
};

export function supportsFsAccess(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}
