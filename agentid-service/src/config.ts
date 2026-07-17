import path from "node:path";

export const CURRENT_SCHEMA_MIGRATION = "014_agent_creation_requested.sql";

export interface RateLimitSetting {
  max: number;
  timeWindowMs: number;
}

export interface RateLimitConfig {
  oauthDevice: RateLimitSetting;
  oauthToken: RateLimitSetting;
  auth: RateLimitSetting;
  agentChanges: RateLimitSetting;
  approvals: RateLimitSetting;
  bindingStatus: RateLimitSetting;
  bindingRenewal: RateLimitSetting;
}

export type EmailProvider = "console" | "webhook" | "resend";

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  databaseUrl: string;
  issuerUrl: string;
  webOrigin: string;
  webBaseUrl: string;
  allowedWebOrigins: Set<string>;
  rpId: string;
  issuerPrivateKeyPem?: string;
  issuerPrivateKeyPath?: string;
  userIdHashSecret: string;
  allowDevelopmentKeyGeneration: boolean;
  allowDevelopmentAuth: boolean;
  emailProvider: EmailProvider;
  magicLinkWebhookUrl?: string;
  resendApiKey?: string;
  resendFromEmail?: string;
  sessionCookieName: string;
  sessionTtlMs: number;
  passkeyStepUpTtlMs: number;
  magicLinkTtlMs: number;
  deviceAuthorizationTtlMs: number;
  bindingTtlMs: number;
  clientId: string;
  version: string;
  metricsAllowedIps: Set<string>;
  rateLimits: RateLimitConfig;
}

function origin(value: string, name: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }
  if (parsed.origin === "null" || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    throw new Error(`${name} must use http or https.`);
  }
  return parsed.origin;
}

function baseUrl(value: string | undefined, webOrigin: string, name: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value ?? `${webOrigin}/`);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }
  if (parsed.origin !== webOrigin || parsed.search || parsed.hash) {
    throw new Error(`${name} must use WEB_ORIGIN and cannot contain a query or hash.`);
  }
  const pathname = parsed.pathname.endsWith("/") ? parsed.pathname : `${parsed.pathname}/`;
  return `${parsed.origin}${pathname}`;
}

function integer(value: string | undefined, fallback: number, name: string): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) throw new Error(`${name} must be a valid integer.`);
  return parsed;
}

function positiveSeconds(value: string | undefined, fallback: number, name: string): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 30 || parsed > 3600) throw new Error(`${name} must be between 30 and 3600 seconds.`);
  return parsed;
}

function nonNegativeInteger(value: string | undefined, fallback: number, name: string): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1_000_000) throw new Error(`${name} must be a non-negative integer.`);
  return parsed;
}

function rateLimit(environment: NodeJS.ProcessEnv, prefix: string, fallbackMax: number, fallbackWindowMs: number): RateLimitSetting {
  return {
    max: nonNegativeInteger(environment[`${prefix}_MAX`], fallbackMax, `${prefix}_MAX`),
    timeWindowMs: positiveSeconds(environment[`${prefix}_WINDOW_SECONDS`], Math.floor(fallbackWindowMs / 1000), `${prefix}_WINDOW_SECONDS`) * 1000,
  };
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const rawEnvironment = environment.NODE_ENV ?? "development";
  if (rawEnvironment !== "development" && rawEnvironment !== "test" && rawEnvironment !== "production") {
    throw new Error("NODE_ENV must be development, test, or production.");
  }
  const nodeEnv = rawEnvironment;
  const issuerUrl = origin(environment.ISSUER_URL ?? "http://127.0.0.1:8787", "ISSUER_URL");
  const webOrigin = origin(environment.WEB_ORIGIN ?? "http://127.0.0.1:4173", "WEB_ORIGIN");
  const webBaseUrl = baseUrl(environment.WEB_BASE_URL, webOrigin, "WEB_BASE_URL");
  const configuredOrigins = (environment.ALLOWED_WEB_ORIGINS ?? webOrigin).split(",").map((entry) => entry.trim()).filter(Boolean);
  const allowedWebOrigins = new Set(configuredOrigins.map((entry) => origin(entry, "ALLOWED_WEB_ORIGINS")));
  allowedWebOrigins.add(webOrigin);
  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required. Use Docker Compose for local PostgreSQL.");
  const issuerPrivateKeyPath = environment.ISSUER_PRIVATE_KEY_PATH ?? (nodeEnv === "development" ? path.resolve("data/issuer-ed25519.pem") : undefined);
  const userIdHashSecret = environment.USER_ID_HASH_SECRET ?? (nodeEnv === "development" ? "agentid-development-user-id-hash-secret" : undefined);
  if (!userIdHashSecret) throw new Error("USER_ID_HASH_SECRET is required outside development.");
  if (nodeEnv === "production" && !environment.ISSUER_PRIVATE_KEY_PEM && !issuerPrivateKeyPath) {
    throw new Error("ISSUER_PRIVATE_KEY_PEM or ISSUER_PRIVATE_KEY_PATH is required in production.");
  }
  const configuredEmailProvider = environment.EMAIL_PROVIDER?.toLowerCase();
  const emailProvider = configuredEmailProvider
    ? configuredEmailProvider as EmailProvider
    : environment.RESEND_API_KEY && environment.RESEND_FROM_EMAIL
      ? "resend"
      : environment.MAGIC_LINK_WEBHOOK_URL
        ? "webhook"
        : "console";
  if (!["console", "webhook", "resend"].includes(emailProvider)) throw new Error("EMAIL_PROVIDER must be console, webhook, or resend.");
  if (emailProvider === "webhook" && !environment.MAGIC_LINK_WEBHOOK_URL) throw new Error("MAGIC_LINK_WEBHOOK_URL is required when EMAIL_PROVIDER=webhook.");
  if (emailProvider === "resend" && (!environment.RESEND_API_KEY || !environment.RESEND_FROM_EMAIL)) throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL are required when EMAIL_PROVIDER=resend.");
  return {
    nodeEnv,
    host: environment.HOST ?? "127.0.0.1",
    port: integer(environment.PORT, 8787, "PORT"),
    databaseUrl,
    issuerUrl,
    webOrigin,
    webBaseUrl,
    allowedWebOrigins,
    rpId: environment.RP_ID ?? new URL(webOrigin).hostname,
    issuerPrivateKeyPem: environment.ISSUER_PRIVATE_KEY_PEM?.replaceAll("\\n", "\n"),
    issuerPrivateKeyPath,
    userIdHashSecret,
    allowDevelopmentKeyGeneration: nodeEnv === "development",
    allowDevelopmentAuth: nodeEnv === "development" && environment.ALLOW_DEVELOPMENT_AUTH === "true",
    emailProvider,
    magicLinkWebhookUrl: environment.MAGIC_LINK_WEBHOOK_URL,
    resendApiKey: environment.RESEND_API_KEY,
    resendFromEmail: environment.RESEND_FROM_EMAIL,
    sessionCookieName: environment.SESSION_COOKIE_NAME ?? "agentid_session",
    sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
    passkeyStepUpTtlMs: positiveSeconds(environment.PASSKEY_STEP_UP_TTL_SECONDS, 5 * 60, "PASSKEY_STEP_UP_TTL_SECONDS") * 1000,
    magicLinkTtlMs: 15 * 60 * 1000,
    deviceAuthorizationTtlMs: 10 * 60 * 1000,
    bindingTtlMs: 90 * 24 * 60 * 60 * 1000,
    clientId: environment.OAUTH_CLIENT_ID ?? "openclaw-libp2p-mesh",
    version: environment.SERVICE_VERSION ?? "0.1.0",
    metricsAllowedIps: new Set((environment.METRICS_ALLOWED_IPS ?? "127.0.0.1,::1").split(",").map((entry) => entry.trim()).filter(Boolean)),
    rateLimits: {
      oauthDevice: rateLimit(environment, "RATE_LIMIT_OAUTH_DEVICE", 30, 60_000),
      oauthToken: rateLimit(environment, "RATE_LIMIT_OAUTH_TOKEN", 120, 60_000),
      auth: rateLimit(environment, "RATE_LIMIT_AUTH", 30, 10 * 60_000),
      agentChanges: rateLimit(environment, "RATE_LIMIT_AGENT_CHANGES", 60, 60_000),
      approvals: rateLimit(environment, "RATE_LIMIT_APPROVALS", 60, 60_000),
      bindingStatus: rateLimit(environment, "RATE_LIMIT_BINDING_STATUS", 300, 60_000),
      bindingRenewal: rateLimit(environment, "RATE_LIMIT_BINDING_RENEWAL", 60, 60_000),
    },
  };
}
