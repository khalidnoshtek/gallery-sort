// File System Access API — types that aren't always in lib.dom.d.ts yet.

declare global {
  interface Window {
    showDirectoryPicker?: (opts?: {
      mode?: "read" | "readwrite";
      id?: string;
      startIn?: "desktop" | "documents" | "downloads" | "pictures" | "music" | "videos" | FileSystemHandle;
    }) => Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemHandle {
    queryPermission?(opts?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
    requestPermission?(opts?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
  }
}

export {};
