import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";

/**
 * Password + session handling.
 *
 * Passwords are never stored. We store a PBKDF2-SHA256 hash with a random salt
 * (100,000 iterations), which is the standard slow-hash approach for web apps.
 * Session tokens live in an httpOnly cookie; the database stores only a SHA-256
 * hash of the token, so a database leak cannot be used to log in.
 */

const SESSION_COOKIE = "bm_session";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(derived)}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 10_000) return false;
  const salt = fromBase64(parts[2]);
  const expected = parts[3];
  const derived = await pbkdf2(password, salt, iterations);
  return timingSafeEqual(toBase64(derived), expected);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/*
 * FOUNDER EMAILS — the co-founders' addresses, comma separated, in one place
 * (`FOUNDER_EMAILS` in the environment). An account that signs up with one of
 * these addresses is marked as a founder automatically, so there is no SQL step
 * and no manual flag to forget. The list lives on the server and is never sent
 * to the browser.
 */
export function founderEmails(): string[] {
  return (process.env.FOUNDER_EMAILS ?? "")
    .split(/[,\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.includes("@"));
}

export function isFounderEmail(email: string): boolean {
  return founderEmails().includes(email.trim().toLowerCase());
}

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  isPlatformAdmin: boolean;
};

export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const db = await getDb();
  await db.run(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    [crypto.randomUUID(), userId, tokenHash, expiresAt.toISOString(), new Date().toISOString()],
  );

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.run("DELETE FROM sessions WHERE token_hash = ?", [await sha256Hex(token)]);
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Memoised for the length of one request.
 *
 * The dashboard layout and the page inside it both ask who is signed in, and
 * every database round trip to D1 costs real milliseconds. `cache` makes the
 * second ask free without ever sharing the answer between two people's requests.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = await getDb();
  const row = await db.first<{
    id: string;
    email: string;
    full_name: string;
    is_platform_admin: number;
    expires_at: string;
  }>(
    `SELECT u.id, u.email, u.full_name, u.is_platform_admin, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
    [await sha256Hex(token)],
  );

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    isPlatformAdmin: Boolean(row.is_platform_admin),
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
