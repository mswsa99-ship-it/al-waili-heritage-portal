import handler from "vinext/server/fetch-handler";
import { DurableObject } from "cloudflare:workers";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

// The framework wrapper cannot return a 101 response, so the socket handshake is answered here, before it. The session check is the
// app's own /api/tree-link route (same member gate), called with only the caller's cookie; the socket is opened only if that returns 200.
async function liveSocket(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>, url: URL): Promise<Response> {
  const deny = (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json", "cache-control": "private, no-store" } });
  if (request.method !== "GET" || request.headers.get("upgrade")?.toLowerCase() !== "websocket") return deny("اتصال مباشر فقط", 426);
  const origin = request.headers.get("origin");
  try { if (!origin || new URL(origin).host !== url.host) return deny("مصدر غير مصرح", 403); } catch { return deny("مصدر غير مصرح", 403); }
  const cookie = request.headers.get("cookie");
  if (!cookie) return deny("الدخول بعضوية مفعلة مطلوب", 403);
  const probe = await handler.fetch(new Request(url.origin + "/api/tree-link", { headers: { cookie } }), env, ctx);
  if (probe.status !== 200) return deny("الدخول بعضوية مفعلة مطلوب", 403);
  const ns = (env as { TREE_HUB?: DurableObjectNamespace }).TREE_HUB;
  if (!ns) return deny("القناة المباشرة غير مفعلة", 503);
  return ns.get(ns.idFromName("tree")).fetch(new Request("https://hub/ws", { headers: { Upgrade: "websocket" } }));
}

const worker = {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, async () => {
      const url = new URL(request.url);
      if (url.pathname === "/api/tree-link/live") return liveSocket(request, env, ctx, url);
      return handler.fetch(request, env, ctx);
    });
  },
};

export default worker;

// Fan-out hub for the live primary-tree link. It holds only open sockets, stores nothing, and relays one tiny
// message {changed:true} (no data, no numbers). It is reachable only through the worker's own routes:
// /ws after the session check in /api/tree-link/live, and /broadcast from server code after a save.
const DEFAULT_SOCKET_MS = 30 * 60 * 1000;
export class TreeHub extends DurableObject {
  async fetch(req: Request): Promise<Response> {
    const path = new URL(req.url).pathname;
    if (path === "/broadcast" && req.method === "POST") {
      const body = await req.text();
      const now = Date.now();
      for (const ws of this.ctx.getWebSockets()) {
        const att = ws.deserializeAttachment() as { exp?: number } | null;
        if (!att?.exp || att.exp < now) { try { ws.close(1000, "renew"); } catch {} continue; }
        try { ws.send(body); } catch {}
      }
      return new Response("ok");
    }
    if (path === "/ws" && req.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const ms = Number((this.env as { TREE_SOCKET_MAX_MS?: string }).TREE_SOCKET_MAX_MS) || DEFAULT_SOCKET_MS;
      server.serializeAttachment({ exp: Date.now() + ms });
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("not found", { status: 404 });
  }
  webSocketMessage(): void {}
  webSocketClose(ws: WebSocket): void { try { ws.close(); } catch {} }
}
