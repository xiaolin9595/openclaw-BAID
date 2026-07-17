import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import playwright from "../agentid-ui-demo/node_modules/playwright/index.js";

const { chromium } = playwright;
const exec = promisify(execFile);
const root = path.resolve(new URL("..", import.meta.url).pathname);
const outputDir = path.join(root, "output", "playwright", "current-round", "02-openclaw-agent-creation");
const web = "http://localhost:4173";
const requestId = process.env.REQUEST_ID;
const terminalWindowId = process.env.TERMINAL_WINDOW_ID;
const session = process.env.AGENTID_SESSION;
if (!requestId) throw new Error("REQUEST_ID is required.");
if (!terminalWindowId) throw new Error("TERMINAL_WINDOW_ID is required.");
if (!session) throw new Error("AGENTID_SESSION is required.");

await fs.mkdir(outputDir, { recursive: true });
const terminalContents = async () => (await exec("/usr/bin/osascript", [
  "-e",
  `tell application "Terminal" to contents of selected tab of window id ${terminalWindowId}`,
])).stdout;
const screenshotTerminal = async (destination) => exec("/usr/sbin/screencapture", ["-x", "-l", terminalWindowId, destination]);
const waitUntil = async (predicate, timeout = 30000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for OpenClaw terminal output.");
};

const terminalBefore = path.join(outputDir, "terminal-before-authorization.png");
await screenshotTerminal(terminalBefore);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outputDir, size: { width: 1440, height: 900 } },
});
await context.addCookies([{ name: "agentid_session", value: session, domain: "localhost", path: "/" }]);
const page = await context.newPage();
let frame = 1;
const capture = async (name, holdMs = 2200) => {
  await page.screenshot({ path: path.join(outputDir, `${String(frame++).padStart(2, "0")}-${name}.png`) });
  await page.waitForTimeout(holdMs);
};

try {
  console.log("STEP 1: show client-created request");
  await page.goto(`${web}/device?request_id=${requestId}`, { waitUntil: "domcontentloaded" });
  await page.getByText("将创建新的 AgentID").waitFor({ timeout: 12000 });
  await capture("create-agent-request", 2600);

  console.log("STEP 2: use explicit development Passkey fallback for recording");
  await page.getByRole("button", { name: /使用 Passkey 创建并授权/ }).click();
  const developmentToggle = page.getByRole("checkbox", { name: "使用开发备用口令" });
  await developmentToggle.check();
  await page.getByRole("textbox", { name: "开发备用口令" }).fill("123456");
  await capture("development-passkey-confirmation", 2600);
  await page.getByRole("button", { name: /使用 Passkey 确认/ }).click();
  await page.getByRole("heading", { name: "使用 Passkey 确认" }).waitFor({ state: "hidden", timeout: 15000 });
  await capture("authorization-complete", 1800);

  console.log("STEP 3: wait for client to save IBC");
  const terminalText = await waitUntil(async () => {
    const value = await terminalContents();
    return value.includes("AgentID linked:") ? value : undefined;
  }, 30000);
  const terminalAfter = path.join(outputDir, "terminal-after-ibc-saved.png");
  await screenshotTerminal(terminalAfter);
  await page.goto(`${web}/control-plane.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "我的 Agent" }).waitFor({ timeout: 15000 });
  await capture("agent-created-and-bound", 3000);
  console.log(`AGENT_ID=${terminalText.match(/AgentID linked: (\S+)/)?.[1] ?? "unknown"}`);
  console.log(`BINDING_PATH=${terminalText.match(/Binding saved: (\S+)/)?.[1] ?? "unknown"}`);
} finally {
  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  await fs.copyFile(videoPath, path.join(outputDir, "browser-flow.webm"));
}

console.log(`BROWSER_VIDEO=${path.join(outputDir, "browser-flow.webm")}`);
console.log(`TERMINAL_BEFORE=${terminalBefore}`);
console.log(`TERMINAL_AFTER=${path.join(outputDir, "terminal-after-ibc-saved.png")}`);
