# AgentID 产品演示录屏脚本

## 1. 录制目标

这不是一段“展示代码”的视频，而是一段以用户任务为主线的产品演示。观众看完后应该能回答三个问题：

1. AgentID 是什么：Agent 的公开身份、能力资料和可信连接入口。
2. 用户怎么用：在公共目录发现 Agent，在控制台管理 Agent，再由 OpenClaw 客户端发起授权。
3. 为什么可信：网站授权设备，客户端保存 IBC，P2P 通信时验证 AgentID 与实例绑定关系。

推荐视频标题：

> AgentID：发现 Agent、授权 OpenClaw，并建立可验证的 Agent 通信

推荐成片时长：6-8 分钟。终端命令和输出必须清晰可读，不能只录浏览器页面。

## 2. 成片叙事

视频使用一个完整故事：

```text
第三方想找一个能完成任务的 Agent
  -> 在 AgentID 公共目录搜索并查看能力
  -> 登录控制台管理自己的 Agent
  -> OpenClaw 客户端发起创建 AgentID 的请求
  -> 用户核对权限并批准设备
  -> OpenClaw 获取并保存 IBC
  -> 新 Agent 出现在公共目录
  -> 两个 OpenClaw 节点建立 P2P 通信并验证 IBC
  -> 撤销一个设备后，后续消息被拒绝
```

旁白不要从数据库、JWT、接口名称开始。先说明用户要完成什么，再在需要的时候解释技术实现。

## 3. 录制前准备

### 3.1 画面和设备

- 浏览器窗口：1440x900 或 1280x720，缩放 100%-110%。
- 终端窗口：至少 120 列，字体 16-18px，确保命令和输出同时出现在一帧中。
- 浏览器只录 AgentID 网站，不录 Gmail 收件箱。录制过程中由 Codex 在已登录的 Gmail 页面读取最新 AgentID 验证邮件，再把验证码输入 AgentID 页面；Gmail 页面不进入成片。
- 使用两个不同的 OpenClaw profile 和两个不同的实例，不能用同一个 Agent 自己连接自己，否则会出现 `Tried to dial self`。
- 做 P2P 连接演示时，目标 Agent 必须已公开可发现地址（`allowDiscovery` 和至少一个可拨号地址）。

### 3.2 启动本地 Demo

在项目根目录执行：

```bash
cd "/Users/lin/Downloads/AgentIDDemo"
npm run demo:start
npm run demo:status
```

打开：

```text
http://127.0.0.1:4173/control-plane.html
```

启动后确认：

- AgentID 服务可用：`http://127.0.0.1:8787/health/ready`
- Demo Control Bridge 可用：`http://127.0.0.1:8798/demo/status`
- 本机 OpenClaw 连接桥可用：`http://127.0.0.1:8799/v1/local/status`
- 节点 A 和 B 使用不同 profile、Instance ID 和实例公钥。

快速检查命令：

```bash
curl -sS http://127.0.0.1:8787/health/ready
curl -sS http://127.0.0.1:8798/demo/status
curl -sS http://127.0.0.1:8799/v1/local/status
```

如果录制线上环境，浏览器使用：

```text
https://agentid-baid.site/agent-public.html
https://agentid-baid.site/control-plane.html
```

线上客户端应把 `agentId.issuer` 配置为 `https://agentid-baid.site`。生产环境不要把线上地址作为 `--issuer` 参数传给客户端；插件当前要求线上 issuer 通过配置的可信 issuer 注入。只有本地 loopback 开发 issuer 才使用 `--issuer http://127.0.0.1:8787`。

### 3.3 录制安全检查

可以展示：AgentID、Instance ID、JTI、公钥指纹、权限和状态。

必须遮挡：

- 实例私钥。
- 完整 IBC/JWS 内容。
- OAuth `device_code`、客户端 secret、Cookie。
- Resend API Key。
- 邮箱验证码本身（除非用户明确要求展示测试输入）。

## 4. 分镜和旁白

### 镜头 0：一句话说明产品（15-20 秒）

**画面**：AgentID 公共目录首页，列表、搜索框、能力筛选和 Agent 卡片同时出现。

**动作**：镜头从列表扫到搜索和筛选，不要停留在 Logo 或空白 Hero 区域。

**旁白**：

> AgentID 是 Agent 的身份和发现入口。用户可以按能力找到 Agent，查看它公开的资料；OpenClaw 则负责在本地持有实例身份，并在通信前验证对方是否真的拥有这个 Agent 的授权。

**屏幕字幕**：

```text
发现 Agent -> 查看能力 -> 授权设备 -> 验证通信
```

### 镜头 1：第三方发现 Agent（35-45 秒）

**画面**：`agent-public.html` 公共目录。

**动作**：

1. 在搜索框输入 `research` 或 `p2p`。
2. 展示结果列表中的 Agent 名称、简介、能力、标签和运行上下文。
3. 点击一张 Agent 卡片进入详情页。
4. 展示详情页的“能力”“标签”“运行上下文”“身份已验证”和“连接入口”。

**旁白**：

> 公共页面只展示适合发现的信息，不展示用户账户、完整 IBC、私钥或设备内部信息。能力和运行上下文来自 Agent 的公开资料，第三方可以先判断它是否适合自己的任务，再决定是否建立通信。

**必须录到的结果**：

- 至少一个能力属性，例如 `research`、`web-search` 或 `data-analysis`。
- 至少一个领域或上下文，例如 `finance`、`education`、`OpenClaw Gateway`。
- AgentID 和“身份已验证”状态。

### 镜头 2：进入控制台并登录（35-50 秒）

**画面**：从公共页面点击“控制台”，进入 `control-plane.html` 的登录界面。

**动作**：推荐录制真实用户路径：

1. 点击“账号密码”下的“创建账号”。
2. 输入账号、密码、邮箱和显示名称。
3. 点击“发送注册验证码”。
4. 暂停录制，在真实邮箱中读取 Resend 发来的验证码；不录邮箱页面。
5. 回到网站手动输入 6 位验证码。
6. 点击“验证邮箱并创建账号”。
7. 等待跳转到“我的 Agent”。

已有账号的第二次录制可以直接使用：

1. 输入账号和密码登录；或
2. 切换到“邮箱登录 / 恢复”，输入绑定邮箱、真实 Resend 验证码，点击“验证并登录”。

**旁白**：

> 注册账号和 Agent 身份是两层概念。邮箱用于验证和恢复用户账号；AgentID 是由身份服务生成、由用户管理的 Agent 身份。登录后，用户可以管理自己的 Agent、公开资料和授权设备。

**必须录到的结果**：

- 登录页面不是一闪而过，要完整录到输入邮箱、发送验证码、输入验证码和成功跳转。
- 控制台显示当前用户和“身份服务已连接”。

### 镜头 3：客户端发起创建 AgentID（50-70 秒）

**画面布局**：浏览器在左侧，终端在右侧；随后切到全屏终端录命令和输出。

**终端命令**：

```bash
cd "/Users/lin/Downloads/AgentIDDemo/openclawAgentid/libp2p-mesh"
node_modules/.bin/openclaw \
  --profile agentid-demo-a \
  libp2p-mesh agentid link \
  --create-agent \
  --issuer http://127.0.0.1:8787
```

本地 Demo 可以使用上面的 loopback issuer。线上录制时，先在 OpenClaw profile 中配置：

```text
agentId.issuer = https://agentid-baid.site
agentId.trustedIssuers = [https://agentid-baid.site]
```

然后使用：

```bash
openclaw --profile agentid-demo-a libp2p-mesh agentid link --create-agent
```

**终端必须录到**：

- 输入的完整命令。
- 客户端生成设备授权请求。
- 设备名称、权限范围和授权网址或短码。
- 客户端等待网站批准的状态。

**旁白**：

> 这一步由 OpenClaw 客户端发起。客户端使用当前实例的身份密钥生成设备证明和 PKCE 请求，同时生成 Agent 资料草稿。`--create-agent` 表示不绑定已有 Agent，而是请求身份服务在用户批准后创建一个新的 AgentID。

**安全提示字幕**：

```text
私钥只留在 OpenClaw 本地；网站只接收公钥指纹和授权请求信息。
```

### 镜头 4：网站核对并授权（55-75 秒）

**画面**：切换到控制台“待授权”页面，打开对应设备请求。

**动作**：依次移动鼠标指向：

1. 设备名称和平台。
2. 公钥指纹。
3. 申请权限：`p2p:announce`、`p2p:message`。
4. “将创建新的 AgentID”。
5. “OpenClaw 自动生成的资料草稿”，包括简介、能力、标签和运行上下文。
6. 点击“创建并授权”。

**旁白**：

> 用户在授权前能看到设备是谁、使用哪一个公钥、申请哪些权限，以及 OpenClaw 为这个 Agent 生成的公开资料草稿。确认后，身份服务在一次事务中创建 AgentID、保存 Owner 关系和公开资料，并为这台设备签发绑定凭证。

**必须录到的结果**：

- 授权请求从“待授权”列表消失。
- 页面出现“设备已获授权，客户端现在可以兑换绑定凭证”。
- 不能把批准按钮和终端轮询剪成看不出先后的镜头。

### 镜头 5：客户端兑换并保存 IBC（35-50 秒）

**画面**：回到终端，保持命令和输出在同一屏。

**终端动作**：等待客户端轮询完成，然后执行：

```bash
node_modules/.bin/openclaw \
  --profile agentid-demo-a \
  libp2p-mesh agentid status
```

如果需要展示本地文件存在，但不展示完整内容：

```bash
ls -l "$HOME/.openclaw-agentid-demo-a/extensions/libp2p-mesh" \
  "$HOME/.openclaw-agentid-demo-a/libp2p/agentid-binding.json"
```

**旁白**：

> 客户端轮询到批准结果后，从 IBC 的 `sub` 读取服务端生成的 AgentID，验证 issuer、公钥、Instance ID、scope、有效期和签名，然后把绑定文件以受保护权限写入本地。完整 IBC 不需要出现在网页上，也不需要发送给第三方。

**终端必须录到的字段**：

- AgentID。
- Instance ID。
- binding 状态 `active`。
- JTI。
- 权限范围。
- 到期时间。
- 本地绑定文件权限为 `0600`（如果命令输出可读）。

### 镜头 6：新 Agent 出现在公共目录（30-45 秒）

**画面**：刷新公共目录，搜索刚创建的 AgentID 或 Agent 名称，再进入详情页。

**动作**：

1. 展示新 Agent 卡片从服务端目录加载。
2. 点击详情页。
3. 展示 OpenClaw 自动提交的简介、能力、标签、上下文和身份状态。
4. 回到控制台“我的 Agent -> 公开资料”，展示资料来源和可编辑字段。

**旁白**：

> Agent 创建不是只生成一个字符串。OpenClaw 同时提交了资料草稿，身份服务保存后，公开目录就能用这些属性帮助第三方发现它。用户仍然可以在控制台修改公开资料；私密账户信息和设备技术详情不会进入公共页面。

**必须录到的结果**：

- 公共页和控制台显示同一个 AgentID。
- 至少显示能力、标签和运行上下文三组属性。
- 公共页不出现完整 IBC、用户邮箱或私钥。

### 镜头 7：两个 OpenClaw 节点建立并验证通信（70-100 秒）

**前置条件**：节点 A 和 B 必须是两个不同实例；目标 Agent 已公开可拨号地址。若当前 Demo 使用双节点面板，先确保两个请求都完成授权。

**终端命令**：分别在两个终端启动或查看节点：

```bash
openclaw --profile agentid-demo-a libp2p-mesh agentid status
openclaw --profile agentid-demo-b libp2p-mesh agentid status
```

**浏览器动作**：

1. 在公共详情页点击“连接到本机 OpenClaw”或“发起通信”。
2. 展示网站获取短期 Discovery Ticket。
3. 展示本机 OpenClaw 连接桥收到请求。
4. 展示客户端拨号、交换身份语义消息和验证结果。
5. 在控制台 Demo 面板点击“启动双向验证”。

**旁白**：

> 公共网页不直接持有私钥，也不直接执行 P2P。网页把目标 AgentID 和短期连接票据交给用户本机的 OpenClaw 连接桥，由客户端完成拨号。接收端先验证实例签名，再验证 IBC 的 issuer、AgentID、Instance ID、公钥、权限和撤销状态。

**画面必须同时说明**：

```text
A -> B：IBC 已验证
B -> A：IBC 已验证
```

如果页面显示 `Tried to dial self`，不要把它当成正常成功结果。说明当前浏览器连接的是自己，改用 B 的公开 Agent 或启用两个不同 OpenClaw profile 后重新录制。

### 镜头 8：撤销后拒绝（35-50 秒）

**画面**：控制台“我的 Agent -> 设备”，打开节点 A 的设备详情。

**动作**：

1. 点击“撤销设备授权”。
2. 输入设备名称完成确认。
3. 回到 Demo 面板，点击“撤销 A 后再次验证”。
4. 展示 A 的后续消息被拒绝，B 的绑定仍保持 active。

**旁白**：

> 撤销的是设备绑定，不是把 Agent 从公共目录删除。服务端状态变为 revoked，客户端刷新缓存后停止代表这个 Agent 发送消息；另一台仍然有效的设备不受影响。这说明 AgentID、用户关系和 Instance 绑定是分开的，权限可以被单独回收。

**必须录到的结果**：

- A：`revoked` 或发送被拒绝。
- B：仍显示 `active` 或通信成功。
- 公共 Agent 资料仍然存在，除非用户另行关闭公开发布。

### 镜头 9：结尾总结（15-20 秒）

**画面**：三栏或三段快速回放：公共目录、控制台、终端验证结果。

**旁白**：

> AgentID 把三个动作连成一条用户流程：先发现合适的 Agent，再由用户授权可信的 OpenClaw 设备，最后由客户端在 P2P 通信中验证身份和绑定关系。用户看到的是 Agent 的能力和状态，私钥和完整凭证始终留在客户端或身份服务的受保护边界内。

**结束字幕**：

```text
发现 Agent
授权设备
保存 IBC
验证通信
```

## 5. 录制顺序检查表

录制前逐项打勾：

- [ ] 公共目录有至少两个可展示的 Agent。
- [ ] 新建的两个 Agent 使用不同的 Instance ID 和 Peer ID。
- [ ] 至少一个目标 Agent 的 `allowDiscovery` 为 true，并有可拨号地址。
- [ ] 用户账号可以登录，Resend 验证邮件可到达。
- [ ] 控制台登录后能看到“我的 Agent”和“待授权”。
- [ ] OpenClaw 插件已构建：`cd openclawAgentid/libp2p-mesh && npm run build`。
- [ ] 本地 8799 连接桥正在运行。
- [ ] 终端录屏会保留命令和对应输出，不只录最终结果。
- [ ] 私钥、完整 IBC、设备码、Cookie、Resend API Key 已从画面中排除。
- [ ] 录制开始前保存一次干净状态，便于失败后重置：`npm run demo:reset`。

## 6. 现有脚本与分镜的对应关系

当前仓库已有自动录制脚本，可以按下面的对应关系使用；它们是辅助脚本，不能替代面向观众的完整叙事。

| 录制内容 | 现有脚本 | 用途 |
| --- | --- | --- |
| OpenClaw 创建 AgentID | `demo/record-openclaw-agent-creation.mjs` | 终端命令、网站授权、客户端保存 IBC |
| 本地客户端注册 | `demo/record-local-openclaw-registration.mjs` | 本地开发链路和终端画面 |
| 真实邮箱登录 | `demo/record-real-email-login.mjs` | 登录页面、验证码输入和登录结果 |
| 双节点与撤销 | `demo/record-demo.mjs`、`demo/record-one-by-one.mjs` | 授权、双向 P2P、撤销后的拒绝 |
| 公共 Agent 详情页 | `agentid-ui-demo/scripts/record-public-profile.mjs` | 目录、详情和公开属性 |

建议最终成片按“镜头 0-9”剪辑，而不是按脚本文件顺序拼接。每个流程都保留“用户动作 -> 系统反馈 -> 用户得到什么”的闭环。

## 7. 推荐成片文件

```text
output/recordings/agentid-user-journey.mp4
output/recordings/agentid-user-journey-subtitles.srt
output/recordings/agentid-user-journey-terminal-a.png
output/recordings/agentid-user-journey-terminal-b.png
```

至少保留以下关键截图作为视频封面或章节转场：

1. 公共 Agent 列表和能力筛选。
2. OpenClaw 终端输入 `agentid link --create-agent` 及其输出。
3. 网站授权页面中的 AgentID 草稿和权限。
4. 客户端 `agentid status` 输出。
5. 双向 P2P 的 `IBC 已验证`。
6. 撤销 A 后的拒绝结果。

## 8. 录制后的验证

视频完成后，重新检查观众是否能在不看代码的情况下说出：

- AgentID 用来发现和识别 Agent，不是普通用户账号。
- 用户先登录，OpenClaw 再发起设备授权。
- AgentID 是服务端创建的，OpenClaw 从授权返回的 IBC 中读取并保存。
- 公开属性用于发现，完整凭证和私钥不公开。
- P2P 通信成功的依据是接收端验证了 IBC 与实例签名。
- 撤销后，失效设备不能继续通信，但同一 Agent 的其他有效设备仍可工作。

如果观众只能看到“页面跳转”和“按钮点击”，却说不出这六点，说明需要补录旁白、终端输出或身份验证结果，而不是继续增加装饰画面。
