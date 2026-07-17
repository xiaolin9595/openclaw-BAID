# libp2p-mesh 插件系统设计文档

## 1. 背景与目标

`libp2p-mesh` 是一个面向 OpenClaw 的 P2P 通信插件。它把多个 OpenClaw gateway 实例连接成一个去中心化 mesh 网络，使 agent 可以绕过中心服务器，直接向远端实例、远端 peer 或一组具备特定属性的用户发送消息。

插件的核心目标：

- 提供 OpenClaw 插件入口，随 gateway 启动自动激活。
- 使用 libp2p 建立跨机器 P2P 网络，支持 LAN 和 WAN 场景。
- 为 OpenClaw 暴露 channel、agent tools、CLI、hook 和 service。
- 在 libp2p Peer ID 之上建立稳定的 OpenClaw Instance ID 路由层。
- 支持入站消息投递到本地已配置的 OpenClaw channel，例如飞书等。
- 支持 public attributes 和本地 labels 的实例分组发送。

## 2. 插件宿主集成模型

插件有两类入口元数据：

- `index.ts`：运行时插件定义，通过 `definePluginEntry()` 暴露给 OpenClaw。
- `openclaw.plugin.json`：插件清单，描述激活策略、channel、配置 schema、工具 contract 和 UI hints。

运行时插件定义如下：

- `id`: `libp2p-mesh`
- `name`: `libp2p Mesh Network`
- `activation.onStartup`: true
- `register`: `registerLibp2pMesh`
- `configSchema`: libp2p 网络、NAT、入站投递和 ACK 超时等配置。

宿主加载插件后，会调用 `registerLibp2pMesh(api)`。插件通过 `OpenClawPluginApi` 注册以下能力：

- `api.registerService()`：管理 libp2p 节点生命周期。
- `api.registerChannel()`：注册 `libp2p-mesh` chat channel。
- `api.registerTool()`：注册 P2P agent tools。
- `api.registerCli()`：注册 `openclaw libp2p-mesh ...` 命令。
- `api.registerHook("message:received")`：用于观测 OpenClaw 收消息事件。

## 3. 总体架构

核心模块分层如下：

```text
OpenClaw Plugin Host
  |
  |-- index.ts / openclaw.plugin.json
  |
  |-- src/plugin.ts
      |
      |-- MeshNetwork                  src/mesh.ts
      |   |-- libp2p node
      |   |-- protocol /openclaw-msg/1.0.0
      |   |-- peer discovery / transport / NAT traversal
      |   |-- message signing and verification
      |
      |-- InstanceRouter               src/instance-router.ts
      |   |-- instance announce
      |   |-- instanceId -> peerId routing
      |   |-- user-message / delivery-ack protocol
      |   |-- attribute-based fanout
      |
      |-- ChannelPlugin                src/channel.ts
      |   |-- OpenClaw outbound channel adapter
      |
      |-- InboundDeliveryAdapter       src/inbound-delivery.ts
      |   |-- deliver received P2P messages to configured OpenClaw channels
      |
      |-- Agent Tools                  src/agent-tools.ts
      |-- CLI                          src/profile-cli.ts, src/setup-cli.ts, ...
      |-- Persistent Stores            src/*-store.ts
```

`src/plugin.ts` 是运行时组装点。它读取 `api.pluginConfig`，应用默认配置，创建 mesh、router、store、delivery adapter，并把这些对象注册到 OpenClaw 宿主。

## 4. 生命周期

### 4.1 注册阶段

`registerLibp2pMeshWithDeps()` 执行以下操作：

1. 使用 `applyDefaultMeshConfig()` 合并默认配置。
2. 异步自动安装 AGENTS.md 中的插件提示词区块。
3. 创建 `MeshNetwork`。
4. 通过 `setLibp2pMeshRuntime(mesh)` 保存运行时引用，供 bundled channel 懒加载。
5. 创建持久化 store：
   - `instance-peer.json`
   - `peer-labels.json`
   - `user-profile.json`
6. 创建 `InstanceRouter`。
7. 注册 CLI、service、channel、tools 和 hook。

### 4.2 Service start

OpenClaw 启动插件 service 时执行：

1. `router.attachHandlers()` 注册 mesh 消息和 peer connect 监听。
2. `attachInboundHandlers()` 注册 direct/broadcast 的兼容入站处理。
3. `mesh.start()` 创建并启动 libp2p 节点。
4. `router.announceToConnectedPeers()` 向已连接 peer 宣告本实例。
5. 记录 Peer ID、Instance ID、NAT 服务和 relay reservation 状态。
6. 延迟开启 public attributes refresh，默认延迟 10 秒。

启动逻辑具有幂等保护：

- `serviceStarted` 避免重复启动。
- `startPromise` 让并发启动等待同一个启动过程。
- 启动失败会清理 inbound handler、router、mesh 和 runtime 引用。

### 4.3 Service stop

停止阶段执行：

1. 等待正在进行的启动结束。
2. 清理 public attribute refresh timer。
3. 清空 `runtime-setter-api` 中的 mesh 引用。
4. 注销 inbound handler。
5. 停止 router。
6. 停止 libp2p 节点。

router 停止时会取消 pending ACK，避免工具调用永久等待。

## 5. MeshNetwork 设计

`MeshNetwork` 是插件底层网络抽象，由 `src/mesh.ts` 实现。

### 5.1 libp2p 协议

插件使用自定义协议：

```text
/openclaw-msg/1.0.0
```

消息使用 JSON 编码，通过 `it-length-prefixed` 做长度前缀分帧。所有结构化消息都符合 `P2PMessage`：

```ts
interface P2PMessage {
  id: string;
  type: P2PMessageType;
  from: string;
  to?: string;
  topic?: string;
  payload: string;
  timestamp: number;
  instanceId?: string;
  pubkey?: string;
  signature?: string;
}
```

支持的消息类型：

- `direct`
- `broadcast`
- `agent-sync`
- `instance-announce`
- `user-message`
- `delivery-ack`

### 5.2 传输与发现

默认网络配置由 `applyDefaultMeshConfig()` 提供：

- `discovery`: `mdns`
- `enableNATTraversal`: true
- `enableDHT`: true
- `deliveryAckTimeoutMs`: 15000

实际发现策略由 `planPeerDiscovery()` 决定：

- mDNS：默认开启，适合 LAN。
- bootstrap：当 `bootstrapList` 非空时启用。
- DHT：默认开启，用于 WAN 发现和 pubkey registry。

传输层默认使用 TCP，可选 WebSocket。加密和多路复用分别使用 Noise 和 mplex。

### 5.3 NAT traversal

当 `enableNATTraversal !== false` 时，插件按配置启用：

- identify
- AutoNAT
- UPnP/PMP
- Circuit Relay v2 transport
- 可选 Circuit Relay v2 server
- DCUtR hole punching

`relayList` 会被自动转换成 `/p2p-circuit` listen 地址，用于 relay reservation。发送时如果没有现有连接，`writeMessageToPeer()` 会尝试通过配置的 relay path 预拨号，再打开 `/openclaw-msg/1.0.0` stream。

### 5.4 身份与签名

节点有两层身份：

- libp2p Peer ID：网络层身份，保存在 `peer-id.json`。
- OpenClaw Instance ID：应用层身份，由 `instance-id.ts` 生成，包含名称、公钥和环境绑定 hash。

发送消息时，`buildSignedMessage()` 会把以下字段序列化后签名：

- `id`
- `type`
- `from`
- `to`
- `topic`
- `payload`
- `timestamp`
- `instanceId`

接收时会进行两类校验：

- `from` 必须与实际 remote peer 匹配，broadcast 除外。
- 如果存在 `instanceId` 和 `signature`，优先通过 DHT 查 pubkey 并验证签名；兼容入站路径也支持用消息内携带的 `pubkey` 验证。

## 6. InstanceRouter 设计

`InstanceRouter` 位于 `MeshNetwork` 之上，负责把不稳定的 Peer ID 连接升级为稳定的 Instance ID 路由。

### 6.1 Instance announce

每个实例连接到 peer 后发送 `instance-announce`：

```ts
interface InstanceAnnouncePayload {
  instanceId: string;
  peerId: string;
  instanceName?: string;
  multiaddrs: string[];
  pubkey?: string;
  userPublicAttributes?: UserPublicAttribute[];
  announcedAt: number;
}
```

接收 announce 时会校验：

- payload 必须完整。
- `msg.instanceId === payload.instanceId`。
- `payload.peerId === msg.from`。
- 不处理本地自己的 instanceId。

校验通过后，router 调用 `InstancePeerStore.upsertFromAnnounce()` 写入 `instance-peer.json`，形成 `instanceId -> peerId` 路由表。如果第一次收到对方 announce，会反向 announce 一次，实现双向发现。

### 6.2 user-message 与 delivery-ack

面向用户的可靠投递使用 `user-message`：

```ts
interface UserMessagePayload {
  messageId: string;
  fromInstanceId: string;
  toInstanceId: string;
  text: string;
  metadata: {
    allowAgentAutoReply: boolean;
    replyToInstanceId: string;
    replyTool: "p2p_send_instance_message";
  };
}
```

发送流程：

1. `p2p_send_instance_message` 调用 `router.sendInstanceMessage()`。
2. router 从 `instance-peer.json` 解析目标 `instanceId` 对应的 `peerId`。
3. 创建 `messageId` 和 pending ACK。
4. 通过 `mesh.sendStructuredMessage()` 发送 `user-message`。
5. 等待远端 `delivery-ack`，默认超时 15 秒。

接收流程：

1. `handleUserMessage()` 解析 payload。
2. 校验 `msg.instanceId` 和 `fromInstanceId` 匹配。
3. 校验本地路由表中 sender instance 确实对应当前 `msg.from`。
4. 校验 `toInstanceId` 是本地实例。
5. 根据 `inboundTargets` 或 legacy `inboundChannel/inboundTarget` 投递到 OpenClaw channel。
6. 生成 `delivery-ack` 返回发送方。

ACK payload：

```ts
interface DeliveryAckPayload {
  ackFor: string;
  ok: boolean;
  inboundChannel?: string;
  inboundTarget?: string;
  results?: DeliveryTargetResult[];
  deliveredAt: number;
  error?: string;
}
```

router 维护 `deliveryCache`，相同 `messageId` 重复到达时直接返回缓存 ACK，避免重复投递。

### 6.3 入站多目标投递

新配置优先使用 `inboundTargets`：

```json
{
  "inboundTargets": [
    { "id": "feishu-main", "channel": "feishu", "target": "user:ou_xxx" },
    { "id": "group-chat", "channel": "feishu", "target": "chat:oc_xxx" }
  ]
}
```

行为规则：

- `inboundTargets` 存在时覆盖 `inboundChannel/inboundTarget`。
- `inboundTargets: []` 表示禁用入站投递。
- 重复的 `channel + target` 会去重。
- 单个目标失败不会阻止其他目标尝试。
- 只要至少一个目标投递成功，ACK 的 `ok` 为 true。

### 6.4 属性分组发送

router 支持按属性选择目标实例：

- public attributes：远端实例通过 announce 广播的公开属性。
- local labels：本机在 `peer-labels.json` 中为远端实例维护的本地标签。

`p2p_send_user_attribute_message` 支持：

- `selector`: `group=实验室`、`project=小龙虾`、`tag:P2P`、`#P2P`
- `scope`: `public`、`local`、`all`
- `dryRun`: true 时只预览匹配目标，不发送。

发送前建议先 dry run。实际发送时，router 会对每个匹配实例逐个调用 `sendInstanceMessage()`，并汇总 sent/delivered/failed。

## 7. Channel 设计

`src/channel.ts` 使用 `createChatChannelPlugin()` 注册一个 OpenClaw channel：

- channel id：`libp2p-mesh`
- chatTypes：`direct`
- media：false
- blockStreaming：false
- deliveryMode：`gateway`

channel 的 target 被视为 libp2p Peer ID。`sendText()` 调用 `sendViaMesh()`，最终走 `mesh.sendToPeer()`，发送 `direct` 类型消息。

这个 channel 主要是轻量调试和兼容层。面向稳定业务投递时，更推荐使用 instance-level tool：`p2p_send_instance_message`，因为它支持 Instance ID 路由、远端入站 channel 投递和 ACK。

## 8. Agent Tools

插件自动注册以下工具：

| Tool | 作用 |
| --- | --- |
| `p2p_send_message` | 通过 Peer ID 发送 direct 消息 |
| `p2p_broadcast` | 向 topic 广播消息 |
| `p2p_list_peers` | 查看当前已连接 libp2p peers |
| `p2p_get_instance_identity` | 查看本地 Instance ID |
| `p2p_get_network_info` | 查看 Peer ID、Instance ID、监听地址和连接数 |
| `p2p_list_instances` | 查看已发现的 OpenClaw instances 和属性 |
| `p2p_resolve_instance` | 将 Instance ID 解析为 Peer ID route |
| `p2p_send_instance_message` | 向远端 Instance ID 发送用户消息并等待 ACK |
| `p2p_send_user_attribute_message` | 按 public/local 属性分组发送 |

工具结果同时包含：

- `content`: 给 agent/user 阅读的文本。
- `details`: 结构化执行详情。
- `isError`: 标记工具调用失败或部分失败。

## 9. CLI 设计

插件注册根命令：

```bash
openclaw libp2p-mesh
```

子命令由 `src/profile-cli.ts` 组装：

- `setup`：配置网络入口、relay、入站投递目标。
- `profile`：维护本实例公开 profile attributes。
- `labels`：维护本机对远端实例的 local labels。
- `debug`：配置 announce 日志等调试项。
- `prompt`：安装或更新插件管理的 AGENTS.md 提示词区块。

CLI 写入的是 `plugins.entries["libp2p-mesh"].config`，不是 legacy `channels["libp2p-mesh"]` 配置。

## 10. 配置模型

插件配置存放在 OpenClaw config：

```json
{
  "plugins": {
    "entries": {
      "libp2p-mesh": {
        "enabled": true,
        "config": {
          "bootstrapList": [],
          "relayList": [],
          "inboundTargets": [],
          "deliveryAckTimeoutMs": 15000
        }
      }
    }
  }
}
```

关键配置分组：

### 10.1 网络配置

- `listenAddrs`
- `enableWebSocket`
- `discovery`
- `bootstrapList`
- `meshTopic`
- `enableDHT`
- `instanceName`
- `announceAddrs`

### 10.2 NAT 和 relay

- `enableNATTraversal`
- `enableIdentify`
- `enableAutoNAT`
- `enableUPnP`
- `enableCircuitRelay`
- `enableCircuitRelayServer`
- `enableDCUtR`
- `relayList`
- `discoverRelays`

### 10.3 入站投递

- `inboundTargets`
- `inboundChannel`
- `inboundTarget`
- `deliveryAckTimeoutMs`

### 10.4 兼容字段

- `relayChannel`
- `relayAccountId`

这两个字段保留用于旧配置校验，当前运行时不依赖它们。

## 11. 状态文件

插件状态默认位于：

```text
~/.openclaw/libp2p/
```

如果设置了 `OPENCLAW_STATE_DIR`，则使用：

```text
$OPENCLAW_STATE_DIR/libp2p/
```

主要状态文件：

| 文件 | 用途 |
| --- | --- |
| `peer-id.json` | libp2p Peer ID 私有状态 |
| `instance-peer.json` | 远端 Instance ID 到 Peer ID 的路由表 |
| `peer-labels.json` | 本机维护的远端实例 local labels |
| `user-profile.json` | 本实例公开 profile attributes |

store 写入采用临时文件加 rename 的方式，降低半写入导致文件损坏的概率。读取到损坏 JSON 时，会把原文件移动到 `.corrupt-<timestamp>` 备份，再返回空状态。

## 12. 入站投递适配

`createOpenClawRuntimeInboundDelivery()` 通过 OpenClaw runtime channel outbound adapter 完成投递：

1. 使用 `api.runtime.channel?.outbound?.loadAdapter(channelId)` 加载目标 channel adapter。
2. 调用 adapter 的 `sendText({ cfg, to, text })`。
3. 返回 `InboundDeliveryResult`。

如果当前运行环境没有 runtime channel outbound adapter，插件会记录 warning，并认为入站投递不可用。此时 `user-message` 仍可到达，但 ACK 会报告投递失败。

## 13. 安全与一致性约束

当前实现具备以下约束：

- direct/user-message 非 broadcast 消息要求 `msg.from` 等于实际连接的 remote peer。
- `instance-announce` 要求消息 envelope 与 payload 一致。
- `user-message` 要求 sender instance 已在本地路由表中，且路由 peerId 等于当前 `msg.from`。
- `user-message` 要求 `toInstanceId` 等于本地 Instance ID。
- 签名消息支持 DHT pubkey 校验和消息内 pubkey 校验。
- delivery ACK 只接受来自 pending 目标 peer 的 ACK。
- seen message cache 避免广播循环和重复处理。
- delivery cache 避免相同 user-message 重复投递。

需要注意：

- DHT 关闭或 pubkey 未注册时，签名校验会降级；部分路径会记录无法验证而继续处理。
- `direct` 消息是旧式 Peer ID 通道，不具备 `user-message` 的完整 ACK 和多目标投递语义。
- 入站投递依赖本地 OpenClaw channel adapter 能够发送文本。

## 14. 典型消息流

### 14.1 实例发现

```text
Peer A connects Peer B
  -> A sends instance-announce to B
  -> B validates announce
  -> B writes instance-peer.json
  -> B sends instance-announce back to A if not announced before
  -> A writes route for B
```

### 14.2 Instance ID 消息投递

```text
Agent calls p2p_send_instance_message(instanceId, message)
  -> local router resolves instanceId to peerId
  -> local router sends user-message over MeshNetwork
  -> remote router validates sender route and target instance
  -> remote router delivers text to configured inboundTargets
  -> remote router returns delivery-ack
  -> local tool reports delivered / failed with per-target results
```

### 14.3 属性分组发送

```text
Agent calls p2p_send_user_attribute_message(selector, dryRun=true)
  -> router matches public attributes and/or local labels
  -> returns matched targets

Agent calls p2p_send_user_attribute_message(selector, dryRun=false)
  -> router sends one user-message per matched instance
  -> returns aggregate delivery result
```

## 15. 可观测性

插件通过 `api.logger` 输出关键事件：

- libp2p 节点启动、停止、Peer ID、监听地址。
- Instance ID 和环境绑定信息。
- mDNS、bootstrap、DHT、NAT、relay 服务启用状态。
- peer connect / disconnect。
- instance announce 发送和接收。
- inbound delivery 成功或失败。
- delivery ACK 超时、异常或来源不匹配。

`announceLogDetail` 控制 announce 日志：

- `off`
- `summary`
- `payload`

## 16. 已知限制与演进方向

当前设计已经能覆盖 LAN、bootstrap WAN、relay 和 instance-level 投递，但仍有一些可演进点：

- 签名信任模型可以更严格：DHT 缺失 pubkey 时，目前部分路径会降级继续处理。
- `direct` legacy 入站路径只支持单 `inboundChannel/inboundTarget`，没有复用 `inboundTargets` 的多目标能力。
- `broadcast` 是连接级转发，不是完整 pubsub gossip 协议；大网络下需要更严谨的拓扑和 TTL 设计。
- ACK 是单消息内存 pending map，进程重启后不会恢复。
- `instance-peer.json` 路由表没有 TTL 清理策略，可能保留过期实例。
- relay reservation 当前主要依赖启动后的 fire-and-forget dial，后续可增加 reservation 状态检测和重试策略。
- `configSchema.safeParse()` 只校验顶层对象，字段级严格校验主要依赖 JSON schema 和运行时逻辑。

## 17. 模块索引

| 模块 | 职责 |
| --- | --- |
| `index.ts` | OpenClaw 插件定义 |
| `openclaw.plugin.json` | 插件清单和 host-facing 元数据 |
| `src/plugin.ts` | 运行时组装、注册 service/channel/tools/CLI/hook |
| `src/mesh.ts` | libp2p 节点、协议、签名、发现、NAT |
| `src/instance-router.ts` | Instance ID 路由、announce、user-message、ACK、属性分组发送 |
| `src/channel.ts` | OpenClaw chat channel 适配 |
| `src/inbound-delivery.ts` | 入站消息投递到 OpenClaw channel adapter |
| `src/inbound.ts` | legacy direct/broadcast 入站处理 |
| `src/agent-tools.ts` | agent tools 定义 |
| `src/setup-config.ts` | 配置默认值、wizard 写入和迁移辅助 |
| `src/instance-peer-store.ts` | instance route 持久化 |
| `src/peer-label-store.ts` | local labels 持久化 |
| `src/user-profile-store.ts` | public profile attributes 持久化 |
| `src/profile-cli.ts` | CLI 聚合入口 |
| `runtime-setter-api.ts` | channel runtime mesh 引用桥接 |
| `api.ts` | 对外导出的核心 API 类型和工厂 |

