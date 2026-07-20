import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const origin = process.env.AGENTID_WEB_ORIGIN ?? "http://localhost:4173";
const apiOrigin = process.env.AGENTID_API_ORIGIN ?? "https://entrance-antonio-allowance-looksmart.trycloudflare.com";
const email = process.env.AGENTID_RECORD_EMAIL ?? "linaacc9595@gmail.com";
const requestId = process.env.AGENTID_DEVICE_REQUEST_ID;
const sessionToken = process.env.AGENTID_SESSION_TOKEN;
const outputDir = process.env.AGENTID_RECORD_DIR ?? "/Users/lin/Downloads/AgentIDDemo/output/playwright/current-round";
if (!requestId) throw new Error("AGENTID_DEVICE_REQUEST_ID is required.");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: false });
const context = await browser.newContext({
  recordVideo: { dir: outputDir, size: { width: 1440, height: 900 } },
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
page.on("request", (request) => {
  if (request.url().startsWith(apiOrigin)) console.log(`FRONTEND_REQUEST ${request.method()} ${new URL(request.url()).pathname}`);
});
page.on("response", (response) => {
  if (response.url().startsWith(apiOrigin)) console.log(`FRONTEND_RESPONSE ${response.status()} ${new URL(response.url()).pathname}`);
});

try {
  if (sessionToken) {
    const apiUrl = new URL(apiOrigin);
    await context.addCookies([{ name: "agentid_session", value: sessionToken, domain: apiUrl.hostname, path: "/", httpOnly: true, secure: apiUrl.protocol === "https:", sameSite: apiUrl.protocol === "https:" ? "None" : "Lax" }]);
    await page.goto(`${origin}/control-plane.html`);
  } else {
    await page.goto(`${origin}/control-plane.html`);
    await page.getByRole("tab", { name: "邮箱登录 / 恢复" }).click();
    await page.getByLabel("绑定邮箱").fill(email);
    await page.getByRole("button", { name: "发送登录验证码" }).click();
    console.log(`WAITING_FOR_CODE ${email}`);
    process.stdin.setEncoding("utf8");
    const code = await new Promise((resolve) => {
      process.stdin.once("data", (value) => resolve(String(value).trim()));
    });
    await page.getByLabel("6 位验证码").fill(code);
    await page.getByRole("button", { name: "验证并登录" }).click();
  }
  await page.getByRole("heading", { name: "我的 Agent" }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1_500);

  await page.goto(`${origin}/device?request_id=${encodeURIComponent(requestId)}`);
  await page.getByText("将创建新的 AgentID").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: `${outputDir}/agent-profile-draft.png`, fullPage: true });
  await page.getByRole("button", { name: "创建并授权" }).click();
  await page.waitForTimeout(5_000);
  await page.goto(`${origin}/control-plane.html`);
  await page.getByRole("heading", { name: "我的 Agent" }).waitFor({ timeout: 20_000 });
  await page.screenshot({ path: `${outputDir}/agent-profile-authorized.png`, fullPage: true });
  console.log("RECORDING_FLOW_OK");
} finally {
  await page.waitForTimeout(1_500);
  const video = page.video();
  await browser.close();
  if (video) console.log(`VIDEO_PATH ${await video.path()}`);
}
