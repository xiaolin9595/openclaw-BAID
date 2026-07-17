import fs from "node:fs/promises";
import path from "node:path";
import playwright from "../agentid-ui-demo/node_modules/playwright/index.js";
const { chromium } = playwright;

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OUTPUT = path.join(ROOT, "output", "playwright", "demo-video-frames");
const BRIDGE = "http://127.0.0.1:8798";
const ISSUER = "http://localhost:8787";
const WEB = "http://localhost:4173";

await fs.rm(OUTPUT, { recursive: true, force: true });
await fs.mkdir(OUTPUT, { recursive: true });

const json = async (url, init) => {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body)}`);
  return body;
};

const status = () => json(`${BRIDGE}/demo/status`);
const waitUntil = async (predicate, timeout = 30000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for demo state");
};

const requestIdFor = async (nodeId) => {
  const current = await status();
  const event = current.events.find((entry) => entry.type === "authorization_url" && entry.nodeId === nodeId);
  const match = event?.line?.match(/request_id=([0-9a-f-]+)/);
  if (!match) throw new Error(`No authorization request for node ${nodeId}`);
  return match[1];
};

const mailboxCode = async (email) => {
  const value = await waitUntil(async () => {
    const mailbox = await json(`${BRIDGE}/demo/mailbox?email=${encodeURIComponent(email)}`);
    return /^\d{6}$/.test(mailbox.code ?? "") ? mailbox.code : undefined;
  }, 10000);
  return value;
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
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

let frame = 0;
const capture = async (name, holdMs = 2200) => {
  const file = path.join(OUTPUT, `${String(frame++).padStart(4, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  await page.waitForTimeout(holdMs);
};

try {
  const email = `record-${Date.now()}@example.com`;
  await page.goto(`${WEB}/control-plane.html`);
  await capture("01-login-page");
  await page.getByLabel("邮箱地址").fill(email);
  await page.getByRole("button", { name: "发送验证码" }).click();
  await capture("02-code-requested", 1200);
  await page.getByLabel("6 位验证码").fill(await mailboxCode(email));
  await page.getByRole("button", { name: /验证并登录/ }).click();
  await page.getByRole("heading", { name: "我的 Agent" }).waitFor();
  await capture("03-logged-in");

  for (const nodeId of ["a", "b"]) {
    await page.goto(`${WEB}/device?request_id=${await requestIdFor(nodeId)}`);
    await capture(`04-${nodeId}-authorization-request`);
    await page.getByRole("button", { name: /使用 Passkey 创建并授权/ }).last().click({ force: true });
    await page.getByRole("button", { name: /使用 Passkey 确认/ }).waitFor();
    await capture(`05-${nodeId}-passkey-confirmation`);
    await page.getByRole("button", { name: /使用 Passkey 确认/ }).click();
    await page.getByRole("heading", { name: "使用 Passkey 确认" }).waitFor({ state: "hidden", timeout: 15000 });
    await page.goto(`${WEB}/control-plane.html`);
    await capture(`06-${nodeId}-ibc-saved`);
  }

  await waitUntil(async () => {
    const current = await status();
    return current.clients.a.status === "active" && current.clients.b.status === "active";
  });
  await page.getByRole("button", { name: /启动双向验证/ }).click();
  await waitUntil(async () => (await status()).p2p.status === "completed");
  await capture("07-p2p-bidirectional-verified", 3500);

  const current = await status();
  const revoke = await page.evaluate(async ({ agentId, instanceId }) => {
    const response = await fetch(`http://localhost:8787/v1/agents/${encodeURIComponent(agentId)}/instances/${encodeURIComponent(instanceId)}/revoke`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "x-agentid-request": "1", "idempotency-key": crypto.randomUUID() },
      body: "{}",
    });
    return { ok: response.ok, body: await response.json() };
  }, { agentId: current.clients.a.agentId, instanceId: current.clients.a.instanceId });
  if (!revoke.ok) throw new Error(`Revoke failed: ${JSON.stringify(revoke.body)}`);
  await waitUntil(async () => (await status()).clients.a.status === "revoked");
  await capture("08-a-revoked", 2200);
  await page.getByRole("button", { name: "撤销 A 后再次验证" }).click();
  await waitUntil(async () => {
    const currentState = await status();
    return currentState.p2p.status === "completed" && currentState.p2p.mode === "after-revoke";
  });
  await capture("09-revoked-message-rejected", 4000);
} finally {
  await browser.close();
}

console.log(`Recorded ${frame} frames to ${OUTPUT}`);
