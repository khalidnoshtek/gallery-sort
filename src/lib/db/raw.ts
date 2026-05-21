import Database from "better-sqlite3";
import path from "node:path";
import { paths } from "../config";

let _db: Database.Database | null = null;

export function rawDb(): Database.Database {
  if (_db) return _db;

  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const file = url.startsWith("file:") ? url.slice("file:".length) : url;
  // Match Prisma's resolution semantics: file: URLs are relative to schema.prisma's directory.
  const base = path.resolve(process.cwd(), "prisma");
  const abs = path.isAbsolute(file) ? file : path.resolve(base, file);

  const db = new Database(abs);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("temp_store = MEMORY");
  db.pragma("mmap_size = 268435456");
  db.pragma("cache_size = -65536");

  _db = db;
  void paths;
  return db;
}

export function closeRawDb() {
  _db?.close();
  _db = null;
}
