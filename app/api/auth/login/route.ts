import { NextRequest, NextResponse } from "next/server";
import { query, sameOrigin, sha256 } from "@/lib/site-db";
import { verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, SESSION_DAYS } from "@/app/session-auth";

export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return reply({ error: "مصدر غير مصرح" }, 403);
  const raw = await req.text();
  if (raw.length > 4000) return reply({ error: "طلب طويل" }, 413);
  try {
    const b = JSON.parse(raw);
    const email = String(b.email || "").trim().toLowerCase();
    const password = String(b.password || "");
    if (!email || !email.includes("@") || !password) return reply({ error: "بيانات الدخول غير صحيحة" }, 401);
    const account = await query(
      "SELECT email, password_hash FROM auth_accounts WHERE email = ?",
      email,
    ).first<{ email: string; password_hash: string }>();
    if (!account || !(await verifyPassword(password, account.password_hash))) {
      return reply({ error: "بيانات الدخول غير صحيحة" }, 401);
    }
    const token = crypto.randomUUID() + crypto.randomUUID();
    const time = new Date().toISOString();
    const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
    await query(
      "INSERT INTO auth_sessions(id, email, created_at, expires_at) VALUES(?,?,?,?)",
      await sha256(token), email, time, expires,
    ).run();
    const res = reply({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true, secure: true, sameSite: "lax", path: "/",
      expires: new Date(expires),
    });
    return res;
  } catch {
    return reply({ error: "تعارض أو طلب غير صالح" }, 409);
  }
}
