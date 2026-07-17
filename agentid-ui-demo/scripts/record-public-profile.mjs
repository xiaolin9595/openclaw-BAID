import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const outputDir = path.resolve(root, "../output/playwright/agent-discovery-communication");
const web = "http://127.0.0.1:4173";
const api = "http://127.0.0.1:8787";
const agentId = "did:agentid:agt_demo_public_profile";
const agent = {
  id: agentId,
  name: "Research Assistant",
  role: "owner",
  status: "active",
  instanceCount: 2,
  pendingApprovalCount: 0,
  createdAt: "2026-07-11T10:00:00.000Z",
};
let authenticated = false;
let profile = {
  agentId,
  summary: "负责论文检索、资料整理和摘要生成。",
  role: "研究助理",
  language: "TypeScript",
  published: true,
  updatedAt: "2026-07-11T10:00:00.000Z",
  attributes: [
    { key: "research", label: "研究能力", value: "research", kind: "capability", trust: "self_declared", visible: true },
    { key: "tag", label: "公开标签", value: "academic", kind: "tag", trust: "self_declared", visible: true },
    { key: "private-context", label: "内部项目", value: "private-project", kind: "context", trust: "self_declared", visible: false },
  ],
};

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": web,
      "access-control-allow-credentials": "true",
    },
    body: JSON.stringify(body),
  });
}

async function mockApi(route) {
  const request = route.request();
  if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": web, "access-control-allow-credentials": "true" } });
  const url = new URL(request.url());
  if (!url.pathname.startsWith("/v1/")) return route.continue();
  if (url.pathname === "/v1/me") return authenticated ? json(route, { user: { id: "usr_demo_owner", email: "owner@example.com", displayName: "Demo Owner", createdAt: "2026-07-11T10:00:00.000Z", passkeyEnrolled: true } }) : json(route, { error: { code: "UNAUTHENTICATED", message: "Please sign in." } }, 401);
  if (url.pathname === "/v1/auth/email-code/start") return json(route, { status: "accepted", expiresAt: "2026-07-14T07:00:00.000Z" }, 202);
  if (url.pathname === "/v1/auth/email-code/consume") {
    authenticated = true;
    return json(route, { user: { id: "usr_demo_owner", email: "owner@example.com", displayName: "Demo Owner", createdAt: "2026-07-11T10:00:00.000Z", passkeyEnrolled: true }, returnTo: "/control-plane.html" });
  }
  if (url.pathname === "/v1/me/agents") return json(route, { agents: [agent] });
  if (url.pathname === "/v1/approvals") return json(route, { approvals: [] });
  if (url.pathname === "/v1/activity") return json(route, { activity: [] });
  if (url.pathname.endsWith("/public-profile")) {
    if (request.method() === "PATCH") {
      profile = { ...profile, ...JSON.parse(request.postData() ?? "{}"), updatedAt: new Date().toISOString() };
    }
    return json(route, { profile });
  }
  if (url.pathname.endsWith("/instances")) return json(route, { instances: [] });
  if (url.pathname.endsWith("/members")) return json(route, { members: [{ agentId, userId: "usr_demo_owner", email: "owner@example.com", displayName: "Demo Owner", role: "owner", status: "active", createdAt: "2026-07-11T10:00:00.000Z" }] });
  if (url.pathname === "/v1/public/agents") return json(route, { agents: [{ agent, profile }] });
  return json(route, {});
}

const publicAgent = { agent, profile };
await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  recordVideo: { dir: outputDir, size: { width: 1440, height: 960 } },
});
const page = await context.newPage();
await page.route(`${api}/**`, mockApi);

await page.goto(`${web}/agent-public.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(1600);
await page.getByLabel("搜索 Agent").fill("research");
await page.waitForTimeout(1000);
await page.locator(".agent-card").first().click();
await page.waitForTimeout(1800);
await page.getByRole("button", { name: "发起通信" }).click();
await page.getByLabel("首条消息").fill("你好，我想了解你的研究能力和可用接口。");
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "复制 JSON" }).click();
await page.waitForTimeout(900);

await page.goto(`${web}/control-plane.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.getByLabel("邮箱地址").fill("owner@example.com");
await page.getByRole("button", { name: "发送验证码" }).click();
await page.waitForTimeout(700);
await page.getByLabel("6 位验证码").fill("123456");
await page.getByRole("button", { name: /验证并登录/ }).click();
await page.getByRole("heading", { name: "我的 Agent" }).waitFor();
await page.waitForTimeout(1400);
await page.getByRole("tab", { name: "公开资料" }).click();
await page.waitForTimeout(1200);
await page.getByLabel("公开简介").fill("面向研究团队的论文检索、资料整理和摘要 Agent。");
await page.getByLabel("Agent 角色").fill("研究助理");
await page.getByLabel("运行环境").fill("TypeScript / Node.js");
await page.locator(".publish-switch input").uncheck({ force: true });
await page.waitForTimeout(900);
await page.locator(".publish-switch input").check({ force: true });
await page.getByRole("button", { name: "保存公开资料" }).click();
await page.getByText("公开资料已发布").waitFor();
await page.waitForTimeout(1800);

await page.goto(`${web}/agent-public.html?agent=${encodeURIComponent(agentId)}`, { waitUntil: "networkidle" });
await page.waitForTimeout(2200);
await context.close();
await browser.close();

const webm = (await fs.readdir(outputDir)).find((name) => name.endsWith(".webm"));
if (!webm) throw new Error("Playwright video was not created.");
console.log(path.join(outputDir, webm));
