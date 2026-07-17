import http from "node:http";
import playwright from "../agentid-ui-demo/node_modules/playwright/index.js";

const { chromium } = playwright;
const EMAIL = `linaacc9595+register-${Date.now()}@gmail.com`;
const USERNAME = `lin-register-${Date.now().toString().slice(-6)}`;
const PASSWORD = "AgentID-Demo-2026!";
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
  await page.getByRole("button", { name: "创建账号" }).click();
  await page.getByLabel("账号").fill(USERNAME);
  await page.getByLabel("密码").fill(PASSWORD);
  await page.getByLabel("绑定邮箱").fill(EMAIL);
  await page.getByLabel("显示名称（可选）").fill("Lin Registration Demo");
  await page.getByRole("button", { name: "发送注册验证码" }).click();
  await page.getByText(/注册验证码已发送/).waitFor({ timeout: 10000 });
  console.log(`REGISTRATION_EMAIL=${EMAIL}`);
  console.log(`REGISTRATION_USERNAME=${USERNAME}`);
  console.log("WAITING_FOR_REAL_EMAIL_CODE=1");
  await codeReady;
  await page.getByLabel("邮箱验证码").fill(receivedCode);
  await page.getByRole("button", { name: "验证邮箱并创建账号" }).click();
  await page.getByRole("heading", { name: "我的 Agent" }).waitFor({ timeout: 15000 });
  console.log("REGISTRATION_SUCCESS=1");
} finally {
  await context.close();
  await browser.close();
  server.close();
}
