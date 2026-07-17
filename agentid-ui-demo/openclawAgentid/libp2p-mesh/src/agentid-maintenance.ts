import {
  getAgentIdStatusRefreshIntervalSeconds,
  isBindingActiveForIdentity,
  loadAgentIdBinding,
  refreshAgentIdBinding,
  renewAgentIdBinding,
  saveAgentIdBinding,
  type AgentIdBindingFile,
} from "./agentid.js";
import type { AgentIdConfig, InstanceIdentity } from "./types.js";

const RENEWAL_WINDOW_SECONDS = 30 * 24 * 60 * 60;

type Logger = {
  info?: (message: string) => void;
  warn?: (message: string) => void;
};

export type AgentIdMaintenanceOptions = {
  identity: InstanceIdentity;
  signMessage: (message: string) => string;
  config?: AgentIdConfig;
  logger?: Logger;
  loadBinding?: () => Promise<AgentIdBindingFile | undefined>;
  saveBinding?: (binding: AgentIdBindingFile) => Promise<string>;
  refreshBinding?: typeof refreshAgentIdBinding;
  renewBinding?: typeof renewAgentIdBinding;
  now?: () => number;
  setInterval?: (handler: () => void | Promise<void>, timeout: number) => ReturnType<typeof setInterval>;
  clearInterval?: (timer: ReturnType<typeof setInterval>) => void;
  onBindingChange?: (binding: AgentIdBindingFile | undefined) => void;
};

export type AgentIdMaintenance = {
  refreshNow(): Promise<void>;
  start(): void;
  stop(): Promise<void>;
  getBinding(): AgentIdBindingFile | undefined;
};

export function createAgentIdMaintenance(options: AgentIdMaintenanceOptions): AgentIdMaintenance {
  const load = options.loadBinding ?? (() => loadAgentIdBinding());
  const save = options.saveBinding ?? ((binding) => saveAgentIdBinding(binding));
  const refresh = options.refreshBinding ?? refreshAgentIdBinding;
  const renew = options.renewBinding ?? renewAgentIdBinding;
  const now = options.now ?? Date.now;
  const setTimer = options.setInterval ?? ((handler, timeout) => setInterval(handler, timeout));
  const clearTimer = options.clearInterval ?? clearInterval;
  let binding: AgentIdBindingFile | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let inFlight: Promise<void> | undefined;

  function publish(next: AgentIdBindingFile | undefined): void {
    binding = next;
    options.onBindingChange?.(next);
  }

  async function refreshNow(): Promise<void> {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const loaded = await load();
      if (!loaded) {
        publish(undefined);
        return;
      }

      if (!isBindingActiveForIdentity(loaded, options.identity, options.config, now())) {
        if (loaded.expiresAt <= Math.floor(now() / 1000) && loaded.status !== "expired") {
          const expired = { ...loaded, status: "expired" as const, lastStatusCheckAt: now() };
          await save(expired);
        }
        publish(undefined);
        return;
      }

      try {
        let refreshed = await refresh(loaded, { config: options.config, force: true });
        if (refreshed.status === "active" && refreshed.expiresAt - Math.floor(now() / 1000) < RENEWAL_WINDOW_SECONDS) {
          refreshed = await renew({
            binding: refreshed,
            identity: options.identity,
            signMessage: options.signMessage,
            config: options.config,
          });
          options.logger?.info?.(`[libp2p-mesh] AgentID binding renewed: ${refreshed.agentId}`);
        }
        await save(refreshed);
        publish(refreshed.status === "active" ? refreshed : undefined);
        if (refreshed.status !== "active") {
          options.logger?.warn?.(`[libp2p-mesh] AgentID binding is ${refreshed.status}; it will not be sent.`);
        }
      } catch (error) {
        const stillValid = loaded.expiresAt > Math.floor(now() / 1000) && loaded.status !== "revoked" && loaded.status !== "expired";
        if (stillValid) {
          publish(loaded);
          options.logger?.warn?.(`[libp2p-mesh] AgentID maintenance failed; retaining the still-valid local binding: ${String(error)}`);
        } else {
          publish(undefined);
          options.logger?.warn?.(`[libp2p-mesh] AgentID maintenance failed after binding expiry: ${String(error)}`);
        }
      }
    })().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  }

  function start(): void {
    if (timer) return;
    const intervalMs = getAgentIdStatusRefreshIntervalSeconds(options.config) * 1000;
    timer = setTimer(() => refreshNow(), intervalMs);
  }

  async function stop(): Promise<void> {
    if (timer) {
      clearTimer(timer);
      timer = undefined;
    }
    await inFlight;
  }

  return { refreshNow, start, stop, getBinding: () => binding };
}
