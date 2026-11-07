import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "./db";

const SESSION_COOKIE = "oshi_session";
const SESSION_DAYS = 7;

export type CurrentUser = {
  id: number;
  username: string;
};

type UserRow = {
  id: number;
  username: string;
  password_hash: string;
};

// パスワードは scrypt でハッシュ化して保存する（形式: salt:hash）
function hashSecret(value: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(value, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifySecret(value: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(value, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

// ユーザーが存在しないときも同じ計算をして、応答時間の差からユーザーIDの有無を推測されないようにする
const DUMMY_HASH = hashSecret("dummy-password");

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createUser(username: string, password: string) {
  const db = getDb();
  try {
    db.prepare(
      "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)"
    ).run(username, hashSecret(password), Date.now());
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return false;
    }
    throw error;
  }
}

export function authenticate(username: string, password: string) {
  const row = getDb()
    .prepare("SELECT id, username, password_hash FROM users WHERE username = ?")
    .get(username) as UserRow | undefined;

  const passwordOk = verifySecret(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !passwordOk) return null;

  return { id: row.id, username: row.username } satisfies CurrentUser;
}

export async function startSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;

  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
    hashToken(token),
    userId,
    expiresAt
  );

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function endSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  }
  cookieStore.delete(SESSION_COOKIE);
}

// ログイン中のユーザーを返す。未ログインなら /login へ移動する
export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUserOrNull();
  if (!user) redirect("/login");
  return user;
}

export async function getCurrentUserOrNull(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  // 有効期限の判定に現在時刻を使うので、リクエスト時に実行する
  await connection();
  const user = getDb()
    .prepare(
      `SELECT users.id, users.username FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`
    )
    .get(hashToken(token), Date.now()) as CurrentUser | undefined;
  return user ? { id: user.id, username: user.username } : null;
}
