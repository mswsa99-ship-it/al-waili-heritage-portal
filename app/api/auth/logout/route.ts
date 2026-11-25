import { NextRequest, NextResponse } from "next/server";
import { query, sha256 } from "@/lib/site-db";
import { SESSION_COOKIE } from "@/app/session-auth";

export const dynamic = "force-dynamic";

async function signOut(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await query("DELETE FROM auth_sessions WHERE id = ?", await sha256(token)).run();
  return token ?? null;
}

function cleared(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

export async function POST(req: NextRequest) {
  await signOut(req);
  return cleared(NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } }));
}

export async function GET(req: NextRequest) {
  await signOut(req);
  const returnTo = req.nextUrl.searchParams.get("return_to") || "/";
  const target = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  return cleared(NextResponse.redirect(new URL(target, req.url)));
}
