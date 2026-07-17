import fs from "node:fs/promises";
import path from "node:path";
import playwright from "../agentid-ui-demo/node_modules/playwright/index.js";

const { chromium } = playwright;
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
const OUTPUT_DIR = path.join(ROOT, "output", "playwright", `agent-creation-${stamp}`);
const EMAIL = "linaacc9595@gmail.com";
const WEB = "http://127.0.0.1:4173";
const AGENT_NAME = `OpenClaw Demo Agent ${new Date().toISOString().slice(11, 19).replaceAll(":", "")}`;

await fs.mkdir(OUTPUT_DIR, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: OUTPUT_DIR, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const capture = async (name, delay = 1800) => {
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}.png`), fullPage: false });
  await page.waitForTimeout(delay);
};

try {
  console.log("STEP 1: 打开登录页");
  await page.goto(`${WEB}/control-plane.html`, { waitUntil: "domcontentloaded" });
  await capture("01-login-page");

  console.log("STEP 2: 输入现有用户邮箱并请求验证码");
  await page.getByRole("tab", { name: "邮箱登录 / 恢复" }).click();
  await page.getByLabel("绑定邮箱").fill(EMAIL);
  await capture("02-email-entered", 900);
  await page.getByRole("button", { name: "发送登录验证码" }).click();
  await page.getByText(/验证码已发送/).waitFor({ timeout: 10000 });
  await capture("03-code-requested", 1600);

  console.log("STEP 3: 开发环境输入 6 位验证码并登录");
  await page.getByLabel("6 位验证码").fill("123456");
  await capture("04-code-entered", 900);
  await page.getByRole("button", { name: "验证并登录" }).click();
  await page.getByRole("heading", { name: "我的 Agent" }).waitFor({ timeout: 15000 });
  await capture("05-login-success", 1800);

  console.log("STEP 4: 创建 AgentID");
  await page.getByRole("button", { name: "创建 Agent" }).click();
  await page.getByLabel("Agent 名称").fill(AGENT_NAME);
  await capture("06-agent-form", 900);
  const createDialog = page.getByRole("dialog", { name: "创建 Agent" });
  await createDialog.getByRole("button", { name: "创建 Agent" }).click();
  await page.getByRole("heading", { name: AGENT_NAME, exact: true }).waitFor({ state: "visible", timeout: 15000 });
  const bodyText = await page.locator("body").innerText();
  const agentId = bodyText.match(/did:agentid:agt_[A-Za-z0-9_-]+/)?.[0] ?? "unknown";
  await capture("07-agent-created", 3500);
  console.log(`AGENT_NAME=${AGENT_NAME}`);
  console.log(`AGENT_ID=${agentId}`);
  console.log("AGENT_CREATION_SUCCESS=1");
} finally {
  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  const outputVideo = path.join(OUTPUT_DIR, "agent-creation.webm");
  await fs.copyFile(videoPath, outputVideo);
  console.log(`VIDEO_WEBM=${outputVideo}`);
  console.log(`FRAMES=${OUTPUT_DIR}`);
}
