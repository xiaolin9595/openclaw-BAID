import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
  type WebAuthnCredential as SimpleWebAuthnCredential,
} from "@simplewebauthn/server";
import { createHash } from "node:crypto";
import type { WebAuthnCredential } from "./domain.js";

export interface NewCredential {
  id: string;
  publicKey: string;
  counter: number;
  transports: string[];
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
}

export interface WebAuthnAdapter {
  registrationOptions(input: { userId: string; email: string; displayName: string; credentials: WebAuthnCredential[] }): Promise<{ challenge: string; options: object }>;
  verifyRegistration(input: { response: unknown; challenge: string }): Promise<NewCredential | null>;
  authenticationOptions(input: { credentials: WebAuthnCredential[] }): Promise<{ challenge: string; options: object }>;
  verifyAuthentication(input: { response: unknown; challenge: string; credential: WebAuthnCredential }): Promise<{ newCounter: number } | null>;
}

export class SimpleWebAuthnAdapter implements WebAuthnAdapter {
  constructor(private readonly rpId: string, private readonly expectedOrigin: string) {}

  async registrationOptions(input: { userId: string; email: string; displayName: string; credentials: WebAuthnCredential[] }): Promise<{ challenge: string; options: object }> {
    const options = await generateRegistrationOptions({
      rpName: "AgentID",
      rpID: this.rpId,
      userName: input.email,
      userDisplayName: input.displayName,
      userID: new TextEncoder().encode(input.userId),
      attestationType: "none",
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      excludeCredentials: input.credentials.map((credential) => ({ id: credential.id, transports: credential.transports as AuthenticatorTransportFuture[] })),
    });
    return { challenge: options.challenge, options };
  }

  async verifyRegistration(input: { response: unknown; challenge: string }): Promise<NewCredential | null> {
    const response = input.response as RegistrationResponseJSON;
    const verified = await verifyRegistrationResponse({
      response,
      expectedChallenge: input.challenge,
      expectedOrigin: this.expectedOrigin,
      expectedRPID: this.rpId,
      requireUserVerification: true,
    });
    if (!verified.verified) return null;
    const credential = verified.registrationInfo.credential;
    return {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: response.response.transports ? [...response.response.transports] : [],
      deviceType: verified.registrationInfo.credentialDeviceType,
      backedUp: verified.registrationInfo.credentialBackedUp,
    };
  }

  async authenticationOptions(input: { credentials: WebAuthnCredential[] }): Promise<{ challenge: string; options: object }> {
    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      userVerification: "required",
      allowCredentials: input.credentials.map((credential) => ({ id: credential.id, transports: credential.transports as AuthenticatorTransportFuture[] })),
    });
    return { challenge: options.challenge, options };
  }

  async verifyAuthentication(input: { response: unknown; challenge: string; credential: WebAuthnCredential }): Promise<{ newCounter: number } | null> {
    const credential: SimpleWebAuthnCredential = {
      id: input.credential.id,
      publicKey: Buffer.from(input.credential.publicKey, "base64url"),
      counter: input.credential.counter,
      transports: input.credential.transports as AuthenticatorTransportFuture[],
    };
    const verified = await verifyAuthenticationResponse({
      response: input.response as AuthenticationResponseJSON,
      expectedChallenge: input.challenge,
      expectedOrigin: this.expectedOrigin,
      expectedRPID: this.rpId,
      credential,
      requireUserVerification: true,
    });
    return verified.verified ? { newCounter: verified.authenticationInfo.newCounter } : null;
  }
}

/** Test-only adapter. It deliberately accepts only responses carrying the issued challenge. */
export class TestWebAuthnAdapter implements WebAuthnAdapter {
  async registrationOptions(input: { userId: string; email: string; displayName: string }): Promise<{ challenge: string; options: object }> {
    const challenge = `test-registration-${input.userId}-${Date.now()}`;
    return { challenge, options: { challenge, rp: { id: "test.local", name: "AgentID" }, user: { id: input.userId, name: input.email, displayName: input.displayName } } };
  }

  async verifyRegistration(input: { response: unknown; challenge: string }): Promise<NewCredential | null> {
    const response = testResponse(input.response);
    if (!response || response.challenge !== input.challenge || !response.id) return null;
    return { id: response.id, publicKey: Buffer.from(response.id).toString("base64url"), counter: 0, transports: [], deviceType: "singleDevice", backedUp: false };
  }

  async authenticationOptions(input: { credentials: WebAuthnCredential[] }): Promise<{ challenge: string; options: object }> {
    const challenge = `test-authentication-${input.credentials[0]?.id ?? "none"}-${Date.now()}`;
    return { challenge, options: { challenge, allowCredentials: input.credentials.map((credential) => ({ id: credential.id, type: "public-key" })) } };
  }

  async verifyAuthentication(input: { response: unknown; challenge: string; credential: WebAuthnCredential }): Promise<{ newCounter: number } | null> {
    const response = testResponse(input.response);
    if (!response || response.challenge !== input.challenge || response.id !== input.credential.id) return null;
    return { newCounter: input.credential.counter + 1 };
  }
}

function testResponse(value: unknown): { id: string; challenge: string } | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const id = Reflect.get(value, "id");
  const challenge = Reflect.get(value, "challenge");
  return typeof id === "string" && typeof challenge === "string" ? { id, challenge } : null;
}

export interface MagicLinkDelivery {
  send(input: { email: string; url: string; code: string; expiresAt: string }): Promise<void>;
}

export class EmailDeliveryError extends Error {
  readonly status: number;
  readonly providerCode: string | null;

  constructor(status: number, providerCode: string | null, message: string) {
    super(message);
    this.name = "EmailDeliveryError";
    this.status = status;
    this.providerCode = providerCode;
  }
}

export interface DevelopmentMailbox {
  getLatestCode(email: string): { code: string; expiresAt: string } | null;
}

export class WebhookMagicLinkDelivery implements MagicLinkDelivery {
  constructor(private readonly endpoint: string) {}

  async send(input: { email: string; url: string; code: string; expiresAt: string }): Promise<void> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(`Magic-link delivery webhook failed with ${response.status}.`);
  }
}

export class ResendMagicLinkDelivery implements MagicLinkDelivery {
  constructor(private readonly apiKey: string, private readonly from: string, private readonly endpoint = "https://api.resend.com/emails") {}

  async send(input: { email: string; url: string; code: string; expiresAt: string }): Promise<void> {
    const expiresAt = new Date(input.expiresAt).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" });
    const escapedCode = escapeHtml(input.code);
    const escapedUrl = escapeHtml(input.url);
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        "idempotency-key": createHash("sha256").update(`${input.email}:${input.code}:${input.expiresAt}`).digest("hex"),
      },
      body: JSON.stringify({
        from: this.from,
        to: [input.email],
        subject: "AgentID 验证码",
        text: `你的 AgentID 验证码是 ${input.code}。验证码有效期至 ${expiresAt}。如果不是你本人操作，请忽略此邮件。`,
        html: `<div style="font-family: sans-serif; line-height: 1.6"><h2>AgentID 验证码</h2><p>你的验证码是：</p><p style="font-size: 28px; letter-spacing: 0.2em"><strong>${escapedCode}</strong></p><p>验证码有效期至 ${escapeHtml(expiresAt)}。</p><p>也可以打开：<a href="${escapedUrl}">${escapedUrl}</a></p><p>如果不是你本人操作，请忽略此邮件。</p></div>`,
      }),
    });
    if (!response.ok) {
      let providerCode: string | null = null;
      let providerMessage = "Resend rejected the email request.";
      try {
        const payload = await response.json() as { name?: unknown; message?: unknown };
        providerCode = typeof payload.name === "string" ? payload.name : null;
        if (typeof payload.message === "string" && payload.message.length <= 500) providerMessage = payload.message;
      } catch {
        // Keep provider failures actionable without exposing the response body to the client.
      }
      throw new EmailDeliveryError(response.status, providerCode, providerMessage);
    }
  }
}

export class ConsoleMagicLinkDelivery implements MagicLinkDelivery, DevelopmentMailbox {
  private readonly latest = new Map<string, { code: string; expiresAt: string }>();

  async send(input: { email: string; url: string; code: string; expiresAt: string }): Promise<void> {
    this.latest.set(input.email.toLowerCase(), { code: input.code, expiresAt: input.expiresAt });
    console.info(`AgentID development login for ${input.email}: code ${input.code}; magic link ${input.url}`);
  }

  getLatestCode(email: string): { code: string; expiresAt: string } | null {
    const value = this.latest.get(email.toLowerCase());
    return value && Date.parse(value.expiresAt) > Date.now() ? { ...value } : null;
  }
}

export class TestMagicLinkDelivery implements MagicLinkDelivery {
  readonly sent: Array<{ email: string; url: string; code: string; expiresAt: string }> = [];

  async send(input: { email: string; url: string; code: string; expiresAt: string }): Promise<void> {
    this.sent.push({ ...input });
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
