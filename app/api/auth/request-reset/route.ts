import { NextRequest, NextResponse } from "next/server";
import { query, sameOrigin, sha256 } from "@/lib/site-db";
import { sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

// Always answers the same way whether or not the address has an account,
// so the endpoint does not reveal which emails are registered.
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return reply({ error: "مصدر غير مصرح" }, 403);
  const raw = await req.text();
  if (raw.length > 2000) return reply({ error: "طلب طويل" }, 413);
  try {
    const b = JSON.parse(raw);
    const email = String(b.email || "").trim().toLowerCase();
    const done = { ok: true, message: "إن كان البريد مسجلًا لدينا فستصله رسالة استعادة خلال دقائق." };
    if (!email || !email.includes("@")) return reply(done);
    const account = await query("SELECT email FROM auth_accounts WHERE email = ?", email).first();
    if (!account) return reply(done);
    const token = crypto.randomUUID() + crypto.randomUUID();
    const time = new Date().toISOString();
    await query(
      "INSERT INTO password_reset_tokens(id, email, token_hash, expires_at, created_at) VALUES(?,?,?,?,?)",
      crypto.randomUUID(), email, await sha256(token),
      new Date(Date.now() + 3600000).toISOString(), time,
    ).run();
    const link = `${req.nextUrl.origin}/reset?token=${encodeURIComponent(token)}`;
    await sendMail({
      to: email,
      subject: "استعادة كلمة المرور - بوابة الوايلي",
      text: `طلبت استعادة كلمة المرور لحسابك في بوابة الوايلي.\n\nافتح هذا الرابط خلال ساعة واحدة لتعيين كلمة مرور جديدة:\n${link}\n\nإن لم تطلب ذلك فتجاهل هذه الرسالة.`,
    });
    return reply(done);
  } catch {
    return reply({ error: "تعارض أو طلب غير صالح" }, 409);
  }
}
