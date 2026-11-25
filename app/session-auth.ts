import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query, sha256 } from "@/lib/site-db";

// Portal identity: email + password accounts with database sessions.
// The exported names are kept so existing callers (member pages, admin,
// review, API routes) keep working unchanged; only the identity source
// changed from platform-injected sign-in headers to a session cookie.
export type SessionUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export const SESSION_COOKIE = "awl_session";
export const SESSION_DAYS = 30;

const SIGN_IN_PATH = "/login";
const SIGN_OUT_PATH = "/api/auth/logout";
const CALLBACK_PATH = "/callback";

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const sessionId = await sha256(token);
  const now = new Date().toISOString();
  const session = await query(
    "SELECT email, expires_at FROM auth_sessions WHERE id = ?",
    sessionId,
  ).first<{ email: string; expires_at: string }>();
  if (!session) return null;
  if (session.expires_at < now) {
    await query("DELETE FROM auth_sessions WHERE id = ?", sessionId).run();
    return null;
  }
  const email = session.email;
  return { userId: email, displayName: email, email, fullName: null };
}

export async function requireSessionUser(
  returnTo: string,
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user) return user;

  redirect(sessionSignInPath(returnTo));
}

export function sessionSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function sessionSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}
