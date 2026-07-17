import http from "node:http";
import playwright from "../agentid-ui-demo/node_modules/playwright/index.js";

const { chromium } = playwright;
const EMAIL = "linaacc9595@gmail.com";
const AGENT_NAME = `OpenClaw Demo Agent ${new Date().toISOString().slice(11, 19).replaceAll(":", "")}`;
const WEB = "http://127.0.0.1:4173";
const CODE_PORT = 8797;

let releaseCode;
let receivedCode;
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
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

try {
  await page.goto(`${WEB}/control-plane.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "邮箱登录 / 恢复" }).click();
  await page.getByLabel("绑定邮箱").fill(EMAIL);
  await page.getByRole("button", { name: "发送登录验证码" }).click();
  await page.getByText(/验证码已发送/).waitFor({ timeout: 10000 });
  console.log("WAITING_FOR_REAL_EMAIL_CODE=1");
  await codeReady;
  await page.getByLabel("6 位验证码").fill(receivedCode);
  await page.getByRole("button", { name: "验证并登录" }).click();
  await page.getByRole("heading", { name: "我的 Agent" }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "创建 Agent" }).click();
  await page.getByLabel("Agent 名称").fill(AGENT_NAME);
  await page.getByRole("button", { name: "创建 Agent", exact: true }).click();
  await page.getByText(AGENT_NAME).waitFor({ timeout: 15000 });
  const bodyText = await page.locator("body").innerText();
  const agentId = bodyText.match(/did:agentid:agt_[A-Za-z0-9_-]+/)?.[0] ?? "unknown";
  console.log(`AGENT_NAME=${AGENT_NAME}`);
  console.log(`AGENT_ID=${agentId}`);
  console.log("AGENT_REGISTRATION_SUCCESS=1");
} finally {
  await context.close();
  await browser.close();
  server.close();
}
