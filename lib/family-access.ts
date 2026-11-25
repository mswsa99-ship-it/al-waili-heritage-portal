import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/app/session-auth";
import { getDb } from "@/db";
import { genealogyRecords, members } from "@/db/schema";

// Owner bootstrap: the owner email must be configured via the OWNER_EMAIL
// environment variable (a Workers secret). No address is trusted by default.
function ownerEmail(): string | null {
  const value = (env as Record<string, string | undefined>).OWNER_EMAIL;
  return value ? value.trim().toLowerCase() : null;
}

export type FamilyActor = { userId: string; email: string; role: string; name: string; branch: string; isOwner: boolean; personId: string | null };

export async function getFamilyActor(): Promise<FamilyActor | null> {
  const identity = await getSessionUser();
  if (!identity) return null;
  const owner = ownerEmail();
  if (owner && identity.email.toLowerCase() === owner) return {
    userId: identity.userId, email: identity.email, role: "central", name: identity.displayName,
    branch: "", isOwner: true, personId: null,
  };
  const match = (await getDb().select().from(members).where(eq(members.userId, identity.userId)).limit(1))[0];
  if (!match || match.status !== "active" || match.minor || !match.personRef) return null;
  // Defense in depth: a membership bound to a tree-add (mailbox-unverified)
  // account confers no family access until real mailbox verification exists.
  const prov = await (env as unknown as { DB: { prepare: (s: string) => { bind: (v: string) => { first: <T>() => Promise<T | null> } } } }).DB
    .prepare("SELECT provenance FROM auth_accounts WHERE email=?").bind(identity.email.toLowerCase()).first<{ provenance: string }>();
  if (prov && prov.provenance === "tree_add_unverified") return null;
  const person = (await getDb().select().from(genealogyRecords).where(eq(genealogyRecords.personId, match.personRef)).limit(1))[0];
  if (!person?.active || !person.living || person.minor) return null;
  return { userId: identity.userId, email: identity.email, role: match.role, name: match.name, branch: match.branch, isOwner: false, personId: person.personId };
}

export function isCommittee(actor: FamilyActor) { return actor.role === "genealogy"; }
export function isCentral(actor: FamilyActor) { return actor.role === "central"; }
export function isBranch(actor: FamilyActor) { return actor.role === "branch"; }
