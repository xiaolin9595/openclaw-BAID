import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import playwright from "../agentid-ui-demo/node_modules/playwright/index.js";

const { chromium } = playwright;
const exec = promisify(execFile);
const root = path.resolve(new URL("..", import.meta.url).pathname);
const outputDir = path.join(root, "output", "playwright", "current-round", "02-openclaw-agent-creation");
const pluginDir = path.join(root, "openclawAgentid", "libp2p-mesh");
const openclaw = path.join(pluginDir, "node_modules", ".bin", "openclaw");
const email = "linaacc9595@gmail.com";
const emailCode = process.env.EMAIL_CODE;
const startKey = process.env.IDEMPOTENCY_KEY;
const web = "http://localhost:4173";
const issuer = "http://127.0.0.1:8787";
const profile = `agentid-create-recording-${Date.now()}`;

if (!/^\d{6}$/.test(emailCode ?? "")) throw new Error("EMAIL_CODE must be exactly 6 digits.");
if (!startKey) throw new Error("IDEMPOTENCY_KEY is required.");

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
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
  throw new Error("Timed out waiting for OpenClaw AgentID creation flow.");
};

await exec(openclaw, ["--profile", profile, "plugins", "install", "--link", "--dangerously-force-unsafe-install", pluginDir], { cwd: pluginDir });
const command = `cd ${shellQuote(pluginDir)} && ${shellQuote(openclaw)} --profile ${profile} libp2p-mesh agentid link --create-agent --issuer ${issuer}`;
const terminalResult = await exec("/usr/bin/osascript", [
  "-e",
  `tell application "Terminal" to do script ${JSON.stringify(command)}`,
]);
const windowId = terminalResult.stdout.match(/window id (\d+)/)?.[1];
if (!windowId) throw new Error(`Could not identify Terminal window: ${terminalResult.stdout}`);

const requestId = await waitUntil(async () => (await terminalContents(windowId)).match(/request_id=([0-9a-f-]+)/)?.[1], 30000);
const terminalBefore = path.join(outputDir, "terminal-before-authorization.png");
await screenshotTerminal(windowId, terminalBefore);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outputDir, size: { width: 1440, height: 900 } },
});
const cdp = await context.newCDPSession(await context.newPage());
const page = context.pages()[0];
await cdp.send("WebAuthn.enable");
await cdp.send("WebAuthn.addVirtualAuthenticator", {
  options: {
    protocol: "ctap2",
    transport: "internal",
    hasResidentKey: true,
    hasUserVerification: true,
    isUserVerified: true,
    automaticPresenceSimulation: true,
  },
});
await page.route(`${web}/v1/auth/email-code/start`, async (route) => {
  await route.continue({ headers: { ...route.request().headers(), "idempotency-key": startKey } });
});

let frame = 1;
const capture = async (name, holdMs = 2200) => {
  await page.screenshot({ path: path.join(outputDir, `${String(frame++).padStart(2, "0")}-${name}.png`) });
  await page.waitForTimeout(holdMs);
};

try {
  console.log("STEP 1: Open AgentID login");
  await page.goto(`${web}/control-plane.html`, { waitUntil: "domcontentloaded" });
  await capture("login-page");

  console.log("STEP 2: Real Resend email login");
  await page.getByRole("tab", { name: "邮箱登录 / 恢复" }).click();
  await page.getByLabel("绑定邮箱").fill(email);
  await page.getByRole("button", { name: "发送登录验证码" }).click();
  await page.getByText("验证码已发送").waitFor({ timeout: 12000 });
  await page.getByLabel("6 位验证码").fill(emailCode);
  await capture("email-code-entered", 2500);
  await page.getByRole("button", { name: "验证并登录" }).click();
  await page.getByRole("heading", { name: "我的 Agent" }).waitFor({ timeout: 15000 });
  await capture("login-success", 1800);

  console.log("STEP 3: Open client-created AgentID request");
  await page.goto(`${web}/device?request_id=${requestId}`, { waitUntil: "domcontentloaded" });
  await page.getByText("将创建新的 AgentID").waitFor({ timeout: 12000 });
  await capture("create-agent-authorization-request", 2600);
  await page.getByRole("button", { name: /使用 Passkey 创建并授权/ }).click();
  await page.getByRole("button", { name: /使用 Passkey 确认/ }).waitFor({ timeout: 12000 });
  await capture("passkey-confirmation", 2200);
  await page.getByRole("button", { name: /使用 Passkey 确认/ }).click();
  await page.getByRole("heading", { name: "使用 Passkey 确认" }).waitFor({ state: "hidden", timeout: 20000 });
  await capture("authorization-complete", 1800);

  console.log("STEP 4: Wait for client to save IBC");
  await waitUntil(async () => (await terminalContents(windowId)).includes("AgentID linked:"), 30000);
  const terminalAfter = path.join(outputDir, "terminal-after-ibc-saved.png");
  await screenshotTerminal(windowId, terminalAfter);
  await page.goto(`${web}/control-plane.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "我的 Agent" }).waitFor({ timeout: 15000 });
  await capture("agent-created-and-bound", 2800);

  const terminalText = await terminalContents(windowId);
  const agentId = terminalText.match(/AgentID linked: (\S+)/)?.[1] ?? "unknown";
  const bindingPath = terminalText.match(/Binding saved: (\S+)/)?.[1] ?? "unknown";
  console.log(`AGENT_ID=${agentId}`);
  console.log(`BINDING_PATH=${bindingPath}`);
} finally {
  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  await fs.copyFile(videoPath, path.join(outputDir, "browser-flow.webm"));
}

console.log(`PROFILE=${profile}`);
console.log(`REQUEST_ID=${requestId}`);
console.log(`BROWSER_VIDEO=${path.join(outputDir, "browser-flow.webm")}`);
console.log(`TERMINAL_BEFORE=${path.join(outputDir, "terminal-before-authorization.png")}`);
console.log(`TERMINAL_AFTER=${path.join(outputDir, "terminal-after-ibc-saved.png")}`);
