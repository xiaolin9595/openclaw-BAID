import { expect, test, type Page } from "@playwright/test";

const CONTROL_URL = "http://127.0.0.1:8798";

type DemoStatus = {
  clients: { a: { status: string; agentId: string | null; jti: string | null; instanceId: string | null }; b: { status: string; agentId: string | null; jti: string | null; instanceId: string | null } };
  p2p: { status: string; mode?: string; result?: { verifiedCount?: number; events?: Array<{ nodeId: string; ibcVerified: boolean }> } | null };
  events: Array<{ type: string; nodeId?: string; line?: string }>;
};

async function demoStatus(): Promise<DemoStatus> {
  const response = await fetch(`${CONTROL_URL}/demo/status`);
  if (!response.ok) throw new Error(`Demo bridge returned ${response.status}`);
  return response.json() as Promise<DemoStatus>;
}

async function waitForCode(email: string): Promise<string> {
  await expect.poll(async () => (await (await fetch(`${CONTROL_URL}/demo/mailbox?email=${encodeURIComponent(email)}`)).json()).code, { timeout: 10_000 }).toMatch(/^\d{6}$/);
  const mailbox = await (await fetch(`${CONTROL_URL}/demo/mailbox?email=${encodeURIComponent(email)}`)).json() as { code: string };
  return mailbox.code;
}

async function requestIdFor(nodeId: "a" | "b"): Promise<string> {
  const status = await demoStatus();
  const event = status.events.find((entry) => entry.type === "authorization_url" && entry.nodeId === nodeId);
  const requestId = event?.line?.match(/request_id=([0-9a-f-]+)/)?.[1];
  if (!requestId) throw new Error(`No authorization request for node ${nodeId}`);
  return requestId;
}

async function enableVirtualPasskey(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

async function approveRequest(page: Page, requestId: string) {
  await page.goto(`/device?request_id=${requestId}`);
  await page.getByRole("button", { name: /使用 Passkey 创建并授权/ }).last().click({ force: true });
  await expect(page.getByRole("button", { name: /使用 Passkey 确认/ })).toBeVisible();
  await page.getByRole("button", { name: /使用 Passkey 确认/ }).click();
  await expect(page.getByRole("heading", { name: "使用 Passkey 确认" })).toBeHidden({ timeout: 15_000 });
}

test("真实 Demo 链路完成登录、Passkey、IBC 和双向 P2P 验证", async ({ page }) => {
  await enableVirtualPasskey(page);
  const email = `demo-${Date.now()}@example.com`;
  await page.goto("/control-plane.html");
  await page.getByLabel("邮箱地址").fill(email);
  await page.getByRole("button", { name: "发送验证码" }).click();
  const code = await waitForCode(email);
  await page.getByLabel("6 位验证码").fill(code);
  await page.getByRole("button", { name: /验证并登录/ }).click();
  await expect(page.getByRole("heading", { name: "我的 Agent" })).toBeVisible();

  await approveRequest(page, await requestIdFor("a"));
  await approveRequest(page, await requestIdFor("b"));
  await expect.poll(async () => (await demoStatus()).clients.a.status, { timeout: 20_000 }).toBe("active");
  await expect.poll(async () => (await demoStatus()).clients.b.status, { timeout: 20_000 }).toBe("active");
  const active = await demoStatus();
  expect(active.clients.a.agentId).toBe(active.clients.b.agentId);
  expect(active.clients.a.jti).not.toBe(active.clients.b.jti);
  expect(active.clients.a.jti).toBeTruthy();
  expect(active.clients.b.jti).toBeTruthy();

  await page.getByRole("button", { name: /启动双向验证/ }).click();
  await expect.poll(async () => (await demoStatus()).p2p.status, { timeout: 30_000 }).toBe("completed");
  const p2p = await demoStatus();
  expect(p2p.p2p.result?.verifiedCount).toBeGreaterThanOrEqual(2);
  expect(p2p.p2p.result?.events?.every((event) => event.ibcVerified)).toBe(true);

  await page.goto("/control-plane.html");
  await expect(page.getByRole("heading", { name: "我的 Agent" })).toBeVisible();
  const refreshed = await demoStatus();
  const revokeResponse = await page.evaluate(async ({ agentId, instanceId }) => {
    const response = await fetch(`http://localhost:8787/v1/agents/${encodeURIComponent(agentId!)}/instances/${encodeURIComponent(instanceId!)}/revoke`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "x-agentid-request": "1", "idempotency-key": crypto.randomUUID() },
      body: "{}",
    });
    return { ok: response.ok, body: await response.json() };
  }, { agentId: refreshed.clients.a.agentId, instanceId: refreshed.clients.a.instanceId });
  expect(revokeResponse.ok).toBe(true);
  await expect.poll(async () => (await demoStatus()).clients.a.status, { timeout: 20_000 }).toBe("revoked");
  await page.getByRole("button", { name: "撤销 A 后再次验证" }).click();
  await expect.poll(async () => (await demoStatus()).p2p.status, { timeout: 30_000 }).toBe("completed");
  const afterRevoke = await demoStatus();
  expect(afterRevoke.p2p.mode).toBe("after-revoke");
  expect(afterRevoke.p2p.result?.verifiedCount).toBe(1);
  expect(afterRevoke.p2p.result?.events?.some((event) => event.nodeId === "A" && event.ibcVerified)).toBe(true);
});
