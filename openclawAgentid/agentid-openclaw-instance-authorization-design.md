# AgentID 与 OpenClaw Instance 授权绑定设计

状态：Draft  
日期：2026-07-10  
范围：AgentID 网站、OpenClaw/libp2p-mesh 客户端与 P2P 实例发现协议

## 1. 目标

用户在 AgentID 网站注册账户并创建 Agent 后，可以在 OpenClaw 客户端中为该 Agent 创建实例。首次创建实例必须经网站中该 Agent 的管理者授权；授权成功后，实例可在不重复登录网站的前提下正常加入 P2P 网络和签名消息。

设计同时满足以下要求：

- 用户只需要进行一次明确的网页确认，客户端不收集用户密码。
- 一个 Agent 可绑定多个 OpenClaw 实例；单个实例可独立撤销。
- OpenClaw 的 P2P 路由和消息签名保持可用，未升级节点仍可通信。
- 不把姓名、证件号、原始 KYC 数据或其可枚举哈希发布到 DHT 或 P2P 网络。

## 2. 核心决策

采用四层身份，而不是让一种 ID 同时承担所有职责。

| 层级 | 标识 | 职责 | 生命周期 |
| --- | --- | --- | --- |
| 账户 | `userId` | 网站登录、Agent 所有权与管理权限 | 长期 |
| Agent | `agentId` | 用户可识别的稳定 Agent 身份 | 长期 |
| 实例 | `instanceId` | 一次 OpenClaw 部署的签名主体与 P2P 端点 | 可创建、轮换、撤销 |
| 网络 | `peerId` | libp2p 拨号与连接 | 本地节点生命周期 |

现有 `instanceId` 和 `peerId` 不替换。新增 `agentId` 与由 AgentID 服务签发的实例绑定凭证（Instance Binding Certificate，以下简称 IBC）。

IBC 证明：某个 `agentId` 的管理者已经授权特定 `instanceId` 使用特定实例公钥和权限运行。每条 P2P 消息仍由实例私钥签名；IBC 只建立实例到 Agent 的授权链。

### 2.1 绑定关系与权威边界

完整关系为：

```text
userId --(member role)--> agentId --(IBC)--> instanceId --(key ownership)--> instance public key
instanceId --(network route)--> peerId
```

`userId -> agentId` 是网站服务端的授权关系。推荐使用 `agent_members` 表而非只在 Agent 表保存单个 `owner_user_id`，以支持 `owner`、`admin`、`operator` 和 `viewer` 等角色。只有 `owner` 或 `admin` 可批准、续签或撤销实例绑定。

`agentId -> instanceId -> instance public key` 是 IBC 的密码学绑定关系。IBC 不携带 `userId`，P2P 节点也不需要知道哪个用户授权了该实例。这样用户账户信息不进入 DHT、P2P 公告或点对点消息。

网站服务端是成员关系、IBC 状态与审计记录的唯一事实来源；客户端保存自己的实例私钥、已签发 IBC，以及授权响应中可选的本地 `userId` 展示元数据；P2P 路由只保存发现和验证所需的公开信息。`userId` 不进入 IBC claims、P2P 公告或 P2P 消息。

## 3. 推荐授权方式

默认使用 OAuth 2.0 Device Authorization Grant（设备码授权）：客户端展示二维码和短码，用户在任意浏览器登录 AgentID 网站后确认。该流程适用于 CLI、插件及没有可靠浏览器回调的运行环境。

对于确定具备系统浏览器和本地回调能力的桌面客户端，可提供 Authorization Code + PKCE 快捷入口。两种入口最终都签发相同 IBC，不产生两套信任模型。

Passkey/WebAuthn 用于用户登录网站或确认高风险操作，不作为实例身份，也不取代实例密钥。

## 4. 首次绑定流程

### 4.1 客户端发起

用户执行：

```bash
openclaw agentid link --agent <agentId>
```

客户端执行以下动作：

1. 加载或创建现有 OpenClaw `instanceId` 及其 Ed25519 密钥对。
2. 生成随机 `code_verifier`，并计算 `code_challenge = S256(code_verifier)`。
3. 向 AgentID 服务请求设备授权，提交实例公钥、实例显示名、系统信息摘要和 `code_challenge`。
4. 在终端显示 `verification_uri_complete` 的二维码、短码、实例显示名和实例公钥指纹。
5. 按服务端返回的 `interval` 轮询授权结果，直至成功、拒绝或过期。

客户端不得提交用户密码、网站会话 Cookie、长期账户访问令牌或实例私钥。

### 4.2 用户网页确认

用户扫描二维码或访问官方网站后：

1. 使用已有 AgentID 账户登录；推荐 Passkey，密码和第三方登录可作为兼容方式。
2. 在授权页选择一个自己有 `instance:approve` 权限的 Agent。
3. 看到待授权实例的显示名、操作系统、发起时间、短码和公钥指纹。
4. 确认短码与客户端一致后，允许或拒绝该实例绑定。
5. 服务端签发 IBC，并将授权会话标记为可兑换。

页面必须明确显示权限范围、凭证有效期和撤销入口。对首次绑定、管理员权限或风险较高的权限变更，要求近期登录或 Passkey 二次确认。

### 4.3 客户端兑换与保存

客户端在 `POST /oauth/token` 中提交 `device_code`、`client_id` 与 `code_verifier`。服务端校验授权状态和 PKCE 后返回 IBC，而不是将网站的长期登录令牌交给客户端。

客户端保存：

- 现有实例私钥；
- IBC；
- IBC 到期时间、签发者标识和撤销检查所需元数据。

私钥和 IBC 应保存到系统密钥链或权限受限的状态目录。运行时不应向日志打印完整 IBC、授权码或密钥材料。

## 5. 接口契约

### 5.1 发起设备授权

```http
POST /v1/device-authorizations
Content-Type: application/json

{
  "client_id": "openclaw-libp2p-mesh",
  "agent_hint": "did:agentid:agt_01...",
  "instance_id": "alice-mac@MCowBQYDK2Vw.a91bd021",
  "instance_public_key": "base64url-spki",
  "instance_label": "Lin's MacBook",
  "platform": "darwin",
  "code_challenge": "base64url-sha256",
  "code_challenge_method": "S256"
}
```

响应中的 `device_code` 仅用于轮询，不在用户可见页面或日志中展示；`user_code` 可见但短时有效且限速校验。

```json
{
  "device_code": "opaque-secret",
  "user_code": "FJ8K-M4QN",
  "verification_uri": "https://id.example.com/device",
  "verification_uri_complete": "https://id.example.com/device?user_code=FJ8K-M4QN",
  "expires_in": 600,
  "interval": 5
}
```

### 5.2 IBC 内容

IBC 使用服务端签名的 JWS 或 COSE_Sign1；签名算法和发布的 issuer 公钥必须可轮换。逻辑载荷如下：

```json
{
  "iss": "https://id.example.com",
  "sub": "did:agentid:agt_01...",
  "aud": "openclaw-libp2p-mesh",
  "jti": "ibc_01...",
  "instance_id": "alice-mac@MCowBQYDK2Vw.a91bd021",
  "instance_public_key": "base64url-spki",
  "scope": ["p2p:announce", "p2p:message"],
  "iat": 1783641600,
  "exp": 1791417600
}
```

服务端数据库还需维护 `jti`、`agent_id`、`instance_id`、实例公钥指纹、状态、签发者、批准者 `user_id`、撤销时间和撤销原因。`agentId` 不应从用户姓名、证件号码、主机名或公钥截断值推导；应是不可预测、长期稳定的标识。

### 5.3 服务端存储与管理接口

最小生产数据模型如下：

```text
users(id)
agents(id, status, created_at)
agent_members(agent_id, user_id, role, status, created_at)
instances(instance_id, public_key_fingerprint, peer_id, label, platform)
instance_bindings(jti, agent_id, instance_id, issued_by_user_id, scopes, status, expires_at)
audit_events(actor_user_id, agent_id, instance_id, action, created_at)
```

典型网站接口包括：

- `GET /v1/me/agents`：返回当前登录用户可查看或管理的 Agent 与角色。
- `GET /v1/agents/{agentId}/instances`：返回该 Agent 已授权实例及凭证状态。
- `POST /v1/agents/{agentId}/instances/{instanceId}/revoke`：由 `owner/admin` 撤销实例。
- `GET /v1/instance-bindings/{jti}/status`：供客户端或验证方查询撤销状态。

客户端本地状态只需记录 `agentId`、`instanceId`、IBC、到期时间和 issuer 元数据；不需要持久化 `userId`。网站 UI 在“我的 Agent”中按 `agent_members.user_id` 展示 Agent，在 Agent 详情中展示成员、已授权实例、角色、到期时间和审计记录。

## 6. P2P 协议与校验

### 6.1 协议扩展

在现有 `instance-announce` 和需要身份语义的 `user-message` 中增加可选字段：

```json
{
  "agentId": "did:agentid:agt_01...",
  "instanceBinding": "compact-jws-or-cose"
}
```

`agentId` 必须与 IBC 的 `sub` 一致；接收端应从已验证的 IBC 导出可信 `agentId`，不能仅信任外层同名字段。`agentId` 和 `instanceBinding` 都必须被加入实例消息的规范化签名载荷；否则攻击者可在不破坏原消息签名的情况下替换外层绑定信息。

公告仍保留既有 `instanceId`、`peerId`、`multiaddrs` 和实例公钥字段。路由存储从单一映射扩展为：

```text
agentId -> [instanceId, peerId, publicKeyFingerprint, credentialStatus, lastSeenAt]
instanceId -> peerId
```

这允许按 `agentId` 发送时选择一个在线且授权有效的实例，也保留按 `instanceId` 精确寻址的能力。

### 6.2 接收端验证顺序

1. 验证消息 `from` 与实际远端 `peerId` 一致。
2. 使用消息中的实例公钥或 DHT 中登记的公钥验证实例消息签名。
3. 验证 IBC 的 issuer 签名、`aud`、时间窗口和 `instance_id`/实例公钥精确绑定。
4. 检查 IBC 是否已撤销；在线场景优先使用状态接口，离线时仅在缓存和短容忍期内接受。
5. 对应操作要求的 `scope` 必须包含在 IBC 中。

当前 libp2p-mesh 在 DHT 查不到公钥时会继续处理带签名消息。引入 IBC 后应增加 `identityVerificationMode`：`compat` 保持旧行为，`strict` 对要求 Agent 授权的消息在 IBC 或公钥验证缺失时拒绝。

### 6.2.1 AgentID 与 InstanceID 的绑定验证

接收端不能仅根据消息外层的 `agentId` 或 `instanceId` 判断身份，必须完成以下链式校验：

1. 使用消息中的 `pubkey`，或可信 DHT 登记的实例公钥，验证实例签名。签名载荷必须覆盖 `instanceId`、`pubkey`、`agentId`、`instanceBinding` 和消息正文；任一字段被篡改都会导致签名失败。
2. 使用可信 issuer 的 JWKS 验证 IBC Ed25519 JWS 签名，并检查 `iss`、`aud`、`kid`、`iat` 和 `exp`。
3. 精确匹配 IBC claims 与消息字段：
   - `IBC.sub == message.agentId`
   - `IBC.instance_id == message.instanceId`
   - `IBC.instance_public_key == message.pubkey`
4. 根据消息类型检查 scope：`instance-announce` 需要 `p2p:announce`，普通身份语义消息需要 `p2p:message`。
5. 使用 `(issuer, jti)` 查询或读取撤销状态缓存；只有 `active` 绑定可以继续通信，`revoked` 或 `expired` 必须拒绝。

因此，`agentId` 不是由 `instanceId` 计算出来的，而是由服务端签发的 IBC 明确声明：该 AgentID 被授权使用该 InstanceID 和该实例公钥。`userId -> agentId` 的关系只在网站服务端的 `agent_members` 中验证；P2P 交互方无需知道网站用户 ID。

### 6.3 离线验证、刷新与撤销状态

网站签名只发生在绑定、续签、撤销或用户/组织关系变更时，不发生在每一条 P2P 消息上。交互方使用缓存的 issuer 公钥（例如 issuer 的 JWKS）本地验证 IBC 的签名、`kid`、时间窗口、权限和实例公钥绑定，因此普通 P2P 消息不依赖网站实时可用。

按风险分层处理凭证新鲜度：

| 场景 | 默认校验 | 是否请求网站 |
| --- | --- | --- |
| 普通 P2P 消息 | 本地验签、有效期、scope 和本地撤销缓存 | 否 |
| 首次见到新 issuer 或未知 `kid` | 拉取并缓存 issuer 公钥 | 仅首次或密钥轮换时 |
| IBC 临近到期 | 客户端使用本机密钥发起续签 | 是 |
| 撤销列表/状态过期 | 刷新撤销状态缓存 | 定期，不在每条消息时 |
| 转账、管理员指令、跨组织高风险操作 | 本地验签后查询实时凭证状态 | 是，每次 |

建议初始参数：IBC 有效期 90 天；可选的用户/组织归属声明有效期 30 天；普通场景的撤销状态缓存最长 24 小时。高风险策略可要求零离线容忍期。网站不可达时，仅允许未过期且撤销缓存未过期的低风险操作继续进行。

IBC 已足以证明“网站授权该实例代表该 Agent”。只有交互方需要确认 Agent 的管理者身份、组织成员资格或实名等级时，才额外提供用户/组织归属声明（Ownership Attestation）。该声明由网站签名，最小内容为 `agentId`、伪名化主体、角色、保证等级和有效期；不得包含网站内部 `userId`、手机号、邮箱或实名信息。

```json
{
  "iss": "https://id.example.com",
  "sub": "did:agentid:agt_01...",
  "owner_subject": "did:agentid:user_01...",
  "owner_role": "owner",
  "assurance_level": "verified",
  "iat": 1783641600,
  "exp": 1786233600,
  "jti": "ownership_01..."
}
```

交互方验证该声明时，确认 issuer 签名有效、`sub` 与 IBC 的 `agentId` 相同、所需角色和保证等级满足策略，并按风险级别检查其撤销状态。若不同交互方之间不应关联同一用户，可按交互方签发不同的 `owner_subject`。

## 7. 生命周期与失败处理

授权会话状态：`pending -> approved | denied | expired -> exchanged`。`exchanged` 是终态，单个 `device_code` 只能兑换一次。

| 情况 | 客户端行为 | 网站行为 |
| --- | --- | --- |
| 用户拒绝 | 显示已拒绝，不保存凭证 | 记录审计事件 |
| 短码过期 | 重新发起授权 | 使 `device_code` 失效 |
| 轮询过快 | 按 `slow_down` 增加间隔 | 限速并告警 |
| IBC 到期 | 提前提示并静默续期；失败时要求再次确认 | 依据策略自动续签或要求批准 |
| 实例密钥丢失或重建 | 创建新绑定，不复用旧 IBC | 旧绑定可由用户撤销 |
| 用户撤销实例 | 立即停止使用 IBC，重新链接才可恢复 | 记录撤销并提供状态查询 |
| 服务端暂时不可达 | 已验证、未过期的 IBC 按短离线容忍期使用 | 恢复后同步撤销状态 |

初始有效期建议 90 天；高权限实例缩短有效期。撤销状态不应只依赖长时间 DHT 缓存。

## 8. 兼容与迁移

### 阶段 1：本地绑定

- 新增本地 `agentid-binding.json` 或密钥链记录。
- 增加 `openclaw agentid link`、`status`、`unlink` 命令。
- 不改现有 P2P 消息；未链接实例继续可运行。

### 阶段 2：公告与路由

- 在 `instance-announce` 中携带可选 `agentId` 和 IBC。
- 扩展实例路由表的 Agent 索引。
- 新增按 `agentId` 查询和发送的工具。

### 阶段 3：策略与撤销

- 实现 issuer JWKS、IBC 签名校验、撤销查询和凭证续期。
- 为敏感消息和跨组织场景启用 `strict` 模式。
- 提供网站端实例列表、最近活动、撤销和重新授权界面。

旧节点忽略未知字段；新节点在 `compat` 模式下接受无 IBC 的旧消息。严格模式只在组织策略明确启用后生效。

## 9. 非目标

- 第一阶段不上链、钱包签名、ZK-KYC 或去中心化 DID 解析网络。
- 不让网站持有 OpenClaw 实例私钥。
- 不使用浏览器模拟生成的 `AGT-...`、随机合约地址或模拟交易哈希作为生产信任根。
- 不通过静态客户端密钥、共享激活码或复制长期网站 Token 完成绑定。

## 10. 验收标准

- 用户可在 60 秒内完成首次授权，且只需要扫描二维码、登录和一次确认。
- 同一 Agent 的两个实例拥有不同实例密钥和 IBC；撤销其中一个不影响另一个。
- 伪造或替换实例公钥、修改 IBC 载荷、过期或已撤销 IBC 都无法通过严格校验。
- 客户端和日志中不出现用户密码、实例私钥、完整 `device_code` 或长期网站访问令牌。
- 未升级节点仍可按现有 `instanceId -> peerId` 通信；升级节点能够按 `agentId` 发现已授权实例。

## 11. 参考标准

- OAuth 2.0 Device Authorization Grant: RFC 8628
- OAuth 2.0 for Native Apps: RFC 8252
- PKCE: RFC 7636
- OAuth 2.0 Security Best Current Practice: RFC 9700
- Demonstrating Proof of Possession at the Application Layer (DPoP): RFC 9449
- Web Authentication (WebAuthn): W3C WebAuthn
