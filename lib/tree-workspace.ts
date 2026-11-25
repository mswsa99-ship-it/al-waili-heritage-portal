import source from "@/private/tree-data.json";
import { workingTreePeople } from "@/db/schema";

export type WorkingPerson = typeof workingTreePeople.$inferSelect;
export type ProfileFields = Pick<WorkingPerson, "name" | "gender" | "birthYear" | "deathYear" | "education" | "city" | "profession" | "phone" | "email" | "position">;
export const PROFILE_LABELS = {
  name: "الاسم", gender: "الجنس", birthYear: "سنة الميلاد", deathYear: "سنة الوفاة",
  education: "التعليم", city: "المدينة", profession: "المهنة",
  phone: "الجوال", email: "البريد الإلكتروني", position: "المهمة أو المنصب",
} as const;

export const safeText = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const year = (value: unknown) => {
  const raw = safeText(value, 8);
  if (!raw) return "";
  if (!/^\d{4}$/.test(raw) || Number(raw) < 1200 || Number(raw) > new Date().getUTCFullYear() + 1) throw new Error("السنة يجب أن تكون أربع خانات صحيحة؛ اتركها فارغة إن لم تكن معروفة.");
  return raw;
};
export function parseProfileFields(body: Record<string, unknown>): ProfileFields {
  const name = safeText(body.name, 180), gender = safeText(body.gender, 8);
  if (name.length < 2 || !["male", "female"].includes(gender)) throw new Error("الاسم والجنس (ذكر أو أنثى) حقول أساسية.");
  const birthYear = year(body.birthYear), deathYear = year(body.deathYear);
  if (birthYear && deathYear && Number(deathYear) < Number(birthYear)) throw new Error("لا يمكن أن تسبق سنة الوفاة سنة الميلاد.");
  const phone = safeText(body.phone, 28), email = safeText(body.email, 160);
  if (phone && !/^\+?[\d\s-]{8,25}$/.test(phone)) throw new Error("رقم الجوال غير صالح؛ يمكنك تركه فارغًا.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("البريد الإلكتروني غير صالح؛ يمكنك تركه فارغًا.");
  return { name, gender, birthYear, deathYear,
    education: safeText(body.education, 250), city: safeText(body.city, 120),
    profession: safeText(body.profession, 160), phone, email,
    position: safeText(body.position, 180),
  };
}

export function isDescendantOrSelf(personId: string, rootId: string, byId: Map<string, Pick<WorkingPerson, "parentId">>): boolean {
  const seen = new Set<string>();
  let current: string | null = personId;
  while (current && !seen.has(current)) {
    if (current === rootId) return true;
    seen.add(current);
    current = byId.get(current)?.parentId || null;
  }
  return false;
}

export function importBaselineRows(time: string) {
  return source.map(node => ({
    id: node.id, parentId: node.parent || null, name: node.name, gender: "male" as const,
    birthYear: "", deathYear: "", education: "", city: "", profession: "", phone: "", email: "", position: "",
    sourceNote: "اسم من نسخة الهيكل المؤرخة 2005؛ حقول البيانات تنتظر استكمال وتحقق الفروع.",
    originalZone: node.zone || "", active: true, revision: 1, createdAt: time, updatedAt: time,
  }));
}

export const baselineCount = source.length;
