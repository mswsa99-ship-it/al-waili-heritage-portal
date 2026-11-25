import { NextRequest, NextResponse } from "next/server";
import { query, sameOrigin, sha256, siteDb } from "@/lib/site-db";
import { hashPassword, passwordPolicyError } from "@/lib/password";

export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return reply({ error: "مصدر غير مصرح" }, 403);
  const raw = await req.text();
  if (raw.length > 4000) return reply({ error: "طلب طويل" }, 413);
  try {
    const b = JSON.parse(raw);
    const time = new Date().toISOString();
    const policyError = passwordPolicyError(b.password);
    if (policyError) return reply({ error: policyError }, 400);
    const tokenHash = await sha256(String(b.token || ""));
    const invite = await query(
      "SELECT id, email, expires_at, consumed_at FROM password_reset_tokens WHERE token_hash = ?",
      tokenHash,
    ).first<{ id: string; email: string; expires_at: string; consumed_at: string | null }>();
    if (!invite || invite.consumed_at || invite.expires_at < time) {
      return reply({ error: "الرابط غير صالح أو انتهت صلاحيته؛ اطلب رابطًا جديدًا" }, 403);
    }
    const account = await query("SELECT email FROM auth_accounts WHERE email = ?", invite.email).first();
    if (!account) return reply({ error: "لا يوجد حساب لهذا البريد" }, 409);
    await siteDb().batch([
      query("UPDATE auth_accounts SET password_hash = ?, updated_at = ? WHERE email = ?",
        await hashPassword(String(b.password)), time, invite.email),
      query("UPDATE password_reset_tokens SET consumed_at = ? WHERE id = ?", time, invite.id),
      query("DELETE FROM auth_sessions WHERE email = ?", invite.email),
    ]);
    return reply({ ok: true, message: "عُيّنت كلمة المرور الجديدة. سجّل الدخول الآن." });
  } catch {
    return reply({ error: "تعارض أو طلب غير صالح" }, 409);
  }
}
