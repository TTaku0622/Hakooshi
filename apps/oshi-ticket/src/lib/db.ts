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
    CREATE TABLE IF NOT EXISTS gps_journeys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ticket_id INTEGER NOT NULL,
      event TEXT NOT NULL,
      journey_date TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      venue_name TEXT,
      venue_latitude REAL,
      venue_longitude REAL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS gps_journeys_one_active_ticket
      ON gps_journeys(user_id, ticket_id) WHERE ended_at IS NULL;
    CREATE INDEX IF NOT EXISTS gps_journeys_user_started
      ON gps_journeys(user_id, started_at DESC);
    CREATE TABLE IF NOT EXISTS gps_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journey_id INTEGER NOT NULL REFERENCES gps_journeys(id) ON DELETE CASCADE,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL NOT NULL,
      captured_at INTEGER NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('track', 'checkin')),
      verified INTEGER,
      distance_meters REAL
    );
    CREATE INDEX IF NOT EXISTS gps_points_journey_captured
      ON gps_points(journey_id, captured_at);
  `);

  // ログイン用コードをやめる前に作った DB には列が残っているので消す（残すと登録時に NOT NULL で失敗する）
  const columns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (columns.some((column) => column.name === "login_code_hash")) {
    db.exec("ALTER TABLE users DROP COLUMN login_code_hash");
  }
  return db;
}
