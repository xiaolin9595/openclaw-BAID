# AgentID Service

AgentID is a TypeScript/Fastify control plane for website sessions, passkey step-up, OAuth 2.0 device authorization, and Ed25519 instance-binding credentials (IBC). PostgreSQL is the only application runtime store. The in-memory store is injected by automated tests only; there is no JSON-file, SQLite, or `X-AgentID-User` authentication path.

## Run

Requirements: Node.js 22+ and PostgreSQL 16+. Copy `.env.example` to `.env`, create an Ed25519 PKCS#8 private key at `secrets/issuer-ed25519.pem`, then run migrations and start the service:

```bash
openssl genpkey -algorithm Ed25519 -out secrets/issuer-ed25519.pem
npm install
npm run migrate
npm run dev
```

`docker compose up --build` starts PostgreSQL and the service. It reads the same untracked `secrets/issuer-ed25519.pem`. Email delivery is selected with `EMAIL_PROVIDER`: `console` for local logs, `webhook` for the existing local bridge, or `resend` for real email delivery.

To use Resend, create an API key, verify a sending domain, and configure:

```dotenv
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM_EMAIL=AgentID <no-reply@your-domain.example>
ALLOW_DEVELOPMENT_AUTH=false
```

The API key must be supplied through the runtime secret environment, never committed to `.env.example`, source control, logs, IBCs, or browser responses. Resend receives the recipient, one-time code, expiry time, and verification URL through its email API.

For a local real-authentication run, keep `NODE_ENV=development` but set `ALLOW_DEVELOPMENT_AUTH=false`. This makes the service verify the submitted email-code hash and disables the development Passkey endpoint. Start the control-plane Vite server without `VITE_ALLOW_DEMO_PASSKEY=1`; the browser will then use WebAuthn registration and authentication. Use `localhost` consistently for the local browser origin and API host: `RP_ID=localhost`, `WEB_ORIGIN=http://localhost:4173`, `ALLOWED_WEB_ORIGINS=http://localhost:4173`, and `VITE_AGENTID_API_URL=http://localhost:8787`. Chromium rejects an IP address such as `127.0.0.1` as a local WebAuthn RP ID. Production must use HTTPS and a real domain.

The explicit client-side AgentID creation flow is:

```bash
openclaw libp2p-mesh agentid link --create-agent --issuer http://127.0.0.1:8787
```

The identity service creates the canonical AgentID during approval. OpenClaw verifies the returned IBC and saves the resulting AgentID and binding locally. Use `--agent <agentId>` to bind an existing AgentID; do not combine it with `--create-agent`.

For a manual local WebAuthn acceptance with the console mail provider, start the client request, then run the browser helper from `agentid-ui-demo` and enter the one-time code printed by the service:

```bash
AGENTID_WEB_ORIGIN=http://localhost:4173 \
AGENTID_DEVICE_REQUEST_ID=<request-id> \
node tests/run-real-local-flow.mjs
```

This helper uses a Chrome virtual authenticator for repeatable local testing; it does not enable the development Passkey endpoint.

For browser development, configure:

```dotenv
ISSUER_URL=http://127.0.0.1:8787
WEB_ORIGIN=http://localhost:4173
ALLOWED_WEB_ORIGINS=http://localhost:4173
```

The service emits CORS headers only for exact configured origins and includes `Access-Control-Allow-Credentials: true`. Browser requests must use `credentials: "include"`.

## Security Model

- Six-digit email verification codes and compatibility magic links are random, hashed at rest, single-use, and expire after 15 minutes. The delivery mechanism is injected, so tests use an outbox while production uses Resend or a configured webhook.
- `ResendMagicLinkDelivery` sends transactional email through `https://api.resend.com/emails` with an idempotency key derived from the recipient and one-time message values. Delivery failures are returned as service errors without exposing the API key or provider response body.
- Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` on HTTPS origins. Every state-changing `/v1` request also requires an exact allowed `Origin` and `X-AgentID-Request: 1`, preventing cross-site form and fetch requests.
- WebAuthn uses `@simplewebauthn/server` with configured RP ID and origin. The test-only adapter is injected directly by tests and is not selected by the runtime server.
- A magic-link session has `verifiedAt: null`. Passkey registration or authentication creates a fresh session with `verifiedAt`; `approve`, `deny`, and both revoke routes require that verification to be less than `PASSKEY_STEP_UP_TTL_SECONDS` old (default 300 seconds).
- IBCs are compact EdDSA JWS objects. Their public signing key is published through `/.well-known/jwks.json`; the private key is never returned or stored in PostgreSQL.
- Each IBC contains `user_id_hash`, an issuer-keyed HMAC-SHA256 pseudonym of the managing website user ID. The raw `user_id` is never put in the IBC, OAuth token response, binding-status response, or P2P payload. Set a stable, randomly generated `USER_ID_HASH_SECRET` in every production instance; changing it rotates pseudonyms and prevents cross-instance comparison.
- PostgreSQL transactions, row locks, an active-binding uniqueness constraint, and per-user advisory locks serialize device-code exchange and idempotent changes. Approval and revoke requests require `Idempotency-Key`.
- Audit records are append-only, chained with a deterministic SHA-256 hash, and protected from update/delete by a PostgreSQL trigger. The approved website activity response includes the preceding and current hashes for independent chain verification.

## Browser API

All website endpoints return camelCase JSON. Errors use `{ "error": { "code", "message" } }`.

| Endpoint | Request | Success response |
| --- | --- | --- |
| `GET /v1/me` | session cookie | `{ "user": { "id", "username", "email", "displayName", "createdAt", "passkeyEnrolled" } }` |
| `POST /v1/auth/register` | `{ "username", "email", "password", "displayName"? }` | `201 { "user": ... }` and sets cookie |
| `POST /v1/auth/login` | `{ "identifier", "password" }` | `{ "user": ... }` and sets cookie; identifier accepts username or bound email |
| `POST /v1/auth/email-code/start` | `{ "email", "returnTo"? }` | `202 { "status": "accepted", "expiresAt" }` |
| `POST /v1/auth/email-code/consume` | `{ "email", "code" }` | `{ "user", "returnTo" }` and sets cookie |
| `POST /v1/auth/recovery/start` | `{ "email" }` | `202 { "status": "accepted", "expiresAt" }` without revealing account existence |
| `POST /v1/auth/recovery/complete` | `{ "email", "code", "newPassword" }` | `{ "user", "recovered": true }` and sets cookie |
| `POST /v1/auth/email/bind/start` | authenticated `{ "email" }` | `202 { "status": "accepted", "expiresAt" }` |
| `POST /v1/auth/email/bind/verify` | authenticated `{ "email", "code" }` | `{ "user", "verified": true }` |
| `GET /v1/auth/magic-link/consume?token=...` | magic token | sets cookie, `303` to stored same-origin return path |
| `POST /v1/auth/magic-link/consume` | `{ "token" }` | `{ "user": ... }` and sets cookie |
| `POST /v1/agents` | `{ "name" }` | `201 { "agent": { "id", "name", "ownerId", "status", "createdAt", "updatedAt" } }` |
| `GET /v1/me/agents` | session cookie | `{ "agents": [agent] }` |
| `GET /v1/agents/:agentId/instances` | session cookie | `{ "instances": [binding] }` |
| `GET /v1/approvals?status=pending` | session cookie | `{ "approvals": [approval] }` |
| `GET /v1/approvals/:id` | session cookie | `{ "approval": approval }` |
| `POST /v1/approvals/:id/approve` | `Idempotency-Key`, `{ "agentId"?, "reason"? }` | `{ "approval", "binding" }` |
| `POST /v1/approvals/:id/deny` | `Idempotency-Key`, `{ "reason"? }` | `{ "approval" }` |
| `POST /v1/approvals/:id/revoke` | `Idempotency-Key`, `{ "reason"? }` | `{ "approval", "binding" }` |
| `POST /v1/agents/:agentId/instances/:instanceId/revoke` | `Idempotency-Key`, `{ "reason"? }` | `{ "binding" }` |
| `GET /v1/activity` | session cookie | `{ "activity": [event] }` |

An approval includes the selected Agent, device metadata, `requestedScopes`, state, times, decision reason, and `allowedActions`. Short codes are intentionally not part of the authorization protocol.

WebAuthn routes are `/v1/auth/webauthn/registration/options`, `/registration/verify`, `/authentication/options`, and `/authentication/verify`. The verification routes issue a recently verified session.

New accounts require a username, password, and unique bound email address. Passwords are stored as salted `scrypt-v1` hashes and never appear in API responses, IBCs, or P2P messages. The email address can be used as a login identifier and to reset the password through a single-use, time-limited recovery code. Existing accounts without an email can bind one from the security page; email-code login remains available for legacy accounts.

## OAuth and IBC

`POST /oauth/device_authorization` and `POST /oauth/token` require `application/x-www-form-urlencoded`.

Device authorization requires `client_id`, `instance_id`, `instance_public_key`, `instance_label`, `platform`, `code_challenge`, and `code_challenge_method=S256`; `scope` and `agent_hint` are optional. `agent_hint` only preselects an Agent and never restricts the approving owner from selecting another managed Agent. The response is standard OAuth-shaped and its `verification_uri_complete` is a `WEB_ORIGIN` deep link containing only opaque `request_id`.

Agent owners can update an Agent name at `PATCH /v1/agents/:agentId` and manage members with `/v1/agents/:agentId/members` endpoints. Owner/Admin can manage devices; only Owner can change Agent metadata and membership. Mutations require an `Idempotency-Key`.

Token exchange requires the device grant, `client_id`, `device_code`, and PKCE `code_verifier`. Pending polls return OAuth `authorization_pending` or `slow_down` errors. A successful response contains both the canonical `instance_binding` compact JWS and temporary compatibility alias `ibc`, plus `expires_in`, public binding state, and `user_id_hash`. The response never contains the raw website `user_id`.

`GET /v1/instance-bindings/:jti/status` returns `{ "binding": ... }` for revocation checks. `GET /.well-known/jwks.json` returns the Ed25519 public JWK set.

Renewal uses `POST /v1/instance-bindings/:jti/renew/challenge` followed by a one-time InstanceIdentity signature at `/renew`; the issuer checks the instance ID and public key before rotating the binding JTI and IBC.

## Verify

```bash
npm run check
npm test
npm run build
```

The integration test covers the browser CORS/session contract, passkey enrollment and step-up enforcement, unhinted OAuth device authorization, deep-link shape, PKCE exchange, IBC JWKS verification, idempotent approval, and revocation.

## Operations

The service exposes `GET /health/live` for process liveness, `GET /health/ready` for PostgreSQL, migration, and issuer-key readiness, and keeps `GET /health` as a compatibility endpoint. Readiness returns HTTP `503` until all checks pass. Docker Compose uses `/health/ready` as its container healthcheck.

`GET /metrics` returns Prometheus text format with aggregate request, OAuth, renewal, revocation, authentication-failure, database-error, pending-authorization, rate-limit, process-start, and build metrics. It is restricted to `METRICS_ALLOWED_IPS`, which defaults to loopback. Do not expose it directly to the public Internet.

Rate limits are grouped by authentication, agent changes, approvals, binding status, binding renewal, and OAuth device/token endpoints. Each group accepts `RATE_LIMIT_<GROUP>_MAX` and `RATE_LIMIT_<GROUP>_WINDOW_SECONDS`; the defaults are intentionally usable for local development and should be tightened at the edge for production.

Create a PostgreSQL custom-format backup with:

```bash
npm run backup
```

`BACKUP_DIR` defaults to `./backups`; backup directories are forced to `0700` and dump files to `0600`. The command only invokes `pg_dump` and never reads or copies the issuer private key. Restore a dump with `pg_restore --clean --if-exists --dbname "$DATABASE_URL" path/to/agentid-*.dump` after stopping application writes and applying migrations. Verify the resulting file size and, where required, store a separate SHA-256 checksum in the backup system.

Structured operational warnings are emitted as JSON and intentionally contain only route/resource categories and counters. Prometheus rule examples are in `ops/agentid-alerts.yml`; connect them to the deployment's existing Alertmanager or equivalent without adding a monitoring vendor to this repository.
