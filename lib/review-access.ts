import { getFamilyActor } from "@/lib/family-access";

export async function reviewerIdentity() {
  const actor = await getFamilyActor();
  return actor && (actor.isOwner || actor.role === "genealogy") ? actor.userId : null;
}
