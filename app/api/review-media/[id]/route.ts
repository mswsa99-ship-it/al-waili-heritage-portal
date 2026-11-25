import { NextRequest, NextResponse } from "next/server";
import { reviewerIdentity } from "@/lib/review-access";
import photo1 from "@/private/tree-assets/photo-1.jpg?inline";
import photo2 from "@/private/tree-assets/photo-2.jpg?inline";
import photo3 from "@/private/tree-assets/photo-3.jpg?inline";

export const dynamic = "force-dynamic";
const photos: Record<string, string> = { "1": photo1, "2": photo2, "3": photo3 };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await reviewerIdentity()) return NextResponse.json({ error: "صور توثيق النسب للمراجعين المخولين فقط" }, { status: 403 });
  const { id } = await params;
  const source = photos[id];
  if (!source?.startsWith("data:image/jpeg;base64,")) return NextResponse.json({ error: "الصورة غير موجودة" }, { status: 404 });
  const binary = atob(source.slice(source.indexOf(",") + 1));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new NextResponse(bytes.buffer as ArrayBuffer, { headers: {
    "Content-Type": "image/jpeg",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
