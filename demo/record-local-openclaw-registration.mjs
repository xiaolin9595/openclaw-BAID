import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import playwright from "../agentid-ui-demo/node_modules/playwright/index.js";

const { chromium } = playwright;
const exec = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OUTPUT_DIR = path.join(ROOT, "output", "playwright", "local-openclaw-registration");
const VIDEO = path.join(OUTPUT_DIR, "openclaw-agentid-registration.webm");
const TERMINAL_BEFORE = path.join(OUTPUT_DIR, "terminal-command-and-request.png");
const TERMINAL_AFTER = path.join(OUTPUT_DIR, "terminal-ibc-saved.png");
const EMAIL = "linaacc9595@gmail.com";
const WEB = "http://127.0.0.1:4173";
const ISSUER = "http://127.0.0.1:8787";
const PROFILE = `agentid-recording-${Date.now()}`;
const PLUGIN_DIR = path.join(ROOT, "openclawAgentid", "libp2p-mesh");
const OPENCLAW = path.join(PLUGIN_DIR, "node_modules", ".bin", "openclaw");

await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
await fs.mkdir(OUTPUT_DIR, { recursive: true });

const terminalContents = async (windowId) => (await exec("/usr/bin/osascript", [
  "-e",
  `tell application "Terminal" to contents of selected tab of window id ${windowId}`,
])).stdout;

const screenshotTerminal = async (windowId, destination) => {
  await exec("/usr/sbin/screencapture", ["-x", "-l", String(windowId), destination]);
};

const waitUntil = async (predicate, timeout = 30000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for local OpenClaw flow");
};

const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

await exec(OPENCLAW, ["--profile", PROFILE, "plugins", "install", "--link", "--dangerously-force-unsafe-install", PLUGIN_DIR], { cwd: PLUGIN_DIR });
const command = `cd ${shellQuote(PLUGIN_DIR)} && ${shellQuote(OPENCLAW)} --profile ${PROFILE} libp2p-mesh agentid link --issuer ${ISSUER}`;
const terminalResult = await exec("/usr/bin/osascript", [
  "-e",
  `tell application "Terminal" to do script ${JSON.stringify(command)}`,
]);
const windowId = terminalResult.stdout.match(/window id (\d+)/)?.[1];
if (!windowId) throw new Error(`Could not identify Terminal window: ${terminalResult.stdout}`);

const requestId = await waitUntil(async () => (await terminalContents(windowId)).match(/request_id=([0-9a-f-]+)/)?.[1], 20000);
await screenshotTerminal(windowId, TERMINAL_BEFORE);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: OUTPUT_DIR, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
let frame = 1;
const capture = async (name, delay = 1600) => {
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${String(frame++).padStart(2, "0")}-${name}.png`) });
  await page.waitForTimeout(delay);
};

try {
  console.log("STEP 1: open login page");
  await page.goto(`${WEB}/control-plane.html`, { waitUntil: "domcontentloaded" });
  await capture("login-page");

  console.log("STEP 2: request email login code");
  await page.getByRole("tab", { name: "邮箱登录 / 恢复" }).click();
  await page.getByLabel("绑定邮箱").fill(EMAIL);
  await page.getByRole("button", { name: "发送登录验证码" }).click();
  await page.getByText(/验证码已发送/).waitFor({ timeout: 10000 });
  await capture("email-code-requested");

  console.log("STEP 3: development email verification");
  await page.getByLabel("6 位验证码").fill("123456");
  await page.getByRole("button", { name: "验证并登录" }).click();
  await page.getByRole("heading", { name: "我的 Agent" }).waitFor({ timeout: 15000 });
  await capture("login-success");

  console.log("STEP 4: approve the OpenClaw device request");
  await page.goto(`${WEB}/device?request_id=${requestId}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /使用 Passkey 创建并授权/ }).last().click();
  await page.getByRole("checkbox", { name: "使用开发备用口令" }).check();
  await page.getByRole("textbox", { name: "开发备用口令" }).fill("123456");
  await capture("device-approval");
  await page.getByRole("button", { name: /使用 Passkey 确认/ }).click();
  await page.getByRole("heading", { name: "待授权" }).waitFor({ state: "visible", timeout: 15000 });
  await page.getByText("没有待处理请求").waitFor({ timeout: 15000 });
  await capture("approval-complete", 1000);

  console.log("STEP 5: wait for OpenClaw to save the IBC");
  await waitUntil(async () => (await terminalContents(windowId)).includes("AgentID linked:"), 30000);
  await screenshotTerminal(windowId, TERMINAL_AFTER);
  await page.goto(`${WEB}/control-plane.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "我的 Agent" }).waitFor({ timeout: 15000 });
  await capture("binding-visible", 2200);
} finally {
  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  await fs.copyFile(videoPath, VIDEO);
}

const output = await terminalContents(windowId);
const agentId = output.match(/AgentID linked: (\S+)/)?.[1] ?? "unknown";
const jti = output.match(/Binding JTI: (\S+)/)?.[1] ?? "shown by agentid info";
console.log(`PROFILE=${PROFILE}`);
console.log(`REQUEST_ID=${requestId}`);
console.log(`AGENT_ID=${agentId}`);
console.log(`VIDEO=${VIDEO}`);
console.log(`TERMINAL_BEFORE=${TERMINAL_BEFORE}`);
console.log(`TERMINAL_AFTER=${TERMINAL_AFTER}`);
console.log(`JTI=${jti}`);
