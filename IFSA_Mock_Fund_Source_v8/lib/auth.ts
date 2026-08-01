import { cookies } from "next/headers";
import { getD1 } from "../db";
import { hashPassword, randomToken, sha256, verifyPassword } from "./crypto";

export const SESSION_COOKIE = "ifsa_session";
const SESSION_DAYS = 30;

export type AppUser = {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "member";
  status: "active" | "disabled";
};

type UserRow = AppUser & { passwordHash: string; passwordSalt: string };

export async function bootstrapAdminIfNeeded(username: string, password: string) {
  const db = getD1();
  const count = await db.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
  if (Number(count?.count ?? 0) > 0) return;

  const runtime = (globalThis as typeof globalThis & {
    __IFSA_RUNTIME_ENV__?: { BOOTSTRAP_ADMIN_USERNAME?: string; BOOTSTRAP_ADMIN_PASSWORD?: string };
  }).__IFSA_RUNTIME_ENV__;
  const expectedUsername = runtime?.BOOTSTRAP_ADMIN_USERNAME || "admin";
  const expectedPassword = runtime?.BOOTSTRAP_ADMIN_PASSWORD;
  if (!expectedPassword || username !== expectedUsername || password !== expectedPassword) return;

  const now = Date.now();
  const credentials = await hashPassword(password);
  const created = await db
    .prepare(
      `INSERT INTO users (username, display_name, password_hash, password_salt, role, status, created_at)
       VALUES (?, ?, ?, ?, 'admin', 'active', ?) RETURNING id`,
    )
    .bind(username, "IFSA Fund Administrator", credentials.hash, credentials.salt, now)
    .first<{ id: number }>();
  if (!created) throw new Error("Could not create the administrator account.");

  await db.batch([
    db.prepare(
      `INSERT INTO portfolios (owner_user_id, name, kind, cash, net_contributions, created_at)
       VALUES (?, 'IFSA SVC Flagship Fund', 'flagship', 1000000, 1000000, ?)`,
    ).bind(created.id, now),
    db.prepare(
      `INSERT INTO cash_ledger (portfolio_id, amount, action, reason, created_by, occurred_at, created_at)
       SELECT id, 1000000, 'DEPOSIT', 'Opening flagship corpus', ?, ?, ? FROM portfolios WHERE owner_user_id = ?`,
    ).bind(created.id, now, now, created.id),
  ]);
}

export async function authenticate(username: string, password: string) {
  await bootstrapAdminIfNeeded(username, password);
  const row = await getD1()
    .prepare(
      `SELECT id, username, display_name AS displayName, password_hash AS passwordHash,
              password_salt AS passwordSalt, role, status
       FROM users WHERE username = ? LIMIT 1`,
    )
    .bind(username)
    .first<UserRow>();
  if (!row || row.status !== "active") return null;
  return (await verifyPassword(password, row.passwordSalt, row.passwordHash)) ? row : null;
}

export async function createSession(userId: number) {
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const now = Date.now();
  const expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await getD1()
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(tokenHash, userId, expiresAt, now)
    .run();
  return { token, expiresAt };
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const runtime = (globalThis as typeof globalThis & {
    __IFSA_RUNTIME_ENV__?: { PREVIEW_BYPASS_AUTH?: string; BOOTSTRAP_ADMIN_USERNAME?: string; BOOTSTRAP_ADMIN_PASSWORD?: string };
  }).__IFSA_RUNTIME_ENV__;
  if (runtime?.PREVIEW_BYPASS_AUTH === "1" && runtime.BOOTSTRAP_ADMIN_PASSWORD) {
    const username = runtime.BOOTSTRAP_ADMIN_USERNAME || "admin";
    await bootstrapAdminIfNeeded(username, runtime.BOOTSTRAP_ADMIN_PASSWORD);
    const previewUser = await getD1().prepare(
      `SELECT id, username, display_name AS displayName, role, status FROM users
       WHERE username = ? AND status = 'active' LIMIT 1`,
    ).bind(username).first<AppUser>();
    if (previewUser) return previewUser;
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = await sha256(token);
  const user = await getD1()
    .prepare(
      `SELECT u.id, u.username, u.display_name AS displayName, u.role, u.status
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active' LIMIT 1`,
    )
    .bind(tokenHash, Date.now())
    .first<AppUser>();
  return user ?? null;
}

export async function destroyCurrentSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    await getD1().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

export async function createMemberAccount(input: {
  username: string;
  displayName: string;
  password: string;
  capital: number;
}) {
  const admin = await requireAdmin();
  const now = Date.now();
  const credentials = await hashPassword(input.password);
  const db = getD1();
  const created = await db
    .prepare(
      `INSERT INTO users (username, display_name, password_hash, password_salt, role, status, created_at)
       VALUES (?, ?, ?, ?, 'member', 'active', ?) RETURNING id`,
    )
    .bind(input.username, input.displayName, credentials.hash, credentials.salt, now)
    .first<{ id: number }>();
  if (!created) throw new Error("Could not create member account.");
  await db.batch([
    db.prepare(
      `INSERT INTO portfolios (owner_user_id, name, kind, cash, net_contributions, created_at)
       VALUES (?, ?, 'member', ?, ?, ?)`,
    ).bind(created.id, `${input.displayName}'s Portfolio`, input.capital, input.capital, now),
    db.prepare(
      `INSERT INTO cash_ledger (portfolio_id, amount, action, reason, created_by, occurred_at, created_at)
       SELECT id, ?, 'DEPOSIT', 'Opening virtual capital', ?, ?, ? FROM portfolios WHERE owner_user_id = ?`,
    ).bind(input.capital, admin.id, now, now, created.id),
  ]);
  return created.id;
}
