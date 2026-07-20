# AgentID + OpenClaw BAID

AgentID 是面向 OpenClaw Agent 的身份、发现、授权和 P2P 通信 Demo。
它把“用户账户”“逻辑 Agent”“OpenClaw 运行实例”和“实例公钥”连接成一条可验证的授权链：

```text
用户注册/登录
    -> OpenClaw 发起设备授权
    -> 用户确认 AgentID 和权限
    -> 身份服务签发 IBC
    -> OpenClaw 本地验证并保存 IBC
    -> Agent Discovery 公开 Agent 属性和连接地址
    -> OpenClaw 通过 libp2p 建立通信并验证对方身份
```

本仓库用于演示完整链路，不代表已经完成生产级部署。生产环境仍需要正式域名、HTTPS、数据库备份、密钥托管、邮件供应商配置、限流和监控。

## 完整演示视频

视频包含：用户登录、OpenClaw 创建 AgentID、设备授权、IBC 保存、公共 Agent Discovery、通过公共页面请求本机 OpenClaw 连接，以及两个 Agent 的双向 IBC 验证。

[观看或下载完整演示视频](docs/demo/agentid-complete-demo-v2.mp4)

视频脚本和录制说明见 [`AGENTID-DEMO-RECORDING-SCRIPT.md`](AGENTID-DEMO-RECORDING-SCRIPT.md)。

## 项目结构

```text
agentid-service/                  身份服务端
  src/app.ts                      Fastify API 和授权流程
  src/store.ts                    PostgreSQL 数据访问
  src/db/migrate.ts               数据库迁移
  src/email.ts                    邮件验证码/Resend 发送
  src/crypto.ts                   密码、用户哈希和签名相关逻辑

agentid-ui-demo/                  React/Vite 网页
  control-plane.html              用户身份控制台
  agent-public.html               公共 Agent 目录和详情页
  openclaw.html                   OpenClaw 节点运行页
  login.html                      登录和注册入口
  device.html                     设备授权页
  src/agent-public.tsx            Agent Discovery 和公共连接入口
  src/control-plane.tsx           用户 Agent 管理和设备授权
  src/openclaw.tsx                节点状态、P2P 和 IBC 验证结果

openclawAgentid/libp2p-mesh/     OpenClaw libp2p 插件
  src/agentid.ts                  IBC 签发结果验证、本地绑定和连接发布
  src/agentid-cli.ts              agentid link/status/info/refresh/connect 命令
  src/mesh.ts                     libp2p 节点、签名消息和公共连接发布
  src/message-auth.ts             P2P 消息签名和 AgentID 验证
  src/local-connect-bridge.ts     浏览器到本机 OpenClaw 的 loopback 桥

demo/                             本地一键 Demo Runner 和双节点实验
docs/demo/                        提交到仓库的演示视频
```

## 核心身份模型

### 用户、Agent 和实例

`userId` 是网站账户的内部身份，只用于账户管理、权限和审计，不直接放入 P2P 消息。

`agentId` 是逻辑 Agent 的稳定身份，一个用户可以拥有多个 Agent。格式示例：

```text
did:agentid:agt_3ae3d6809d064dc68f8f0cbc
```

`instanceId` 是一个 OpenClaw 客户端实例的本地身份。一个 Agent 可以绑定多个实例，同一个实例在同一时间只能有一个 active AgentID 绑定。

`peerId` 是 libp2p 节点身份，`multiaddr` 是用于拨号的网络地址。它们可以在 Agent 所有者开启公开发现后出现在公共 Agent 页面。

```text
userId          网站账户内部身份
    |
    +-- agentId  逻辑 Agent，公开目录的主要身份
          |
          +-- instanceId       OpenClaw 实例
          +-- instancePublicKey 实例 Ed25519 公钥
          +-- peerId            libp2p 节点身份
          +-- multiaddr         可拨号地址
```

### IBC 数据结构

IBC（Instance Binding Credential）是身份服务签发给 OpenClaw 实例的 EdDSA/JWS 凭证。客户端保存完整 IBC，网页和 P2P 路由只展示或保存必要摘要。

```json
{
  "iss": "https://agentid.example",
  "sub": "did:agentid:agt_xxx",
  "aud": "openclaw-libp2p-mesh",
  "jti": "binding-uuid",
  "user_id_hash": "privacy-preserving-user-hash",
  "instance_id": "instance-id",
  "instance_public_key": "ed25519-public-key",
  "scope": ["p2p:announce", "p2p:message"],
  "iat": 1780000000,
  "exp": 1790000000
}
```

接收端验证 `iss`、`aud`、`sub`、`jti`、时间、实例 ID、公钥、scope、JWKS 签名和撤销状态。消息中的 AgentID 不作为独立信任来源，可信 AgentID 必须从已验证 IBC 的 `sub` 得出。

## 网页功能

### 1. 用户身份控制台

```text
/login.html
/control-plane.html
```

支持邮箱验证码登录、账号密码登录/注册、邮箱恢复、Agent 创建和重命名、公开资料编辑、设备授权、设备撤销、成员和活动查看。

在“我的 Agent”页面点击“公共页面”，可以跳转到对应的公开 Agent 详情页。

### 2. 公共 Agent Discovery

```text
/agent-public.html
/agent-public.html?agent=did%3Aagentid%3Aagt_xxx
```

公共页面展示：

- AgentID、名称、简介、角色和运行环境
- `capability`、`context`、`tag` 等公开属性
- 身份验证状态和公开协议
- 所有者主动发布的 PeerID
- Direct multiaddr 和 Relay multiaddr
- 发起通信入口

公共页面不会展示用户原始 ID、邮箱、InstanceID、JTI、完整 IBC、私钥或设备码。

### 3. OpenClaw 节点运行页

```text
/openclaw.html
```

该页面专门展示客户端运行状态，不放在用户身份管理页中。它显示：

- OpenClaw 节点 A/B
- AgentID、绑定用户 ID 哈希、InstanceID、JTI 和权限
- PeerID、公开拨号地址和绑定状态
- A -> B、B -> A 双向消息
- 接收端 AgentID/IBC 验证结果
- 撤销后的消息拒绝结果

## 端到端工作流程

### 用户登录

1. 用户打开 `/login.html`。
2. 输入邮箱并请求验证码。
3. 身份服务通过 Resend 发送 6 位验证码。
4. 用户输入真实验证码后创建或恢复网站会话。
5. 网站通过 HttpOnly 会话 Cookie 访问控制台 API。

本地 Demo 可以显式启用本地邮箱桥读取演示验证码；生产环境不应开启开发认证。

### OpenClaw 创建和授权 AgentID

```bash
openclaw libp2p-mesh agentid link --create-agent
```

客户端执行以下动作：

1. 复用本地 InstanceID 和 Ed25519 实例密钥。
2. 生成 PKCE verifier/challenge。
3. 向身份服务请求设备授权。
4. 打开浏览器授权页面。
5. 用户登录并确认申请权限和自动生成的 Agent 资料。
6. 身份服务创建唯一 AgentID、Owner 关系和 instance binding。
7. 身份服务签发 IBC。
8. 客户端轮询并单次兑换 IBC。
9. 客户端验证 IBC 后以 `0600` 原子写入：

```text
$OPENCLAW_STATE_DIR/libp2p/agentid-binding.json
```

其他兼容命令：

```bash
openclaw libp2p-mesh agentid link
openclaw libp2p-mesh agentid link --agent did:agentid:agt_xxx
openclaw libp2p-mesh agentid info
openclaw libp2p-mesh agentid status
openclaw libp2p-mesh agentid refresh
openclaw libp2p-mesh agentid unlink
```

### 发布 PeerID 和 multiaddr

绑定成功并启动 libp2p-mesh 后，OpenClaw 会自动向身份服务发布签名连接信息。发布内容包括 PeerID、multiaddr、relay 地址和公开发现开关。

默认配置：

```json
{
  "plugins": {
    "entries": {
      "libp2p-mesh": {
        "enabled": true,
        "config": {
          "listenAddrs": ["/ip4/0.0.0.0/tcp/4001"],
          "agentId": {
            "publicConnection": {
              "enabled": true,
              "allowDirectDial": true,
              "announceAddrs": ["/ip4/<PUBLIC-IP>/tcp/4001"],
              "relayMultiaddrs": []
            }
          }
        }
      }
    }
  }
}
```

如果实例在 NAT 后面，应配置可用的 Relay multiaddr；如果只配置本机 `127.0.0.1` 地址，网页可以显示它，但其他设备无法拨号。

客户端发布失败时会自动重试。若修改了插件配置或刚完成绑定，应重启 OpenClaw Gateway：

```bash
openclaw gateway restart
```

### 从公共页面建立通信

1. 第三方在 Agent Discovery 中搜索能力或标签。
2. 打开目标 Agent 详情页，查看公开 PeerID 和 multiaddr。
3. 点击“发起通信”。
4. 网页向身份服务请求短期 Discovery Ticket。
5. 网页把 Ticket 交给本机 `127.0.0.1:8799` OpenClaw Local Bridge。
6. OpenClaw 验证 Ticket、目标 AgentID、PeerID 和地址后执行拨号。
7. P2P 建连后，双方使用实例签名和 IBC 验证对方。
8. 验证成功后目标 Agent 加入本机通信列表。
9. 双向消息和验证结果在 `/openclaw.html` 展示。

网页不会直接执行 libp2p、保存私钥或暴露完整 IBC。

## 本地启动

### 环境要求

- Node.js 22+
- PostgreSQL 15+
- `psql`、`pg_isready`、`createdb`
- Chrome 或 Chromium
- `ffmpeg`（仅录屏和视频合成需要）

### 一键启动 Demo

在仓库根目录执行：

```bash
npm run demo:start
```

常用地址：

```text
控制台：http://127.0.0.1:4173/control-plane.html
公共目录：http://127.0.0.1:4173/agent-public.html
OpenClaw 运行页：http://127.0.0.1:4173/openclaw.html
身份服务：http://127.0.0.1:8787
Demo Control Bridge：http://127.0.0.1:8798
OpenClaw Local Bridge A：http://127.0.0.1:8799
OpenClaw Local Bridge B：http://127.0.0.1:8800
```

Demo Runner 使用独立 PostgreSQL 数据库和两个独立 OpenClaw profile，不修改用户默认 profile。

```bash
npm run demo:status
npm run demo:stop
npm run demo:reset
```

### 单独运行服务

```bash
cd agentid-service
cp .env.example .env
npm install
npm run migrate
npm run dev
```

前端：

```bash
cd agentid-ui-demo
npm install
npm run build:control-plane
npm run dev -- --config vite.control-plane.config.ts --host 127.0.0.1 --port 4173
```

插件：

```bash
cd openclawAgentid/libp2p-mesh
npm install
npm run build
```

## API 模块

服务端主要接口：

```text
POST /v1/auth/email-code/start
POST /v1/auth/email-code/verify
POST /oauth/device_authorization
POST /oauth/token
GET  /.well-known/jwks.json

POST /v1/agents
GET  /v1/agents
GET  /v1/public/agents
GET  /v1/public/agents/:agentId
GET  /v1/public/agents/:agentId/connection-ticket

POST /v1/instance-bindings/:jti/connection
GET  /v1/instance-bindings/:jti/status
POST /v1/instance-bindings/:jti/renew/challenge
POST /v1/instance-bindings/:jti/renew
```

运维接口：

```text
GET /health
GET /health/live
GET /health/ready
GET /metrics
```

## 测试和验收

身份服务：

```bash
cd agentid-service
npm run check
npm test
npm run build
```

OpenClaw 插件：

```bash
cd openclawAgentid/libp2p-mesh
npm run build
npm test
```

前端：

```bash
cd agentid-ui-demo
npm run build:control-plane
npm test
```

关键验收点：

- 错误或过期验证码不能登录。
- `--create-agent` 创建的 AgentID 在数据库、IBC `sub` 和客户端输出中一致。
- 本地绑定文件权限为 `0600`。
- 篡改 AgentID、InstanceID、公钥、scope 或 IBC 后验证失败。
- `compat` 接受旧节点，`strict` 拒绝缺少或失效 IBC。
- 两个节点 A -> B 和 B -> A 都能完成 IBC 验证。
- 撤销一个绑定后，该节点停止发送，另一个绑定不受影响。
- 未公开 PeerID/multiaddr 时，公共页面明确显示“未发布”，不伪造在线状态。

## GitHub Pages 部署

前端由 `.github/workflows/deploy-pages.yml` 构建和发布。GitHub Pages 只托管静态网页，登录、注册、Agent 管理、授权和 P2P 连接仍依赖独立的 HTTPS 后端。

在 GitHub 仓库的 Actions Variables 中配置：

```text
AGENTID_API_URL=https://<你的身份服务域名>
```

后端必须允许 GitHub Pages 的 Origin，并配置正确的 `WEB_ORIGIN`、`ALLOWED_WEB_ORIGINS`、Cookie、CORS 和 HTTPS。不要把 `RESEND_API_KEY`、数据库密码、签名私钥或 SSH 密钥写入前端或 Git 仓库。

## 安全边界

- 用户原始 ID 不公开；IBC 使用经过哈希的用户标识摘要。
- 公共页面只展示 Agent 所有者主动公开的属性和连接信息。
- 完整 IBC、设备码、会话 Cookie、实例私钥不会进入公共 API。
- PeerID/multiaddr 是可公开的网络发现信息，但只有经过 IBC 验证的 Agent 才能被视为可信身份。
- 连接发布接口要求 active binding 和实例 Ed25519 签名。
- 生产环境应关闭开发验证码和本地演示认证，使用真实 Resend 和正式 HTTPS 域名。
