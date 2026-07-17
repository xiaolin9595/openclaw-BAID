import { randomBytes, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { InstanceRouter, MeshNetwork, AgentIdConfig } from "./types.js";
import { verifyAgentIdDiscoveryTicket } from "./agentid.js";
import { createAgentConnectionStore } from "./agent-connection-store.js";
import { localConnectPage } from "./local-connect-page.js";

type Logger = { info?(message: string): void; warn?(message: string): void; error?(message: string): void };

type LocalBridgeOptions = {
  mesh: MeshNetwork;
  router: InstanceRouter;
  config?: AgentIdConfig;
  logger?: Logger;
};

type ConnectionRequest = {
  requestId: string;
  agentId: string;
  status: string;
  label?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

function json(response: ServerResponse, status: number, body: unknown, origin?: string): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("access-control-allow-origin", origin ?? "null");
  response.setHeader("access-control-allow-headers", "content-type, x-openclaw-bridge-token");
  response.setHeader("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  let value = "";
  for await (const chunk of request) {
    value += String(chunk);
    if (value.length > 128 * 1024) throw new Error("request body is too large");
  }
  if (!value) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("request body must be an object");
  return parsed as Record<string, unknown>;
}

function allowedOrigin(request: IncomingMessage, configured?: string[], localPort?: number): string | undefined {
  const origin = typeof request.headers.origin === "string" ? request.headers.origin : undefined;
  const allowed = [...(configured?.length ? configured : ["http://127.0.0.1:4173", "http://localhost:4173"]), ...(localPort ? [`http://127.0.0.1:${localPort}`] : [])];
  return origin && allowed.includes(origin) ? origin : undefined;
}

function html(response: ServerResponse, body: string): void {
  response.statusCode = 200;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(body);
}

function stringValue(body: Record<string, unknown>, key: string, max = 4096): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() && value.length <= max ? value.trim() : undefined;
}

export function createLocalConnectBridge(options: LocalBridgeOptions) {
  const config = options.config ?? {};
  const logger = options.logger;
  const targetStore = createAgentConnectionStore();
  const pairingTokens = new Map<string, number>();
  const requests = new Map<string, ConnectionRequest>();
  let server: Server | undefined;
  let port: number | undefined;

  function tokenFrom(request: IncomingMessage): string | undefined {
    const value = request.headers["x-openclaw-bridge-token"];
    return typeof value === "string" ? value : undefined;
  }

  function requireToken(request: IncomingMessage): boolean {
    const token = tokenFrom(request);
    const expiresAt = token ? pairingTokens.get(token) : undefined;
    if (!expiresAt || expiresAt <= Date.now()) {
      if (token) pairingTokens.delete(token);
      return false;
    }
    return true;
  }

  async function refreshRequest(requestId: string): Promise<ConnectionRequest | undefined> {
    const current = requests.get(requestId);
    if (!current) return undefined;
    const route = await options.router.listInstances();
    const verified = route.some((entry) => entry.agentId === current.agentId && entry.peerId === (current as ConnectionRequest & { peerId?: string }).peerId);
    if (verified && current.status !== "verified") {
      current.status = "verified";
      current.updatedAt = new Date().toISOString();
      await targetStore.upsert({
        agentId: current.agentId,
        label: current.label,
        source: "local-bridge",
        status: "verified",
        peerId: (current as ConnectionRequest & { peerId?: string }).peerId,
        requestedAt: Date.parse(current.createdAt),
        lastVerifiedAt: Date.now(),
      });
    }
    return current;
  }

  async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const origin = allowedOrigin(request, config.localBridge?.allowedOrigins, port);
    if (request.method === "OPTIONS") return json(response, 204, {}, origin);
    if (request.headers.origin && !origin) return json(response, 403, { error: "origin_not_allowed" });
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port ?? 0}`);

    if (url.pathname === "/" && request.method === "GET") return html(response, localConnectPage());

    if (url.pathname === "/v1/local/discovery" && request.method === "GET") {
      const issuer = config.issuer;
      if (!issuer) return json(response, 503, { error: "agentid_issuer_not_configured" }, origin);
      const query = new URLSearchParams();
      for (const key of ["query", "capability", "tag"]) {
        const value = url.searchParams.get(key)?.trim();
        if (value) query.set(key, value);
      }
      const directoryResponse = await fetch(`${issuer.replace(/\/$/, "")}/v1/public/agents${query.toString() ? `?${query}` : ""}`, { headers: { accept: "application/json" } });
      const directory = await directoryResponse.json().catch(() => ({})) as {
        agents?: Array<{
          agent?: { id?: string; name?: string };
          profile?: {
            summary?: string;
            attributes?: Array<{ key?: string; value?: string }>;
            connection?: { allowDiscovery?: boolean };
          };
        }>;
        error?: { message?: string };
      };
      if (!directoryResponse.ok) return json(response, 502, { error: directory.error?.message ?? `AgentID directory returned HTTP ${directoryResponse.status}.` }, origin);
      const agents = (directory.agents ?? []).map((item) => ({
        agentId: item.agent?.id ?? "",
        name: item.agent?.name ?? "Unnamed Agent",
        summary: item.profile?.summary ?? "",
        capabilities: (item.profile?.attributes ?? []).filter((attribute) => attribute.key === "capability" && typeof attribute.value === "string").map((attribute) => attribute.value),
        connectable: Boolean(item.profile?.connection?.allowDiscovery),
      })).filter((item) => item.agentId && item.connectable);
      logger?.info?.(`[libp2p-mesh] AgentID directory queried results=${agents.length}`);
      return json(response, 200, { agents });
    }

    if (url.pathname === "/v1/local/status" && request.method === "GET") {
      const identity = options.mesh.getInstanceIdentity();
      return json(response, 200, { openclaw: "running", instanceId: identity?.id ?? null, pairingRequired: true, bridgePort: port }, origin);
    }

    if (url.pathname === "/v1/local/pair" && request.method === "POST") {
      const token = randomBytes(24).toString("base64url");
      pairingTokens.set(token, Date.now() + 5 * 60 * 1000);
      logger?.info?.("[libp2p-mesh] Local bridge pairing session issued (token omitted)");
      return json(response, 200, { pairingId: randomUUID(), localSessionToken: token, expiresIn: 300 }, origin);
    }

    if (!requireToken(request)) return json(response, 401, { error: "local_pairing_required" }, origin);

    if ((url.pathname === "/v1/local/connections/import" || url.pathname === "/v1/local/connections/from-directory") && request.method === "POST") {
      try {
        const body = await readBody(request);
        const requestedAgentId = stringValue(body, "agentId", 512);
        let ticket = stringValue(body, "discoveryTicket", 32 * 1024);
        if (!requestedAgentId) return json(response, 400, { error: "agentId_required" }, origin);
        if (!ticket && url.pathname.endsWith("from-directory")) {
          const issuer = config.issuer;
          if (!issuer) return json(response, 503, { error: "agentid_issuer_not_configured" }, origin);
          const ticketResponse = await fetch(`${issuer.replace(/\/$/, "")}/v1/public/agents/${encodeURIComponent(requestedAgentId)}/connection-ticket`, { headers: { accept: "application/json" } });
          const ticketBody = await ticketResponse.json().catch(() => ({})) as { ticket?: string; error?: { message?: string } };
          if (!ticketResponse.ok || !ticketBody.ticket) return json(response, 502, { error: ticketBody.error?.message ?? `Unable to obtain Discovery Ticket (HTTP ${ticketResponse.status}).` }, origin);
          ticket = ticketBody.ticket;
          logger?.info?.(`[libp2p-mesh] AgentID directory returned Discovery Ticket agent=${requestedAgentId}`);
        }
        if (!ticket) return json(response, 400, { error: "discoveryTicket_required" }, origin);
        const verifiedTicket = await verifyAgentIdDiscoveryTicket(ticket, {
          config,
          expected: { agentId: requestedAgentId },
        });
        if (!verifiedTicket.valid) return json(response, 400, { error: "invalid_discovery_ticket", reason: verifiedTicket.reason }, origin);
        logger?.info?.(`[libp2p-mesh] Local bridge verified Discovery Ticket agent=${requestedAgentId} peer=${verifiedTicket.claims.peer_id}`);
        const requestId = randomUUID();
        const now = new Date().toISOString();
        const label = stringValue(body, "label", 120);
        const connection: ConnectionRequest & { peerId?: string } = {
          requestId,
          agentId: requestedAgentId,
          status: "dialing",
          label,
          peerId: verifiedTicket.claims.peer_id,
          createdAt: now,
          updatedAt: now,
        };
        requests.set(requestId, connection);
        await targetStore.upsert({
          agentId: requestedAgentId,
          label,
          source: "local-bridge",
          status: "dialing",
          peerId: verifiedTicket.claims.peer_id,
          multiaddrs: [...verifiedTicket.claims.multiaddrs],
          relayMultiaddrs: [...verifiedTicket.claims.relay_multiaddrs],
          requestedAt: Date.now(),
          lastDialAt: Date.now(),
        });
        const addresses = [...verifiedTicket.claims.multiaddrs, ...verifiedTicket.claims.relay_multiaddrs];
        let dialError: string | undefined;
        for (const address of addresses) {
          try {
            await options.mesh.dial(address);
            dialError = undefined;
            logger?.info?.(`[libp2p-mesh] Local bridge dial succeeded agent=${requestedAgentId} peer=${verifiedTicket.claims.peer_id}`);
            break;
          } catch (error) {
            dialError = error instanceof Error ? error.message : String(error);
          }
        }
        if (dialError) {
          connection.status = "failed";
          connection.error = dialError;
          connection.updatedAt = new Date().toISOString();
          await targetStore.upsert({ agentId: requestedAgentId, label, source: "local-bridge", status: "failed", peerId: verifiedTicket.claims.peer_id, multiaddrs: [...verifiedTicket.claims.multiaddrs], relayMultiaddrs: [...verifiedTicket.claims.relay_multiaddrs], requestedAt: Date.parse(now), lastDialAt: Date.now(), lastError: dialError });
          logger?.warn?.(`[libp2p-mesh] Local bridge dial failed agent=${requestedAgentId} peer=${verifiedTicket.claims.peer_id}`);
          return json(response, 502, { requestId, status: connection.status, error: dialError }, origin);
        }
        return json(response, 202, { requestId, status: connection.status, agentId: requestedAgentId, peerId: verifiedTicket.claims.peer_id }, origin);
      } catch (error) {
        return json(response, 400, { error: error instanceof Error ? error.message : String(error) }, origin);
      }
    }

    const match = url.pathname.match(/^\/v1\/local\/connections\/([^/]+)$/);
    if (match && request.method === "GET") {
      const agentId = decodeURIComponent(match[1]!);
      const target = await targetStore.get(agentId);
      const requestEntry = [...requests.values()].reverse().find((entry) => entry.agentId === agentId);
      if (requestEntry) await refreshRequest(requestEntry.requestId);
      return json(response, 200, { target: await targetStore.get(agentId), request: requestEntry ?? null }, origin);
    }
    if (match && request.method === "DELETE") {
      const agentId = decodeURIComponent(match[1]!);
      const removed = await targetStore.remove(agentId);
      return json(response, 200, { removed, agentId }, origin);
    }
    if (url.pathname === "/v1/local/connections" && request.method === "GET") return json(response, 200, { targets: await targetStore.list() }, origin);
    return json(response, 404, { error: "not_found" }, origin);
  }

  return {
    async start(): Promise<number> {
      if (server) return port!;
      const requestedPort = config.localBridge?.port ?? 8799;
      server = createServer((request, response) => { void handler(request, response).catch((error) => json(response, 500, { error: error instanceof Error ? error.message : String(error) })); });
      await new Promise<void>((resolve, reject) => {
        server!.once("error", reject);
        server!.listen(requestedPort, "127.0.0.1", () => resolve());
      });
      port = requestedPort;
      logger?.info?.(`[libp2p-mesh] Local connection bridge listening on http://127.0.0.1:${port}`);
      return port;
    },
    async stop(): Promise<void> {
      pairingTokens.clear();
      requests.clear();
      if (!server) return;
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
      port = undefined;
    },
    getPort(): number | undefined { return port; },
  };
}
