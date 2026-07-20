# AgentID Demo

## 启动

环境要求：Node.js 22、PostgreSQL 15+、`psql`/`pg_isready`/`createdb`，以及已经安装 Chrome。Docker 不是必需项；PostgreSQL 不可用时 Runner 会尝试 Docker Compose。

在项目根目录执行：

```bash
npm run demo:start
```

浏览器打开：<http://localhost:4173/control-plane.html>

Demo 使用数据库 `agentid_demo`、两个独立 OpenClaw profile（`agentid-demo-a`、`agentid-demo-b`）和本地控制桥。不会修改默认 OpenClaw profile。

## 演示步骤

1. 输入邮箱，点击“发送登录验证码”；本地 Demo 可点击“读取本地演示邮箱验证码”，线上环境使用 Resend 邮件中的真实验证码。
2. 把 6 位验证码填入登录表单并点击“验证并登录”。也可以先用“账号密码”创建账号，注册时通过邮箱验证码验证邮箱。
3. 在待授权列表打开 A 或 B 的请求，核对设备、公钥指纹、`p2p:announce`、`p2p:message` 权限，以及 OpenClaw 自动生成的 Agent 资料草稿。
4. 点击“创建并授权”。当前 Demo 的设备授权以已登录账户为授权依据，不再要求 Passkey 二次确认。
5. 打开顶部的“OpenClaw 运行页”，查看两个 OpenClaw 节点的 InstanceID、AgentID、绑定用户 ID、JTI、权限、PeerID、公开 multiaddr、状态和到期时间。
6. 在 OpenClaw 运行页点击“启动双向验证”，确认 A -> B 和 B -> A 都显示 `IBC 已验证`；通信时间线只在这个运行页显示。
7. 撤销 A 的绑定后，点击“撤销 A 后再次验证”，应看到 A 的消息被拒绝，而 B 仍可通信。

Demo 页面中的“读取本地演示邮箱验证码”只用于本地演示，不代表生产邮件链路。生产环境应使用 `EMAIL_PROVIDER=resend` 和真实 Resend 邮件；开发环境的 6 位备用认证必须显式开启，不能作为生产认证方式。

## 客户端对应关系

Runner 会为两个客户端执行：

```text
openclaw --profile agentid-demo-a libp2p-mesh agentid link --issuer http://localhost:8787
openclaw --profile agentid-demo-b libp2p-mesh agentid link --issuer http://localhost:8787
```

客户端生成各自的 InstanceID、实例 Ed25519 密钥和 PeerID。用户批准后，客户端轮询 OAuth token 接口并把 IBC 保存到各自 profile 的 `libp2p/agentid-binding.json`；网站和 Demo 控制桥只展示摘要。

## 控制桥

控制桥只监听 `127.0.0.1:8798`：

```text
GET  /demo/status
GET  /demo/events
GET  /demo/mailbox?email=...
POST /demo/p2p/start
POST /demo/reset
```

接口不会返回完整 IBC、私钥、设备码或 Cookie。

OpenClaw Gateway 的本机连接桥只监听 `127.0.0.1:8799`，第二个 Demo profile 使用 `127.0.0.1:8800`。公共 Agent 详情页点击“连接到本机 OpenClaw”时，会先获取短期 Discovery Ticket，再通过本机桥请求客户端拨号；网页不会直接执行 P2P 或保存私钥。

## 测试与清理

```bash
cd agentid-ui-demo
npm run test:demo
```

测试使用本机 Chrome 的 Virtual Authenticator。若系统未安装 Chrome，需先安装 Chrome；Playwright 自带浏览器缺失时可使用 `npx playwright install chromium`。

安装 `ffmpeg` 后可录制完整浏览器演示：

```bash
DEMO_RECORD=1 npm run test:demo
```

录屏文件会写入 `agentid-ui-demo/test-results/`。

停止和重置 Demo：

```bash
cd ..
npm run demo:stop
npm run demo:status
npm run demo:reset
```

`demo:reset` 只清理 Demo 数据库、两个 Demo profile 和本地控制状态。
