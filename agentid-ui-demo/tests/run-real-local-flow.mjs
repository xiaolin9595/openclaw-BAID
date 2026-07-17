import { chromium } from "@playwright/test";
import readline from "node:readline/promises";
import process from "node:process";
import { mkdir } from "node:fs/promises";

const origin = process.env.AGENTID_WEB_ORIGIN ?? "http://localhost:4173";
const email = process.env.AGENTID_TEST_EMAIL ?? "linaacc9595@gmail.com";
const requestId = process.env.AGENTID_DEVICE_REQUEST_ID;
if (!requestId) throw new Error("AGENTID_DEVICE_REQUEST_ID is required.");
const recordDir = process.env.AGENTID_RECORD_DIR;
if (recordDir) await mkdir(recordDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: false });
const context = await browser.newContext(recordDir ? { recordVideo: { dir: recordDir, size: { width: 1280, height: 720 } } } : {});
const page = await context.newPage();
const video = page.video();
page.on("request", (request) => {
  if (request.url().includes("127.0.0.1:8787") || request.url().includes("localhost:8787")) {
    console.log(`FRONTEND_REQUEST ${request.method()} ${new URL(request.url()).pathname}`);
  }
});
page.on("response", async (response) => {
  if (!(response.url().includes("127.0.0.1:8787") || response.url().includes("localhost:8787"))) return;
  const path = new URL(response.url()).pathname;
  console.log(`FRONTEND_RESPONSE ${response.status()} ${path}`);
  if (path === "/v1/auth/email-code/consume") console.log(`EMAIL_CONSUME_BODY_REDACTED status=${response.status()}`);
});
const cdp = await context.newCDPSession(page);
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

try {
  await page.goto(`${origin}/control-plane.html`);
  await page.getByRole("tab", { name: "邮箱登录 / 恢复" }).click();
  await page.getByLabel("绑定邮箱").fill(email);
  await page.getByRole("button", { name: "发送登录验证码" }).click();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = await rl.question(`验证码已发送到 ${email}。请输入服务端实际输出的 6 位验证码: `);
  rl.close();
  if (recordDir) await page.locator("#login-code").evaluate((element) => element.setAttribute("type", "password"));
  await page.getByLabel("6 位验证码").fill(code.trim());
  await page.getByRole("button", { name: "验证并登录" }).click();
  await page.waitForTimeout(1000);
  console.log(`AFTER_LOGIN url=${page.url()}`);
  console.log((await page.locator("body").innerText()).slice(0, 1200));
  await page.getByRole("heading", { name: "我的 Agent" }).waitFor();

  await page.goto(`${origin}/device?request_id=${encodeURIComponent(requestId)}`);
  await page.getByText("将创建新的 AgentID").waitFor();
  await page.getByRole("button", { name: /使用 Passkey 创建并授权/ }).click();
  await page.getByRole("button", { name: /使用 Passkey 确认/ }).click();
  await page.getByText("没有待处理请求").waitFor({ timeout: 20_000 });
  await page.goto(`${origin}/control-plane.html`);
  await page.getByText(/AGENT \/ did:agentid:agt_/).waitFor({ timeout: 15_000 });
  console.log("REAL_LOCAL_FLOW_OK");
} finally {
  await browser.close();
  if (video) console.log(`VIDEO_PATH ${await video.path()}`);
}
