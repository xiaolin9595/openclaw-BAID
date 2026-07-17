import { chmod, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const backupDirectory = path.resolve(process.env.BACKUP_DIR ?? "./backups");
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? "30");
if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) throw new Error("BACKUP_RETENTION_DAYS must be between 1 and 3650.");

await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
await chmod(backupDirectory, 0o700);
const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
const file = path.join(backupDirectory, `agentid-${stamp}-${randomBytes(4).toString("hex")}.dump`);

await new Promise((resolve, reject) => {
  const child = spawn("pg_dump", ["--format=custom", "--no-owner", "--file", file, databaseUrl], { stdio: ["ignore", "ignore", "pipe"] });
  let errorOutput = "";
  child.stderr.on("data", (chunk) => {
    errorOutput = `${errorOutput}${String(chunk)}`.slice(-2000);
  });
  child.once("error", reject);
  child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`pg_dump exited with code ${code}: ${errorOutput.trim()}`)));
});

await chmod(file, 0o600);
const backupStat = await stat(file);
if (backupStat.size === 0) throw new Error("pg_dump created an empty backup.");

const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
for (const entry of await readdir(backupDirectory, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.startsWith("agentid-") || !entry.name.endsWith(".dump")) continue;
  const entryPath = path.join(backupDirectory, entry.name);
  if ((await stat(entryPath)).mtimeMs < cutoff && entryPath !== file) await rm(entryPath);
}

console.log(JSON.stringify({ status: "ok", file, bytes: backupStat.size, retentionDays }));
