import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { AgentConnectionTable, AgentConnectionTarget } from "./types.js";

export function resolveAgentConnectionPath(customPath?: string): string {
  if (customPath) return customPath;
  const stateDir = process.env.OPENCLAW_STATE_DIR;
  return stateDir
    ? path.join(stateDir, "libp2p", "agent-targets.json")
    : path.join(homedir(), ".openclaw", "libp2p", "agent-targets.json");
}

function emptyTable(): AgentConnectionTable {
  return { version: 1, updatedAt: Date.now(), targets: [] };
}

function normalize(value: unknown): AgentConnectionTable {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyTable();
  const candidate = value as Partial<AgentConnectionTable>;
  const targets = Array.isArray(candidate.targets)
    ? candidate.targets.filter((target): target is AgentConnectionTarget => Boolean(target && typeof target === "object" && typeof (target as AgentConnectionTarget).agentId === "string"))
    : [];
  return { version: 1, updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : Date.now(), targets };
}

export function createAgentConnectionStore(customPath?: string) {
  const filePath = resolveAgentConnectionPath(customPath);
  let mutation = Promise.resolve();

  async function load(): Promise<AgentConnectionTable> {
    try {
      return normalize(JSON.parse(await readFile(filePath, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyTable();
      throw error;
    }
  }

  async function save(table: AgentConnectionTable): Promise<void> {
    const directory = path.dirname(filePath);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    const next = { ...table, updatedAt: Date.now() };
    const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, filePath);
    await chmod(filePath, 0o600);
  }

  async function mutate<T>(callback: (table: AgentConnectionTable) => Promise<T> | T): Promise<T> {
    const previous = mutation;
    let release: (() => void) | undefined;
    mutation = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      const table = await load();
      const result = await callback(table);
      await save(table);
      return result;
    } finally {
      release?.();
    }
  }

  return {
    async list(): Promise<AgentConnectionTarget[]> {
      return (await load()).targets;
    },
    async get(agentId: string): Promise<AgentConnectionTarget | undefined> {
      return (await load()).targets.find((target) => target.agentId === agentId);
    },
    async upsert(target: AgentConnectionTarget): Promise<AgentConnectionTarget> {
      return mutate((table) => {
        const index = table.targets.findIndex((item) => item.agentId === target.agentId);
        const current = index >= 0 ? table.targets[index] : undefined;
        const next = { ...current, ...target };
        if (index >= 0) table.targets[index] = next;
        else table.targets.push(next);
        return next;
      });
    },
    async remove(agentId: string): Promise<boolean> {
      return mutate((table) => {
        const before = table.targets.length;
        table.targets = table.targets.filter((target) => target.agentId !== agentId);
        return table.targets.length !== before;
      });
    },
    path: filePath,
  };
}
