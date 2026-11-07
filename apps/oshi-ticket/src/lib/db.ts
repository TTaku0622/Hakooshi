import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// ローカル開発用の SQLite。ファイルは git 管理外の .local/ に置く
const DB_DIR = path.join(process.cwd(), ".local");
const DB_PATH = path.join(DB_DIR, "auth.db");

let db: DatabaseSync | null = null;

export function getDb() {
  if (db) return db;

  mkdirSync(DB_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
  `);

  // ログイン用コードをやめる前に作った DB には列が残っているので消す（残すと登録時に NOT NULL で失敗する）
  const columns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (columns.some((column) => column.name === "login_code_hash")) {
    db.exec("ALTER TABLE users DROP COLUMN login_code_hash");
  }
  return db;
}
