import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import playwright from "../agentid-ui-demo/node_modules/playwright/index.js";

const { chromium } = playwright;
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OUTPUT_DIR = path.join(ROOT, "output", "playwright", "real-email-login");
const OUTPUT_WEBM = path.join(OUTPUT_DIR, "real-email-login.webm");
const EMAIL = "linaacc9595@gmail.com";
const WEB = "http://127.0.0.1:4173";
const CODE_PORT = 8797;

await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
await fs.mkdir(OUTPUT_DIR, { recursive: true });

let receivedCode;
let releaseCode;
const codeReady = new Promise((resolve) => { releaseCode = resolve; });
const server = http.createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/code") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const value = JSON.parse(body || "{}");
    if (!/^\d{6}$/.test(value.code ?? "")) {
      response.writeHead(400);
      response.end("invalid code");
      return;
    }
    receivedCode = value.code;
    releaseCode();
    response.writeHead(202);
    response.end("accepted");
    return;
  }
  response.writeHead(404);
  response.end();
});
await new Promise((resolve) => server.listen(CODE_PORT, "127.0.0.1", resolve));

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
  console.log("STEP 1 open login");
  await page.goto(`${WEB}/control-plane.html`, { waitUntil: "domcontentloaded" });
  await capture("01-login-page");
  console.log("STEP 2 choose email login");
  await page.getByRole("tab", { name: "邮箱登录 / 恢复" }).click();
  await page.getByLabel("绑定邮箱").fill(EMAIL);
  await capture("02-email-filled", 1000);
  console.log("STEP 3 request real code");
  await page.getByRole("button", { name: "发送登录验证码" }).click();
  await page.getByText(/验证码已发送/).waitFor({ timeout: 10000 });
  await capture("03-real-code-sent", 2200);
  console.log("STEP 4 wait for Gmail code");
  await codeReady;
  console.log("STEP 5 enter code");
  await page.getByLabel("6 位验证码").fill(receivedCode);
  await capture("04-real-code-entered", 1000);
  await page.getByRole("button", { name: "验证并登录" }).click();
  await page.getByRole("heading", { name: "我的 Agent" }).waitFor({ timeout: 15000 });
  await capture("05-login-success", 3500);
} finally {
  await context.close();
  await browser.close();
  server.close();
}

const videoPath = await page.video().path();
await fs.copyFile(videoPath, OUTPUT_WEBM);
console.log(`REAL_EMAIL=${EMAIL}`);
console.log(`VIDEO=${OUTPUT_WEBM}`);
