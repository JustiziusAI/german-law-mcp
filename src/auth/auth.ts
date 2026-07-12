import { SignJWT, jwtVerify } from "jose";
import { AppError } from "../errors";
import type { Env } from "../types";

const encoder = new TextEncoder();
const SESSION_TTL = 60 * 60 * 24 * 7;

function base64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
function bytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
async function passwordHash(password: string, salt: Uint8Array<ArrayBufferLike> = crypto.getRandomValues(new Uint8Array(16))): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: 210_000 }, key, 256);
  return `${base64(salt)}:${base64(new Uint8Array(derived))}`;
}
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltText, digestText] = stored.split(":");
  if (!saltText || !digestText) return false;
  const candidate = await passwordHash(password, bytes(saltText));
  const candidateBytes = bytes(candidate.split(":")[1]);
  const storedBytes = bytes(digestText);
  if (candidateBytes.length !== storedBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < candidateBytes.length; index += 1) difference |= candidateBytes[index] ^ storedBytes[index];
  return difference === 0;
}
function secret(env: Env) {
  if (!env.AUTH_SECRET) throw new AppError("Authentication is not configured on this deployment.", 503, "auth_not_configured");
  return encoder.encode(env.AUTH_SECRET);
}

export async function register(env: Env, email: string, password: string, inviteCode?: string) {
  if (env.REGISTRATION_OPEN !== "true" && (!env.INVITE_CODE || inviteCode !== env.INVITE_CODE)) {
    throw new AppError("Registration is invitation-only.", 403, "registration_closed");
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new AppError("Provide a valid email address.", 400, "invalid_email");
  if (password.length < 12) throw new AppError("Password must contain at least 12 characters.", 400, "weak_password");
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)").bind(id, normalizedEmail, await passwordHash(password)).run();
  } catch {
    throw new AppError("This email address is already registered.", 409, "email_exists");
  }
  return createSession(env, { id, email: normalizedEmail });
}

export async function login(env: Env, email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await env.DB.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").bind(normalizedEmail).first<{ id: string; email: string; password_hash: string }>();
  if (!user || !(await verifyPassword(password, user.password_hash))) throw new AppError("Email or password is incorrect.", 401, "invalid_credentials");
  return createSession(env, { id: user.id, email: user.email });
}

async function createSession(env: Env, user: { id: string; email: string }) {
  const token = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(secret(env));
  return { token, user: { id: user.id, email: user.email }, maxAge: SESSION_TTL };
}

export async function currentUser(env: Env, token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(env));
    if (!payload.sub || typeof payload.email !== "string") return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
