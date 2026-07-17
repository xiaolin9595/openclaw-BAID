# openclaw-BAID

AgentID and OpenClaw P2P integration demo.

## Contents

- `agentid-ui-demo/`: React/Vite AgentID console, public Agent discovery pages, device authorization UI, email authentication and WebAuthn flows.
- `agentid-service/`: TypeScript/Fastify identity service, PostgreSQL migrations, OAuth device authorization, AgentID/IBC issuance, binding status and operational endpoints.
- `openclawAgentid/libp2p-mesh/`: OpenClaw libp2p plugin with `agentid link --create-agent`, local IBC storage and verification, P2P AgentID message authentication, discovery and connection tools.
- `demo/`: local demo runner and recording helpers.
- `output/`: intentionally excluded local recordings and runtime output.

## Local development

Run the identity service and control-plane frontend from their respective directories. The local demo uses PostgreSQL and keeps credentials in ignored `.env` files. See the project documentation under `agentid-ui-demo/` and `openclawAgentid/libp2p-mesh/docs/` for the detailed flow.

## GitHub Pages

The web UI is deployed by `.github/workflows/deploy-pages.yml`. After GitHub
Pages finishes its first deployment, use:

- `https://xiaolin9595.github.io/openclaw-BAID/control-plane.html`
- `https://xiaolin9595.github.io/openclaw-BAID/agent-public.html`

For login, authorization, and registration to work from GitHub Pages, add a
repository variable named `AGENTID_API_URL` with the public HTTPS URL of the
AgentID service. An HTTP backend may be reachable directly, but browsers can
block requests from the HTTPS Pages site as mixed content.

## Security

Never commit API keys, session cookies, private keys, database data, or real email credentials. Use the provided `.env.example` files and inject secrets through the runtime environment.
