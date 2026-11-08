import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@/generated/prisma/client";
import type { SessionTokenPayload } from "./auth.types";

export const SESSION_COOKIE_NAME = "sezsec_member_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getJwtSecret(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "sezsec-member-portal-local-dev-secret-2026";
  return new TextEncoder().encode(secret);
}

export async function signSessionJwt(
  payload: SessionTokenPayload
): Promise<string> {
  return new SignJWT({
    username: payload.username,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifySessionJwt(
  token: string
): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub || !payload.username || !payload.role) {
      return null;
    }
    return {
      sub: String(payload.sub),
      username: String(payload.username),
      role: String(payload.role) as Role,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(
  payload: SessionTokenPayload
): Promise<void> {
  const token = await signSessionJwt(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function readSessionTokenPayload(): Promise<SessionTokenPayload | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  return verifySessionJwt(raw);
}
