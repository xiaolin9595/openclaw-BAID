import fs from "node:fs/promises";
import path from "node:path";
import playwright from "../agentid-ui-demo/node_modules/playwright/index.js";

const { chromium } = playwright;
const root = path.resolve(new URL("..", import.meta.url).pathname);
const outputDir = path.join(root, "output", "playwright", "resend-email-login");
const session = process.env.AGENTID_SESSION;
if (!session) throw new Error("AGENTID_SESSION is required.");

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outputDir, size: { width: 1440, height: 900 } },
});
await context.addCookies([{ name: "agentid_session", value: session, domain: "127.0.0.1", path: "/" }]);
const page = await context.newPage();

try {
  console.log("STEP 1 open authenticated AgentID console");
  await page.goto("http://127.0.0.1:4173/control-plane.html", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "我的 Agent" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(5000);
} finally {
  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  await fs.copyFile(videoPath, path.join(outputDir, "resend-email-login.webm"));
}

console.log(`VIDEO=${path.join(outputDir, "resend-email-login.webm")}`);
