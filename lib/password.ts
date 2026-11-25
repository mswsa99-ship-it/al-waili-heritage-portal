// Password hashing for the family portal: PBKDF2-SHA256 over WebCrypto,
// native to the Workers runtime (no native bcrypt/argon2 available).
const ITERATIONS = 100000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]),
    KEY_BYTES * 8,
  );
  return `pbkdf2:${ITERATIONS}:${hex(salt.buffer as ArrayBuffer)}:${hex(key)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 100000) return false;
  const salt = Uint8Array.from(parts[2].match(/../g) ?? [], (h) => parseInt(h, 16));
  if (salt.length !== SALT_BYTES) return false;
  const key = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]),
    KEY_BYTES * 8,
  );
  const expected = parts[3];
  const actual = hex(key);
  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return diff === 0;
}

export function passwordPolicyError(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 8) return "كلمة المرور ٨ أحرف على الأقل";
  if (password.length > 200) return "كلمة المرور طويلة جدًا";
  return null;
}
