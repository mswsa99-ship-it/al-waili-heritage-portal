import {query} from "@/lib/site-db";
// State of the live primary-tree link: the latest tree_link.* audit event; no event means on.
export async function linkEnabled(){
  const r=await query("SELECT action FROM audit_log WHERE action IN ('tree_link.pause','tree_link.resume') ORDER BY created_at DESC, rowid DESC LIMIT 1").first<{action:string}>();
  return !r||r.action==='tree_link.resume';
}
