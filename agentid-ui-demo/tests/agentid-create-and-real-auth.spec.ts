import { expect, test } from "@playwright/test";

// Keep the local browser origin on localhost: Chromium does not accept an IP literal as a WebAuthn RP ID.
const webOrigin = process.env.AGENTID_WEB_ORIGIN ?? "http://localhost:4173";
const email = process.env.AGENTID_TEST_EMAIL;
const code = process.env.AGENTID_TEST_EMAIL_CODE;
const requestId = process.env.AGENTID_DEVICE_REQUEST_ID;

test.describe("OpenClaw AgentID creation and real WebAuthn", () => {
  test.skip(!email || !code || !requestId, "Set AGENTID_TEST_EMAIL, AGENTID_TEST_EMAIL_CODE and AGENTID_DEVICE_REQUEST_ID for the real local flow.");

  test("creates a new AgentID without selecting an existing Agent", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
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

    await page.goto(`${webOrigin}/control-plane.html`);
    await page.getByRole("tab", { name: "邮箱登录 / 恢复" }).click();
    await page.getByLabel("绑定邮箱").fill(email!);
    await page.getByRole("button", { name: "发送登录验证码" }).click();
    await page.getByLabel("6 位验证码").fill(code!);
    await page.getByRole("button", { name: "验证并登录" }).click();
    await expect(page.getByRole("heading", { name: "我的 Agent" })).toBeVisible();

    await page.goto(`${webOrigin}/device?request_id=${encodeURIComponent(requestId!)}`);
    await expect(page.getByText("将创建新的 AgentID")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "选择授权 Agent" })).toHaveCount(0);
    await page.getByRole("button", { name: /使用 Passkey 创建并授权/ }).click();
    await page.getByRole("button", { name: /使用 Passkey 确认/ }).click();
    await expect(page.getByText("没有待处理请求")).toBeVisible({ timeout: 15_000 });
  });
});
