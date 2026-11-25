import { env } from "cloudflare:workers";

type HubNs = { idFromName(n: string): unknown; get(id: unknown): { fetch(r: Request): Promise<Response> } };
export function treeHub(){ const ns=(env as unknown as {TREE_HUB?:HubNs}).TREE_HUB; return ns?ns.get(ns.idFromName("tree")):null; }

// Best-effort push after a primary-tree save, an import or a pause/resume. Never fails the caller. The message carries NO data and
// no numbers: it only says "something changed". Each page then asks the normal gated API, so a socket that outlived its session learns nothing.
export async function notifyTreeChange(){
  try{
    const hub=treeHub(); if(!hub) return;
    await hub.fetch(new Request("https://hub/broadcast",{method:"POST",body:'{"changed":true}'}));
  }catch{}
}
