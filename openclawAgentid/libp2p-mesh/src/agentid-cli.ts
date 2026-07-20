import type { OpenClawConfig, OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import type { OpenClawPluginCliContext } from "openclaw/plugin-sdk/plugin-runtime";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  getAgentIdIbcMetadata,
  getTrustedAgentIdIssuers,
  isBindingActiveForIdentity,
  linkAgentId,
  refreshAgentIdBinding,
  renewAgentIdBinding,
  loadAgentIdBinding,
  saveAgentIdBinding,
  unlinkAgentIdBinding,
  type AgentIdBindingFile,
  type AgentIdLinkResult,
} from "./agentid.js";
import { loadOrCreateInstanceIdentity } from "./instance-id.js";
import { createUserProfileStore } from "./user-profile-store.js";
import { applyAgentIdConfig, getLibp2pMeshConfig, type OpenClawConfigLike } from "./setup-config.js";
import type { AgentIdConfig, InstanceIdentity } from "./types.js";

const AGENTID_CLI_AFTER_WRITE = {
  mode: "none",
  reason: "libp2p-mesh AgentID trust config updated; restart manually to apply gateway changes.",
} as const;

type AgentIdLinkCommandOptions = {
  agent?: string;
  createAgent?: boolean;
  issuer?: string;
  json?: boolean;
  query?: string;
  capability?: string;
  tag?: string;
  bridge?: string;
  wait?: boolean;
};

type AgentIdCommand = {
  command(name: string): AgentIdCommand;
  description(text: string): AgentIdCommand;
  option(flags: string, description: string): AgentIdCommand;
  action(handler: (options: AgentIdLinkCommandOptions) => Promise<void>): void;
};

export type AgentIdRootCommand = {
  command(name: string): AgentIdCommand;
};

export type AgentIdConfigWriter = {
  save(config: AgentIdConfig): Promise<void>;
};

export type AgentIdCliDeps = {
  loadIdentity?: (options: { name?: string }) => Promise<{ identity: InstanceIdentity; signMessage?: (message: string) => string }>;
  link?: (options: Parameters<typeof linkAgentId>[0]) => Promise<AgentIdLinkResult>;
  loadBinding?: () => Promise<AgentIdBindingFile | undefined>;
  saveBinding?: (binding: AgentIdBindingFile) => Promise<string>;
  unlinkBinding?: () => Promise<boolean>;
  createWriter?: (api: OpenClawPluginApi) => AgentIdConfigWriter;
  print?: (message: string) => void;
};

export function registerLibp2pMeshAgentIdCommand(
  root: AgentIdRootCommand,
  api: OpenClawPluginApi,
  ctx: OpenClawPluginCliContext,
  deps: AgentIdCliDeps = {},
): void {
  const agentId = root.command("agentid").description("Manage AgentID instance binding for libp2p-mesh.");
  const print = deps.print ?? ((message: string) => process.stdout.write(`${message}\n`));
  const currentConfig = (): AgentIdConfig | undefined =>
    getLibp2pMeshConfig(ctx.config as OpenClawConfigLike)?.agentId ??
    (api.pluginConfig as { agentId?: AgentIdConfig } | undefined)?.agentId;

  agentId
    .command("link")
    .description("Link this InstanceIdentity to an AgentID using device authorization.")
    .option("--agent <agentId>", "Optional AgentID. Without it, create or choose one in the authorization website.")
    .option("--create-agent", "Request the website to create a new AgentID for this device.")
    .option("--issuer <url>", "AgentID issuer URL; defaults to plugins.entries.libp2p-mesh.config.agentId.issuer.")
    .action(async (options) => {
      const config = currentConfig();
      if (options.issuer && !isDevelopmentIssuer(options.issuer)) {
        throw new Error("--issuer is limited to loopback development issuers; production links must use configured agentId.issuer.");
      }
      const issuer = options.issuer ?? config?.issuer;
      if (!issuer) throw new Error("AgentID issuer is required; configure agentId.issuer or pass --issuer.");
      if (options.agent && options.createAgent) throw new Error("--agent and --create-agent cannot be used together.");

      const identity = await (deps.loadIdentity ?? loadOrCreateInstanceIdentity)({
        name: (api.pluginConfig as { instanceName?: string } | undefined)?.instanceName,
      });
      const profileAttributes = await createUserProfileStore({ logger: api.logger }).listAttributes();
      const result = await (deps.link ?? linkAgentId)({
        issuer,
        agentId: options.agent,
        createAgent: Boolean(options.createAgent),
        identity: identity.identity,
        profileAttributes,
        onDeviceAuthorization(authorization) {
          print(`Open ${authorization.verificationUriComplete}`);
          openVerificationUri(authorization.verificationUriComplete);
        },
      });

      const trustedIssuers = [...new Set([issuer, ...(config?.trustedIssuers ?? [])])];
      const nextConfig: AgentIdConfig = {
        ...config,
        issuer,
        trustedIssuers,
        // Linking an instance also opts it into the public directory. The
        // owner can later disable discovery or provide explicit public/relay
        // addresses in the plugin configuration.
        publicConnection: {
          enabled: true,
          allowDirectDial: true,
          ...(config?.publicConnection ?? {}),
        },
      };
      const writer = deps.createWriter?.(api) ?? createOpenClawAgentIdConfigWriter(api);
      await writer.save(nextConfig);
      const bindingPath = await (deps.saveBinding ?? saveAgentIdBinding)(result.binding);
      print(`AgentID linked: ${result.binding.agentId}`);
      print(`Binding saved: ${bindingPath}`);
      print(`Expires: ${new Date(result.binding.expiresAt * 1000).toISOString()}`);
    });

  agentId
    .command("discover")
    .description("Search the public AgentID directory for connectable Agents.")
    .option("--query <text>", "Search Agent name, description, AgentID or attributes.")
    .option("--capability <value>", "Required public capability value.")
    .option("--tag <value>", "Required public tag value.")
    .option("--issuer <url>", "AgentID issuer URL; defaults to configured agentId.issuer.")
    .option("--json", "Print machine-readable JSON.")
    .action(async (options) => {
      const config = currentConfig();
      const issuer = options.issuer ?? config?.issuer;
      if (!issuer) throw new Error("AgentID issuer is required; configure agentId.issuer or pass --issuer.");
      const query = new URLSearchParams();
      if (options.query) query.set("query", options.query);
      if (options.capability) query.set("capability", options.capability);
      if (options.tag) query.set("tag", options.tag);
      const response = await fetch(`${issuer.replace(/\/$/, "")}/v1/public/agents${query.toString() ? `?${query}` : ""}`, { headers: { accept: "application/json" } });
      const body = await response.json().catch(() => ({})) as { agents?: unknown[]; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? `AgentID discovery failed with HTTP ${response.status}.`);
      if (options.json) {
        print(JSON.stringify(body.agents ?? [], null, 2));
        return;
      }
      type DiscoveredAgentRow = {
        agent?: { id?: string; name?: string };
        profile?: { summary?: string; connection?: { allowDiscovery?: boolean } };
      };
      const agents = Array.isArray(body.agents) ? body.agents as DiscoveredAgentRow[] : [];
      if (agents.length === 0) {
        print("No public Agents matched the discovery query.");
        return;
      }
      for (const item of agents) print(`${item.agent?.id ?? "unknown"}\t${item.agent?.name ?? "Unnamed Agent"}\t${item.profile?.connection?.allowDiscovery ? "connectable" : "directory-only"}\t${item.profile?.summary ?? ""}`);
    });

  agentId
    .command("connect")
    .description("Request the local OpenClaw gateway to connect to a public Agent.")
    .option("--agent <agentId>", "Target AgentID.")
    .option("--issuer <url>", "AgentID issuer URL; defaults to configured agentId.issuer.")
    .option("--bridge <url>", "Loopback connection bridge URL.")
    .option("--wait", "Poll until the target is verified or fails.")
    .option("--json", "Print machine-readable JSON.")
    .action(async (options) => {
      const config = currentConfig();
      if (!options.agent) throw new Error("--agent is required.");
      const issuer = options.issuer ?? config?.issuer;
      if (!issuer) throw new Error("AgentID issuer is required; configure agentId.issuer or pass --issuer.");
      const base = issuer.replace(/\/$/, "");
      const ticketResponse = await fetch(`${base}/v1/public/agents/${encodeURIComponent(options.agent)}/connection-ticket`, { headers: { accept: "application/json" } });
      const ticket = await ticketResponse.json().catch(() => ({})) as { ticket?: string; agentId?: string; expiresAt?: string; error?: { message?: string } };
      if (!ticketResponse.ok || !ticket.ticket) throw new Error(ticket.error?.message ?? `Unable to obtain a Discovery Ticket (HTTP ${ticketResponse.status}).`);
      const bridge = String(options.bridge ?? "http://127.0.0.1:8799").replace(/\/$/, "");
      const pairResponse = await fetch(`${bridge}/v1/local/pair`, { method: "POST", headers: { "content-type": "application/json" } });
      const pair = await pairResponse.json().catch(() => ({})) as { localSessionToken?: string; error?: string };
      if (!pairResponse.ok || !pair.localSessionToken) throw new Error(pair.error ?? "Local OpenClaw connection bridge is unavailable.");
      const importResponse = await fetch(`${bridge}/v1/local/connections/import`, { method: "POST", headers: { "content-type": "application/json", "x-openclaw-bridge-token": pair.localSessionToken }, body: JSON.stringify({ agentId: options.agent, discoveryTicket: ticket.ticket, label: options.agent }) });
      const imported = await importResponse.json().catch(() => ({})) as Record<string, unknown>;
      if (!importResponse.ok) throw new Error(typeof imported.error === "string" ? imported.error : `Local connection request failed (HTTP ${importResponse.status}).`);
      if (options.wait && typeof imported.requestId === "string") {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const statusResponse = await fetch(`${bridge}/v1/local/connections/${encodeURIComponent(options.agent)}`, { headers: { "x-openclaw-bridge-token": pair.localSessionToken } });
          const status = await statusResponse.json().catch(() => ({})) as { target?: { status?: string; lastError?: string } };
          if (status.target?.status === "verified" || status.target?.status === "failed") {
            Object.assign(imported, { status: status.target.status, error: status.target.lastError });
            break;
          }
        }
      }
      if (options.json) print(JSON.stringify(imported, null, 2));
      else print(`AgentID ${options.agent}: ${String(imported.status ?? "dialing")}`);
    });

  agentId
    .command("connections")
    .description("List local Agent connection targets managed by OpenClaw.")
    .option("--bridge <url>", "Loopback connection bridge URL.")
    .option("--json", "Print machine-readable JSON.")
    .action(async (options) => {
      const bridge = String(options.bridge ?? "http://127.0.0.1:8799").replace(/\/$/, "");
      const pairResponse = await fetch(`${bridge}/v1/local/pair`, { method: "POST" });
      const pair = await pairResponse.json().catch(() => ({})) as { localSessionToken?: string; error?: string };
      if (!pairResponse.ok || !pair.localSessionToken) throw new Error(pair.error ?? "Local OpenClaw connection bridge is unavailable.");
      const response = await fetch(`${bridge}/v1/local/connections`, { headers: { "x-openclaw-bridge-token": pair.localSessionToken } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Unable to list Agent connections (HTTP ${response.status}).`);
      if (options.json) print(JSON.stringify(body, null, 2));
      else for (const target of (body as { targets?: Array<{ agentId: string; status: string; label?: string }> }).targets ?? []) print(`${target.agentId}\t${target.status}\t${target.label ?? ""}`);
    });

  agentId
    .command("disconnect")
    .description("Remove a local Agent connection target.")
    .option("--agent <agentId>", "Target AgentID.")
    .option("--bridge <url>", "Loopback connection bridge URL.")
    .action(async (options) => {
      if (!options.agent) throw new Error("--agent is required.");
      const bridge = String(options.bridge ?? "http://127.0.0.1:8799").replace(/\/$/, "");
      const pairResponse = await fetch(`${bridge}/v1/local/pair`, { method: "POST" });
      const pair = await pairResponse.json().catch(() => ({})) as { localSessionToken?: string; error?: string };
      if (!pairResponse.ok || !pair.localSessionToken) throw new Error(pair.error ?? "Local OpenClaw connection bridge is unavailable.");
      const response = await fetch(`${bridge}/v1/local/connections/${encodeURIComponent(options.agent)}`, { method: "DELETE", headers: { "x-openclaw-bridge-token": pair.localSessionToken } });
      if (!response.ok) throw new Error(`Unable to remove Agent connection (HTTP ${response.status}).`);
      print(`AgentID connection removed: ${options.agent}`);
    });

  agentId
    .command("info")
    .description("Show the local Instance ID and AgentID binding details.")
    .option("--json", "Print machine-readable JSON.")
    .action(async (options) => {
      const binding = await (deps.loadBinding ?? loadAgentIdBinding)();
      const identity = await (deps.loadIdentity ?? loadOrCreateInstanceIdentity)({ name: (api.pluginConfig as { instanceName?: string } | undefined)?.instanceName });
      const config = currentConfig();
      const bindingPath = resolveBindingPathForInfo();
      const metadata = binding ? getAgentIdIbcMetadata(binding.instanceBinding) : undefined;
      const info = {
        instanceId: identity.identity.id,
        instanceName: identity.identity.name,
        instancePublicKey: identity.identity.pubkey,
        instancePublicKeyFingerprint: fingerprint(identity.identity.pubkey),
        instanceBindingHash: identity.identity.binding,
        agentId: binding?.agentId ?? null,
        userIdHash: binding?.userIdHash ?? null,
        issuer: binding?.issuer ?? null,
        jti: binding?.jti ?? null,
        scopes: metadata && binding ? getScopesFromBinding(binding.instanceBinding) : [],
        status: binding ? (isBindingActiveForIdentity(binding, identity.identity, config) && binding.status !== "revoked" && binding.status !== "expired" ? "active" : binding.status ?? "inactive") : "not_linked",
        expiresAt: binding ? new Date(binding.expiresAt * 1000).toISOString() : null,
        lastStatusCheckAt: binding?.lastStatusCheckAt ? new Date(binding.lastStatusCheckAt).toISOString() : null,
        bindingPath,
      };
      if (options.json) print(JSON.stringify(info, null, 2));
      else {
        print(`Instance ID: ${info.instanceId}`);
        print(`Instance name: ${info.instanceName}`);
        print(`Instance public-key fingerprint: ${info.instancePublicKeyFingerprint}`);
        print(`AgentID: ${info.agentId ?? "not linked"}`);
        print(`Bound user ID hash: ${info.userIdHash ?? "not available for older bindings"}`);
        print(`Issuer: ${info.issuer ?? "-"}`);
        print(`Binding JTI: ${info.jti ?? "-"}`);
        print(`Scopes: ${info.scopes.length ? info.scopes.join(", ") : "-"}`);
        print(`Status: ${info.status}`);
        print(`Expires: ${info.expiresAt ?? "-"}`);
        print(`Last status check: ${info.lastStatusCheckAt ?? "never"}`);
        print(`Binding file: ${info.bindingPath}`);
      }
    });

  agentId
    .command("refresh")
    .description("Refresh the issuer status of the local AgentID binding.")
    .option("--issuer <url>", "AgentID issuer URL; defaults to the issuer stored in the local binding.")
    .action(async (options) => {
      const binding = await (deps.loadBinding ?? loadAgentIdBinding)();
      if (!binding) throw new Error("AgentID: not linked");
      const config = currentConfig();
      const identity = await (deps.loadIdentity ?? loadOrCreateInstanceIdentity)({ name: (api.pluginConfig as { instanceName?: string } | undefined)?.instanceName });
      let refreshed = await refreshAgentIdBinding(binding, { config, fetch, force: true });
      if (refreshed.status === "active" && refreshed.expiresAt * 1000 - Date.now() < 30 * 24 * 60 * 60 * 1000) {
        if (!identity.signMessage) throw new Error("Instance signing key is unavailable; cannot renew AgentID binding.");
        refreshed = await renewAgentIdBinding({ binding: refreshed, identity: identity.identity, signMessage: identity.signMessage, config, fetch });
      }
      const bindingPath = await (deps.saveBinding ?? saveAgentIdBinding)(refreshed);
      print(`AgentID: ${refreshed.agentId}`);
      print(`Status: ${refreshed.status ?? "unknown"}`);
      print(`Last checked: ${new Date(refreshed.lastStatusCheckAt ?? Date.now()).toISOString()}`);
      print(`Expires: ${new Date(refreshed.expiresAt * 1000).toISOString()}`);
      print(`Binding saved: ${bindingPath}`);
    });

  agentId
    .command("status")
    .description("Show the local AgentID binding status.")
    .action(async () => {
      const binding = await (deps.loadBinding ?? loadAgentIdBinding)();
      if (!binding) {
        print("AgentID: not linked");
        return;
      }
      const identity = await (deps.loadIdentity ?? loadOrCreateInstanceIdentity)({
        name: (api.pluginConfig as { instanceName?: string } | undefined)?.instanceName,
      });
      const config = currentConfig();
      const active = isBindingActiveForIdentity(binding, identity.identity, config) && binding.status !== "revoked" && binding.status !== "expired";
      const issuerTrusted = getTrustedAgentIdIssuers(config).includes(binding.issuer);
      print(`AgentID: ${binding.agentId}`);
      print(`Instance: ${binding.instanceId}`);
      print(`Issuer: ${binding.issuer}${issuerTrusted ? "" : " (not trusted by current config)"}`);
      print(`Status: ${active ? "active" : "inactive"}`);
      print(`Last checked: ${binding.lastStatusCheckAt ? new Date(binding.lastStatusCheckAt).toISOString() : "never"}`);
      print(`Expires: ${new Date(binding.expiresAt * 1000).toISOString()}`);
    });

  agentId
    .command("unlink")
    .description("Remove the local AgentID binding. This does not revoke it at the issuer.")
    .action(async () => {
      const removed = await (deps.unlinkBinding ?? unlinkAgentIdBinding)();
      print(removed ? "AgentID binding removed." : "AgentID: not linked");
    });
}

function createOpenClawAgentIdConfigWriter(api: OpenClawPluginApi): AgentIdConfigWriter {
  return {
    async save(agentId) {
      await api.runtime.config.mutateConfigFile({
        afterWrite: AGENTID_CLI_AFTER_WRITE,
        mutate(draft: OpenClawConfig) {
          const next = applyAgentIdConfig(draft as OpenClawConfigLike, agentId);
          replaceConfig(draft as OpenClawConfig, next as OpenClawConfig);
        },
      });
    },
  };
}

function replaceConfig(draft: OpenClawConfig, nextConfig: OpenClawConfig): void {
  for (const key of Object.keys(draft) as Array<keyof OpenClawConfig>) {
    delete draft[key];
  }
  Object.assign(draft, structuredClone(nextConfig));
}

function isDevelopmentIssuer(value: string): boolean {
  try {
    const issuer = new URL(value);
    return issuer.protocol === "http:" && ["127.0.0.1", "localhost", "::1", "[::1]"].includes(issuer.hostname);
  } catch {
    return false;
  }
}

function resolveBindingPathForInfo(): string {
  const stateDir = process.env.OPENCLAW_STATE_DIR;
  return stateDir ? `${stateDir}/libp2p/agentid-binding.json` : `${process.env.HOME ?? "~"}/.openclaw/libp2p/agentid-binding.json`;
}

function fingerprint(publicKey: string): string {
  return createHash("sha256").update(publicKey).digest("base64url").slice(0, 16);
}

function getScopesFromBinding(ibc: string): string[] {
  try {
    const payload = JSON.parse(Buffer.from(ibc.split(".")[1] ?? "", "base64url").toString("utf8")) as { scope?: unknown };
    return Array.isArray(payload.scope) ? payload.scope.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function openVerificationUri(uri: string): void {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    const child = spawn(command, [uri], { detached: true, stdio: "ignore" });
    child.unref();
  } catch {
    // The URL is printed above, so a missing desktop opener does not block authorization.
  }
}
