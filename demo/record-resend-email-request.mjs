import fs from "node:fs/promises";
import path from "node:path";
import playwright from "../agentid-ui-demo/node_modules/playwright/index.js";

const { chromium } = playwright;
const root = path.resolve(new URL("..", import.meta.url).pathname);
const outputDir = path.join(root, "output", "playwright", "resend-email-request");
const web = "http://127.0.0.1:4173";
const email = "linaacc9595@gmail.com";
const fixedStartKey = process.env.IDEMPOTENCY_KEY;

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outputDir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
if (fixedStartKey) {
  await page.route(`${web}/v1/auth/email-code/start`, async (route) => {
    await route.continue({ headers: { ...route.request().headers(), "idempotency-key": fixedStartKey } });
  });
}

try {
  console.log("STEP 1 open AgentID login");
  await page.goto(`${web}/control-plane.html`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);

  console.log("STEP 2 select email login");
  await page.getByRole("tab", { name: "邮箱登录 / 恢复" }).click();
  await page.getByLabel("绑定邮箱").fill(email);
  await page.waitForTimeout(1200);

  console.log("STEP 3 send real Resend verification email");
  await page.getByRole("button", { name: "发送登录验证码" }).click();
  await page.getByText("验证码已发送").waitFor({ timeout: 12000 });
  await page.waitForTimeout(3500);

  if (process.env.EMAIL_CODE) {
    if (!/^\d{6}$/.test(process.env.EMAIL_CODE)) throw new Error("EMAIL_CODE must be exactly 6 digits.");
    console.log("STEP 4 enter real verification code");
    await page.getByLabel("6 位验证码").fill(process.env.EMAIL_CODE);
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: "验证并登录" }).click();
    await page.getByRole("heading", { name: "我的 Agent" }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(3500);
  }
} finally {
  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  await fs.copyFile(videoPath, path.join(outputDir, "resend-email-request.webm"));
}

console.log(`VIDEO=${path.join(outputDir, "resend-email-request.webm")}`);
