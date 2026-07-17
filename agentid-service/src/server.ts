import { fileURLToPath } from "node:url";
import { ConsoleMagicLinkDelivery, ResendMagicLinkDelivery, SimpleWebAuthnAdapter, WebhookMagicLinkDelivery } from "./auth.js";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { loadIssuerKey } from "./crypto.js";
import { PostgresStore } from "./store.js";

export async function createRuntimeApp() {
  const config = loadConfig();
  const store = PostgresStore.fromDatabaseUrl(config.databaseUrl);
  const issuerKey = await loadIssuerKey({
    pem: config.issuerPrivateKeyPem,
    filePath: config.issuerPrivateKeyPath,
    allowDevelopmentGeneration: config.allowDevelopmentKeyGeneration,
  });
  const magicLinkDelivery = config.emailProvider === "resend"
    ? new ResendMagicLinkDelivery(config.resendApiKey!, config.resendFromEmail!)
    : config.emailProvider === "webhook"
      ? new WebhookMagicLinkDelivery(config.magicLinkWebhookUrl!)
      : new ConsoleMagicLinkDelivery();
  if (config.nodeEnv === "production" && config.emailProvider === "console") {
    await store.close();
    throw new Error("EMAIL_PROVIDER must be resend or webhook in production.");
  }
  return buildApp({ config, store, issuerKey, magicLinkDelivery, webAuthn: new SimpleWebAuthnAdapter(config.rpId, config.webOrigin) });
}

async function main(): Promise<void> {
  const app = await createRuntimeApp();
  const config = loadConfig();
  await app.listen({ host: config.host, port: config.port });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
