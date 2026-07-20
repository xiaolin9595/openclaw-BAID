import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import playwright from "../agentid-ui-demo/node_modules/playwright/index.js";

const { chromium } = playwright;
const exec = promisify(execFile);
const root = path.resolve(new URL("..", import.meta.url).pathname);
const outputDir = path.join(root, "output", "playwright", "current-round", "03-complete-user-journey");
const pluginDir = path.join(root, "openclawAgentid", "libp2p-mesh");
const openclaw = path.join(pluginDir, "node_modules", ".bin", "openclaw");
const web = process.env.RECORD_WEB_ORIGIN ?? "https://agentid-baid.site";
const issuer = process.env.RECORD_ISSUER ?? web;
const email = process.env.RECORD_EMAIL ?? "linaacc9595@gmail.com";
const profile = `agentid-recording-${Date.now()}`;
const codeFile = path.join(outputDir, "email-code.txt");

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
const waitUntil = async (predicate, timeout = 600000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("录制流程等待超时。");
};

const runOpenClaw = async (args) => {
  const result = await exec(openclaw, args, { cwd: pluginDir });
  return result.stdout ?? "";
};

await runOpenClaw(["--profile", profile, "plugins", "install", "--link", "--dangerously-force-unsafe-install", pluginDir]);
await runOpenClaw(["--profile", profile, "config", "set", "plugins.entries.libp2p-mesh.config.agentId.issuer", JSON.stringify(issuer), "--strict-json"]);
await runOpenClaw(["--profile", profile, "config", "set", "plugins.entries.libp2p-mesh.config.agentId.trustedIssuers", JSON.stringify([issuer]), "--strict-json"]);

const command = `${shellQuote(openclaw)} --profile ${shellQuote(profile)} libp2p-mesh agentid link --create-agent`;
const terminalResult = await exec("/usr/bin/osascript", [
  "-e",
  `tell application "Terminal" to do script ${JSON.stringify(`cd ${shellQuote(pluginDir)} && ${command}`)}`,
]);
const windowId = terminalResult.stdout.match(/window id (\d+)/)?.[1];
if (!windowId) throw new Error(`无法识别录制终端窗口：${terminalResult.stdout}`);

const requestId = await waitUntil(async () => (await terminalContents(windowId)).match(/request_id=([0-9a-f-]+)/)?.[1]);
await screenshotTerminal(windowId, path.join(outputDir, "01-terminal-command-and-request.png"));

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outputDir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
let frame = 1;
const capture = async (name, holdMs = 1800) => {
  await page.screenshot({ path: path.join(outputDir, `${String(frame++).padStart(2, "0")}-${name}.png`) });
  await page.waitForTimeout(holdMs);
};

try {
  console.log("STEP 1: 打开线上控制台登录页");
  await page.goto(`${web}/control-plane.html`, { waitUntil: "domcontentloaded" });
  await capture("01-login-page", 2200);

  console.log("STEP 2: 发送真实 Resend 登录验证码");
  await page.getByRole("tab", { name: "邮箱登录 / 恢复" }).click();
  await page.getByLabel("绑定邮箱").fill(email);
  await page.getByRole("button", { name: "发送登录验证码" }).click();
  await page.getByText("验证码已发送").waitFor({ timeout: 15000 });
  await capture("02-code-sent", 1800);
  console.log(`EMAIL_CODE_FILE=${codeFile}`);
  await waitUntil(async () => {
    const code = (await fs.readFile(codeFile, "utf8").catch(() => "")).trim();
    return /^\d{6}$/.test(code) ? code : false;
  });
  const emailCode = (await fs.readFile(codeFile, "utf8")).trim();
  await page.getByLabel("6 位验证码").fill(emailCode);
  await capture("03-code-entered", 1800);
  await page.getByRole("button", { name: "验证并登录" }).click();
  await page.getByRole("heading", { name: "我的 Agent" }).waitFor({ timeout: 20000 });
  await capture("04-login-success", 2200);

  console.log("STEP 3: 打开客户端创建 AgentID 的授权请求");
  await page.goto(`${web}/device?request_id=${requestId}`, { waitUntil: "domcontentloaded" });
  await page.getByText("将创建新的 AgentID").waitFor({ timeout: 15000 });
  await capture("05-authorization-request", 2600);
  await page.getByRole("button", { name: "创建并授权" }).click();
  // The current console returns to the approval queue after a successful mutation.
  // Older builds showed an explicit success toast, so accept either signal.
  await Promise.race([
    page.getByText("设备已获授权").waitFor({ timeout: 20000 }),
    page.getByText("没有待处理请求").waitFor({ timeout: 20000 }),
  ]);
  await capture("06-authorization-complete", 2200);

  console.log("STEP 4: 等待 OpenClaw 保存 IBC");
  await waitUntil(async () => (await terminalContents(windowId)).includes("AgentID linked:"));
  await screenshotTerminal(windowId, path.join(outputDir, "02-terminal-ibc-saved.png"));
  const terminalText = await terminalContents(windowId);
  const agentId = terminalText.match(/AgentID linked: (\S+)/)?.[1];
  if (!agentId) throw new Error("终端输出中没有找到 AgentID。");
  await runOpenClaw(["--profile", profile, "libp2p-mesh", "agentid", "status"]);
  await capture("07-console-agent-created", 2200);

  console.log("STEP 5: 公共 Agent Discovery 展示新 Agent");
  await page.goto(`${web}/agent-public.html`, { waitUntil: "domcontentloaded" });
  await page.getByText("Agent Discovery").waitFor({ timeout: 15000 }).catch(() => undefined);
  await capture("08-public-directory", 2400);
  await page.goto(`${web}/agent-public.html?agent=${encodeURIComponent(agentId)}`, { waitUntil: "domcontentloaded" });
  await page.getByText(agentId).waitFor({ timeout: 15000 });
  await capture("09-public-agent-detail", 2800);

  await fs.writeFile(path.join(outputDir, "recording-summary.json"), JSON.stringify({
    web,
    issuer,
    email,
    profile,
    requestId,
    agentId,
    recordedAt: new Date().toISOString(),
    terminalCommand: command,
  }, null, 2));
  console.log(`AGENT_ID=${agentId}`);
} finally {
  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  await fs.copyFile(videoPath, path.join(outputDir, "browser-flow.webm"));
  await fs.rm(codeFile, { force: true });
}

console.log(`PROFILE=${profile}`);
console.log(`BROWSER_VIDEO=${path.join(outputDir, "browser-flow.webm")}`);
console.log(`OUTPUT_DIR=${outputDir}`);
