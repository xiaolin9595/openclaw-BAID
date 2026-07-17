import fs from "node:fs/promises";
import path from "node:path";
import playwright from "../agentid-ui-demo/node_modules/playwright/index.js";

const { chromium } = playwright;
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OUTPUT = path.join(ROOT, "output", "playwright", "link-flow-frames");
const BRIDGE = "http://127.0.0.1:8798";
const WEB = "http://localhost:4173";
const EMAIL = `record-flow-${Date.now()}@example.com`;

await fs.rm(OUTPUT, { recursive: true, force: true });
await fs.mkdir(OUTPUT, { recursive: true });
const json = async (url, init) => { const r = await fetch(url, init); const b = await r.json(); if (!r.ok) throw new Error(`${r.status}: ${JSON.stringify(b)}`); return b; };
const status = () => json(`${BRIDGE}/demo/status`);
const waitUntil = async (predicate, timeout = 30000) => { const end = Date.now() + timeout; while (Date.now() < end) { const value = await predicate(); if (value) return value; await new Promise((resolve) => setTimeout(resolve, 250)); } throw new Error("Timed out waiting for demo state"); };
const code = async () => waitUntil(async () => { const b = await json(`${BRIDGE}/demo/mailbox?email=${encodeURIComponent(EMAIL)}`); return /^\d{6}$/.test(b.code ?? "") ? b.code : undefined; }, 10000);
const REQUEST_A = "574563ae-2d04-4aa3-91fe-151d9d56c1e8";
const REQUEST_B = "9c043a26-84ba-4778-9dfc-81b5aad39490";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("WebAuthn.enable");
await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
let frame = 0;
const capture = async (name, holdMs = 2200) => { await page.screenshot({ path: path.join(OUTPUT, `${String(frame++).padStart(4, "0")}-${name}.png`) }); await page.waitForTimeout(holdMs); };

try {
  await page.goto(`${WEB}/control-plane.html`);
  await capture("01-website-login");
  await page.getByLabel("邮箱地址").fill(EMAIL);
  await page.getByRole("button", { name: "发送验证码" }).click();
  await page.getByLabel("6 位验证码").fill(await code());
  await page.getByRole("button", { name: /验证并登录/ }).click();
  await page.getByRole("heading", { name: "我的 Agent" }).waitFor();
  await capture("02-user-logged-in");

  await page.goto(`${WEB}/device?request_id=${REQUEST_A}`);
  await capture("03-device-authorization");
  await page.getByRole("button", { name: /使用 Passkey 创建并授权/ }).last().click({ force: true });
  await page.getByRole("button", { name: /使用 Passkey 确认/ }).waitFor();
  await capture("04-passkey-confirmation");
  await page.getByRole("button", { name: /使用 Passkey 确认/ }).click();
  await page.getByRole("heading", { name: "使用 Passkey 确认" }).waitFor({ state: "hidden", timeout: 15000 });
  await page.goto(`${WEB}/control-plane.html`);
  await waitUntil(async () => (await status()).clients.a.status === "active");
  await capture("05-ibc-saved");

  await page.goto(`${WEB}/device?request_id=${REQUEST_B}`);
  await capture("06-b-device-authorization");
  await page.getByRole("button", { name: /使用 Passkey 创建并授权/ }).last().click({ force: true });
  await page.getByRole("button", { name: /使用 Passkey 确认/ }).waitFor();
  await capture("07-b-passkey-confirmation");
  await page.getByRole("button", { name: /使用 Passkey 确认/ }).click();
  await page.getByRole("heading", { name: "使用 Passkey 确认" }).waitFor({ state: "hidden", timeout: 15000 });
  await page.goto(`${WEB}/control-plane.html`);
  await waitUntil(async () => (await status()).clients.b.status === "active");
  await capture("08-b-ibc-saved");

  await page.getByRole("button", { name: /启动双向验证/ }).click();
  await waitUntil(async () => (await status()).p2p.status === "completed");
  await capture("09-p2p-verified", 3500);

  const s = await status();
  const revoke = await page.evaluate(async ({ agentId, instanceId }) => { const r = await fetch(`http://localhost:8787/v1/agents/${encodeURIComponent(agentId)}/instances/${encodeURIComponent(instanceId)}/revoke`, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-agentid-request": "1", "idempotency-key": crypto.randomUUID() }, body: "{}" }); return { ok: r.ok, body: await r.json() }; }, { agentId: s.clients.a.agentId, instanceId: s.clients.a.instanceId });
  if (!revoke.ok) throw new Error(`Revoke failed: ${JSON.stringify(revoke.body)}`);
  await waitUntil(async () => (await status()).clients.a.status === "revoked");
  await capture("10-a-revoked");
  await page.getByRole("button", { name: "撤销 A 后再次验证" }).click();
  await waitUntil(async () => { const p = (await status()).p2p; return p.status === "completed" && p.mode === "after-revoke"; });
  await capture("11-revoked-message-rejected", 4000);
} finally { await browser.close(); }
console.log(`Recorded ${frame} browser frames to ${OUTPUT}`);
