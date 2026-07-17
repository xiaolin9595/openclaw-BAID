import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomInt,
  randomBytes,
  scrypt,
  sign,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PASSWORD_HASH_VERSION = "scrypt-v1";
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_COST = 16_384;
const PASSWORD_BLOCK_SIZE = 8;
const PASSWORD_PARALLELIZATION = 1;

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, PASSWORD_KEY_LENGTH, { N: PASSWORD_COST, r: PASSWORD_BLOCK_SIZE, p: PASSWORD_PARALLELIZATION, maxmem: 32 * 1024 * 1024 }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey as Buffer);
    });
  });
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function hmacSha256(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await derivePasswordKey(password, salt);
  return [PASSWORD_HASH_VERSION, salt.toString("base64url"), derivedKey.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [version, saltEncoded, keyEncoded] = encodedHash.split("$");
  if (version !== PASSWORD_HASH_VERSION || !saltEncoded || !keyEncoded) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltEncoded, "base64url");
    expected = Buffer.from(keyEncoded, "base64url");
  } catch {
    return false;
  }
  if (salt.length < 16 || expected.length !== PASSWORD_KEY_LENGTH) return false;
  const derivedKey = await derivePasswordKey(password, salt);
  return timingSafeEqual(derivedKey, expected);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function expiryIso(milliseconds: number): string {
  return new Date(Date.now() + milliseconds).toISOString();
}

export function randomEmailLoginCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export interface IssuerKey {
  readonly kid: string;
  readonly jwk: PublicJwk;
  signClaims(claims: Record<string, unknown>, type?: string): string;
}

export interface PublicJwk {
  kty: string;
  crv?: string;
  x?: string;
  kid: string;
  use: "sig";
  alg: "EdDSA";
}

function createIssuerKey(pem: string): IssuerKey {
  const privateKey = createPrivateKey(pem);
  const publicJwk = createPublicKey(pem).export({ format: "jwk" }) as JsonWebKey;
  const kid = sha256(JSON.stringify(publicJwk)).slice(0, 22);

  return {
    kid,
    jwk: { kty: publicJwk.kty ?? "OKP", crv: publicJwk.crv, x: publicJwk.x, kid, use: "sig", alg: "EdDSA" },
    signClaims(claims, type = "agentid+ibc+jwt") {
      const header = Buffer.from(JSON.stringify({ alg: "EdDSA", kid, typ: type })).toString("base64url");
      const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
      const input = `${header}.${payload}`;
      const signature = sign(null, Buffer.from(input), privateKey).toString("base64url");
      return `${input}.${signature}`;
    },
  };
}

export async function loadIssuerKey(options: {
  pem?: string;
  filePath?: string;
  allowDevelopmentGeneration?: boolean;
}): Promise<IssuerKey> {
  if (options.pem) return createIssuerKey(options.pem);
  if (options.filePath) {
    try {
      return createIssuerKey(await readFile(options.filePath, "utf8"));
    } catch (error: unknown) {
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
      if (code !== "ENOENT" || !options.allowDevelopmentGeneration) throw error;
      await mkdir(path.dirname(options.filePath), { recursive: true, mode: 0o700 });
      const pair = generateKeyPairSync("ed25519", {
        privateKeyEncoding: { format: "pem", type: "pkcs8" },
        publicKeyEncoding: { format: "pem", type: "spki" },
      });
      await writeFile(options.filePath, pair.privateKey, { mode: 0o600 });
      return createIssuerKey(pair.privateKey);
    }
  }
  if (options.allowDevelopmentGeneration) {
    const pair = generateKeyPairSync("ed25519", {
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
      publicKeyEncoding: { format: "pem", type: "spki" },
    });
    return createIssuerKey(pair.privateKey);
  }
  throw new Error("ISSUER_PRIVATE_KEY_PEM or ISSUER_PRIVATE_KEY_PATH is required outside development.");
}
