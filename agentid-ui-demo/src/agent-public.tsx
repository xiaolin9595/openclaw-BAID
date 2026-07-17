import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  AppstoreOutlined,
  CaretDownOutlined,
  CheckCircleFilled,
  CopyOutlined,
  GlobalOutlined,
  LinkOutlined,
  LineChartOutlined,
  MessageOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  ShareAltOutlined,
  SlidersOutlined,
  StarFilled,
  TagsOutlined,
  ThunderboltFilled,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { agentIdApi, demoApi, demoModeEnabled, type DemoStatus, type PublicAgentRecord } from "./agentid-api";
import "./agent-public.css";

type Attribute = {
  key: string;
  label: string;
  value: string;
  kind: "capability" | "tag" | "context";
  trust: "self_declared" | "verified";
  visible?: boolean;
};

type AgentRecord = {
  id: string;
  name: string;
  initials: string;
  summary: string;
  ownerLabel: string;
  attributes: Attribute[];
  status: "verified" | "unknown";
  instanceCount: number;
  lastSeen: string;
  publicSince: string;
  role: string;
  language: string;
  rating: number;
  reviewCount: number;
  connections: number;
  responseTime: number;
  uptime: number;
  featured: boolean;
  capabilities: string[];
  taskRequirements: string[];
  demoBacked?: boolean;
  connection?: PublicAgentRecord["profile"]["connection"];
};

const FALLBACK_AGENT_ID = "did:agentid:agt_5af57039adcb46fcae750cc4";
const SITE_BASE = import.meta.env.BASE_URL;

function pageUrl(page: string, query = "") {
  return `${SITE_BASE}${page}${query}`;
}

const baseAgents: AgentRecord[] = [
  {
    id: FALLBACK_AGENT_ID,
    name: "Research Assistant",
    initials: "RA",
    summary: "负责论文检索、资料整理和摘要生成。",
    ownerLabel: "Open research workspace",
    attributes: [
      { key: "skill", label: "研究能力", value: "research", kind: "capability", trust: "self_declared" },
      { key: "skill", label: "摘要能力", value: "summarization", kind: "capability", trust: "self_declared" },
      { key: "tag", label: "公开标签", value: "academic", kind: "tag", trust: "self_declared" },
      { key: "tag", label: "公开标签", value: "P2P", kind: "tag", trust: "self_declared" },
      { key: "project", label: "公开项目", value: "open-research", kind: "context", trust: "self_declared" },
    ],
    status: "verified",
    instanceCount: 1,
    lastSeen: "状态未知",
    publicSince: "2026-07-11",
    role: "研究助理",
    language: "TypeScript",
    rating: 4.9,
    reviewCount: 18,
    connections: 42,
    responseTime: 840,
    uptime: 99.2,
    featured: true,
    capabilities: ["research", "summarization", "retrieval"],
    taskRequirements: ["论文检索", "知识整理"],
    demoBacked: true,
  },
  {
    id: "did:agentid:agt_2c7b1a4f8e9d46b0a4e1c2d9",
    name: "Knowledge Curator",
    initials: "KC",
    summary: "整理团队知识库，建立可复用的研究上下文。",
    ownerLabel: "Knowledge systems",
    attributes: [
      { key: "skill", label: "研究能力", value: "knowledge-curation", kind: "capability", trust: "self_declared" },
      { key: "skill", label: "检索能力", value: "retrieval", kind: "capability", trust: "self_declared" },
      { key: "tag", label: "公开标签", value: "knowledge-base", kind: "tag", trust: "self_declared" },
    ],
    status: "verified",
    instanceCount: 2,
    lastSeen: "最近授权",
    publicSince: "2026-07-08",
    role: "知识管理",
    language: "Python",
    rating: 4.7,
    reviewCount: 24,
    connections: 76,
    responseTime: 620,
    uptime: 99.8,
    featured: true,
    capabilities: ["knowledge-curation", "retrieval", "summarization"],
    taskRequirements: ["资料归档", "知识库维护"],
  },
  {
    id: "did:agentid:agt_7a19e8c06d3f4b25a8c9e1f6",
    name: "P2P Relay Agent",
    initials: "PR",
    summary: "面向 P2P Mesh 的节点发现和身份验证实验 Agent。",
    ownerLabel: "Mesh laboratory",
    attributes: [
      { key: "skill", label: "网络能力", value: "p2p-mesh", kind: "capability", trust: "self_declared" },
      { key: "skill", label: "验证能力", value: "identity-verification", kind: "capability", trust: "self_declared" },
      { key: "tag", label: "公开标签", value: "libp2p", kind: "tag", trust: "self_declared" },
    ],
    status: "verified",
    instanceCount: 3,
    lastSeen: "最近授权",
    publicSince: "2026-07-02",
    role: "网络基础设施",
    language: "TypeScript",
    rating: 4.6,
    reviewCount: 11,
    connections: 128,
    responseTime: 310,
    uptime: 98.7,
    featured: false,
    capabilities: ["p2p-mesh", "identity-verification", "libp2p"],
    taskRequirements: ["节点发现", "身份验证"],
  },
  {
    id: "did:agentid:agt_91d4f0b8a62c47e0b7c2d518",
    name: "Document Operator",
    initials: "DO",
    summary: "将复杂资料转化为结构化文档、清单和行动摘要。",
    ownerLabel: "Operations desk",
    attributes: [
      { key: "skill", label: "文档能力", value: "document-ops", kind: "capability", trust: "self_declared" },
      { key: "skill", label: "结构化能力", value: "structured-output", kind: "capability", trust: "self_declared" },
      { key: "tag", label: "公开标签", value: "operations", kind: "tag", trust: "self_declared" },
    ],
    status: "unknown",
    instanceCount: 0,
    lastSeen: "未连接",
    publicSince: "2026-06-28",
    role: "运营自动化",
    language: "Python",
    rating: 4.3,
    reviewCount: 7,
    connections: 19,
    responseTime: 1200,
    uptime: 94.1,
    featured: false,
    capabilities: ["document-ops", "structured-output", "operations"],
    taskRequirements: ["文档生成", "流程整理"],
  },
];

function shorten(value: string | null, length = 42) {
  if (!value || value.length <= length) return value ?? "未知";
  return `${value.slice(0, Math.floor(length * 0.62))}...${value.slice(-8)}`;
}

function formatDate(value: string | null) {
  if (!value) return "状态未知";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "状态未知" : `最近授权至 ${new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(date)}`;
}

function publicDetailUrl(id: string) {
  return pageUrl("agent-public.html", `?agent=${encodeURIComponent(id)}`);
}

function attributeIcon(kind: Attribute["kind"]) {
  if (kind === "capability") return <SafetyCertificateOutlined />;
  if (kind === "tag") return <TagsOutlined />;
  return <GlobalOutlined />;
}

function mapPublicRecord(record: PublicAgentRecord): AgentRecord {
  const fallback = baseAgents.find((agent) => agent.id === record.agent.id || agent.name === record.agent.name);
  const attributes = record.profile.attributes.filter((attribute) => attribute.visible).map((attribute) => ({ ...attribute }));
  return {
    ...(fallback ?? baseAgents[0]),
    id: record.agent.id,
    name: record.agent.name,
    initials: fallback?.initials ?? record.agent.name.slice(0, 2).toUpperCase(),
    summary: record.profile.summary || fallback?.summary || "这个 Agent 还没有公开简介。",
    ownerLabel: fallback?.ownerLabel ?? "公开 Agent",
    attributes,
    status: record.agent.status === "active" ? "verified" : "unknown",
    instanceCount: fallback?.instanceCount ?? 0,
    lastSeen: fallback?.lastSeen ?? "状态未知",
    publicSince: fallback?.publicSince ?? record.agent.createdAt ?? "未记录",
    role: record.profile.role || fallback?.role || "通用 Agent",
    language: record.profile.language || fallback?.language || "未指定",
    demoBacked: fallback?.demoBacked,
    capabilities: attributes.filter((attribute) => attribute.kind === "capability").map((attribute) => attribute.value),
    connection: record.profile.connection,
  };
}

type SortKey = "relevance" | "connections" | "rating" | "responseTime";
type DirectoryView = "grid" | "list";

function AgentDirectory({ agents }: { agents: AgentRecord[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified">("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [capabilityFilter, setCapabilityFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("relevance");
  const [view, setView] = useState<DirectoryView>("grid");

  const roles = useMemo(() => Array.from(new Set(agents.map((agent) => agent.role))), [agents]);
  const capabilities = useMemo(() => Array.from(new Set(agents.flatMap((agent) => agent.capabilities))), [agents]);
  const languages = useMemo(() => Array.from(new Set(agents.map((agent) => agent.language))), [agents]);
  const featuredAgents = useMemo(() => agents.filter((agent) => agent.featured && agent.status === "verified").slice(0, 2), [agents]);

  const filteredAgents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const result = agents.filter((agent) => {
      const matchesStatus = statusFilter === "all" || agent.status === "verified";
      const matchesRole = roleFilter === "all" || agent.role === roleFilter;
      const matchesCapability = capabilityFilter === "all" || agent.capabilities.includes(capabilityFilter);
      const matchesLanguage = languageFilter === "all" || agent.language === languageFilter;
      const searchable = [agent.name, agent.id, agent.summary, agent.ownerLabel, agent.role, agent.language, ...agent.capabilities, ...agent.taskRequirements].join(" ").toLowerCase();
      return matchesStatus && matchesRole && matchesCapability && matchesLanguage && (!normalized || searchable.includes(normalized));
    });
    return result.sort((a, b) => {
      if (sort === "connections") return b.connections - a.connections;
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "responseTime") return a.responseTime - b.responseTime;
      return Number(b.featured) - Number(a.featured) || b.rating - a.rating;
    });
  }, [agents, capabilityFilter, languageFilter, query, roleFilter, sort, statusFilter]);

  const activeFilterCount = [statusFilter !== "all", roleFilter !== "all", capabilityFilter !== "all", languageFilter !== "all"].filter(Boolean).length;
  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setRoleFilter("all");
    setCapabilityFilter("all");
    setLanguageFilter("all");
  };

  return (
    <main className="directory-page">
      <header className="directory-topbar">
        <a className="public-brand" href={pageUrl("agent-public.html")} aria-label="AgentID 公开目录">
          <span className="public-brand-mark">A</span>
          <span>AGENTID / DIRECTORY</span>
        </a>
        <nav className="directory-nav" aria-label="主导航">
          <a className="nav-current" href={pageUrl("agent-public.html")}>Agent 目录</a>
          <a href={pageUrl("control-plane.html")}>控制台 <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <section className="directory-intro">
        <div><p className="directory-kicker">PUBLIC AGENT DIRECTORY</p><h1>发现 Agent</h1><p className="directory-lede">浏览公开发布的 Agent 属性、身份状态和可用实例。选择一个 Agent 查看完整公开资料。</p></div>
        <div className="directory-stats" aria-label="目录统计"><div><strong>{agents.length}</strong><span>公开 Agent</span></div><div><strong>{agents.filter((agent) => agent.status === "verified").length}</strong><span>已验证身份</span></div><div><strong>{agents.reduce((sum, agent) => sum + agent.connections, 0)}</strong><span>公开连接</span></div></div>
      </section>

      {featuredAgents.length > 0 && <section className="featured-section" aria-labelledby="featured-title"><div className="subsection-heading"><div><p className="directory-kicker">CURATED SELECTION</p><h2 id="featured-title">精选 Agent</h2></div><span>基于公开属性和身份状态</span></div><div className="featured-grid">{featuredAgents.map((agent) => <a className="featured-card" href={publicDetailUrl(agent.id)} key={agent.id}><div className="featured-card-mark">{agent.initials}</div><div className="featured-card-copy"><div className="featured-card-title"><strong>{agent.name}</strong><CheckCircleFilled /></div><span>{agent.role} · {agent.language}</span><p>{agent.summary}</p></div><ArrowRightOutlined /></a>)}</div></section>}

      <section className="directory-workspace" aria-label="Agent 列表">
        <div className="directory-toolbar">
          <label className="directory-search"><SearchOutlined /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、能力、角色或 AgentID" aria-label="搜索 Agent" />{query && <button type="button" onClick={() => setQuery("")} aria-label="清除搜索">×</button>}</label>
          <div className="toolbar-actions"><label className="sort-control"><span>排序</span><select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Agent 排序"><option value="relevance">综合排序</option><option value="connections">连接数</option><option value="rating">评分</option><option value="responseTime">响应时间</option></select><CaretDownOutlined /></label><div className="view-toggle" aria-label="视图切换"><button className={view === "grid" ? "view-active" : ""} type="button" onClick={() => setView("grid")} aria-label="网格视图" title="网格视图"><AppstoreOutlined /></button><button className={view === "list" ? "view-active" : ""} type="button" onClick={() => setView("list")} aria-label="列表视图" title="列表视图"><UnorderedListOutlined /></button></div></div>
        </div>

        <div className="directory-results-layout">
          <aside className="directory-filter-panel" aria-label="高级筛选"><div className="filter-panel-heading"><div><SlidersOutlined /><strong>筛选目录</strong></div>{activeFilterCount > 0 && <button type="button" onClick={clearFilters}>清除</button>}</div><div className="filter-section"><span className="filter-label">身份状态</span><label className="check-filter"><input type="checkbox" checked={statusFilter === "verified"} onChange={(event) => setStatusFilter(event.target.checked ? "verified" : "all")} /><span>仅显示已验证</span><small>{agents.filter((agent) => agent.status === "verified").length}</small></label></div><div className="filter-section"><label className="filter-label" htmlFor="role-filter">Agent 角色</label><label className="directory-select"><select id="role-filter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">全部角色</option>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select><CaretDownOutlined /></label></div><div className="filter-section"><label className="filter-label" htmlFor="capability-filter">主要能力</label><label className="directory-select"><select id="capability-filter" value={capabilityFilter} onChange={(event) => setCapabilityFilter(event.target.value)}><option value="all">全部能力</option>{capabilities.map((capability) => <option key={capability} value={capability}>{capability}</option>)}</select><CaretDownOutlined /></label></div><div className="filter-section"><label className="filter-label" htmlFor="language-filter">运行环境</label><label className="directory-select"><select id="language-filter" value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)}><option value="all">全部环境</option>{languages.map((language) => <option key={language} value={language}>{language}</option>)}</select><CaretDownOutlined /></label></div><div className="filter-footnote"><SafetyCertificateOutlined /><span>目录只索引 Agent 主动公开的属性，不包含用户 ID、IBC 或设备私密信息。</span></div></aside>

          <div className="directory-results"><div className="directory-results-bar"><span>{query ? `搜索“${query}”` : "全部公开 Agent"}{activeFilterCount > 0 && <em>· {activeFilterCount} 项筛选</em>}</span><strong>{filteredAgents.length} 个结果</strong></div>{filteredAgents.length > 0 ? (view === "grid" ? <div className="agent-directory-grid">{filteredAgents.map((agent, index) => <AgentCard key={agent.id} agent={agent} index={index} />)}</div> : <div className="agent-directory-list">{filteredAgents.map((agent, index) => <AgentListRow key={agent.id} agent={agent} index={index} />)}</div>) : <div className="directory-empty"><SearchOutlined /><strong>没有找到匹配的 Agent</strong><span>尝试搜索其他名称、能力或标签。</span><button type="button" onClick={clearFilters}>清除筛选</button></div>}</div>
        </div>
      </section>
      <footer className="directory-footer"><span>公开属性由 Agent 所有者维护</span><span>AgentID Identity Network</span></footer>
    </main>
  );
}

function AgentCard({ agent, index }: { agent: AgentRecord; index: number }) {
  return <a className="agent-card" href={publicDetailUrl(agent.id)} style={{ animationDelay: `${index * 60}ms` }}><div className="agent-card-top"><div className="agent-card-mark">{agent.initials}</div><div className="agent-card-labels">{agent.featured && <span className="featured-label">精选</span>}<span className={`agent-status ${agent.status}`}><span />{agent.status === "verified" ? "已验证" : "状态未知"}</span></div></div><div className="agent-card-heading"><h2>{agent.name}</h2><ArrowRightOutlined /></div><div className="agent-card-role">{agent.role} <span>·</span> {agent.language}</div><p className="agent-card-summary">{agent.summary}</p><div className="agent-card-tags">{agent.capabilities.slice(0, 3).map((capability) => <span key={capability}>{capability}</span>)}</div><div className="agent-card-metrics"><span><StarFilled /> <strong>{agent.rating.toFixed(1)}</strong> <small>{agent.reviewCount} 评价</small></span><span><ThunderboltFilled /> {agent.responseTime}ms</span><span><LineChartOutlined /> {agent.uptime}%</span></div><div className="agent-card-meta"><span title={agent.id}>{shorten(agent.id, 30)}</span><span>{agent.connections} 个连接</span></div></a>;
}

function AgentListRow({ agent, index }: { agent: AgentRecord; index: number }) {
  return <a className="agent-list-row" href={publicDetailUrl(agent.id)} style={{ animationDelay: `${index * 60}ms` }}><div className="agent-card-mark">{agent.initials}</div><div className="agent-list-main"><div className="agent-list-title"><strong>{agent.name}</strong>{agent.status === "verified" && <CheckCircleFilled />}<span>{agent.role}</span></div><p>{agent.summary}</p><div className="agent-card-tags">{agent.capabilities.slice(0, 3).map((capability) => <span key={capability}>{capability}</span>)}</div></div><div className="agent-list-metrics"><span><strong>{agent.rating.toFixed(1)}</strong><small>评分</small></span><span><strong>{agent.connections}</strong><small>连接</small></span><span><strong>{agent.uptime}%</strong><small>稳定性</small></span></div><ArrowRightOutlined className="agent-list-arrow" /></a>;
}

function AgentDetail({ agent, demo, loading }: { agent: AgentRecord; demo: DemoStatus | null; loading: boolean }) {
  const [copied, setCopied] = useState(false);
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const [message, setMessage] = useState("你好，我想了解你的研究能力。");
  const [connectionState, setConnectionState] = useState<"idle" | "pairing" | "dialing" | "verified" | "failed">("idle");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const visibleAttributes = agent.attributes.filter((attribute) => attribute.visible !== false);
  const client = agent.demoBacked ? demo?.clients.a : null;
  const agentId = client?.agentId ?? agent.id;
  const isVerified = agent.status === "verified" && Boolean(agentId);
  const presence = loading ? "读取中" : client?.gatewayRunning ? "状态未知" : client ? "暂未连接" : agent.lastSeen;

  const copyAgentId = async () => {
    await navigator.clipboard?.writeText(agentId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const copyCommunicationPayload = async () => {
    const payload = JSON.stringify({ agentId, message }, null, 2);
    await navigator.clipboard?.writeText(payload);
  };

  const connectLocalOpenClaw = async () => {
    setConnectionState("pairing");
    setConnectionError(null);
    try {
      const bridge = "http://127.0.0.1:8799";
      const localStatusResponse = await fetch(`${bridge}/v1/local/status`);
      const localStatus = await localStatusResponse.json().catch(() => ({})) as { agentId?: string | null };
      if (localStatus.agentId === agentId) {
        throw new Error("这是当前本机 Agent，无需建立自连接。请返回目录选择其他 Agent。");
      }
      const ticket = await agentIdApi.getDiscoveryTicket(agentId);
      const pairResponse = await fetch(`${bridge}/v1/local/pair`, { method: "POST", headers: { "content-type": "application/json" } });
      if (!pairResponse.ok) throw new Error("本机 OpenClaw 连接桥不可用。");
      const pair = await pairResponse.json() as { localSessionToken?: string };
      if (!pair.localSessionToken) throw new Error("本机 OpenClaw 未返回配对令牌。");
      setConnectionState("dialing");
      const importResponse = await fetch(`${bridge}/v1/local/connections/import`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-openclaw-bridge-token": pair.localSessionToken },
        body: JSON.stringify({ agentId, label: agent.name, initialMessage: message, discoveryTicket: ticket.ticket }),
      });
      const importBody = await importResponse.json().catch(() => ({})) as { requestId?: string; error?: string };
      if (!importResponse.ok || !importBody.requestId) throw new Error(importBody.error ?? "OpenClaw 无法开始连接。");
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 600));
        const statusResponse = await fetch(`${bridge}/v1/local/connections/${encodeURIComponent(agentId)}`, { headers: { "x-openclaw-bridge-token": pair.localSessionToken } });
        const statusBody = await statusResponse.json().catch(() => ({})) as { target?: { status?: string; lastError?: string } };
        if (statusBody.target?.status === "verified") {
          setConnectionState("verified");
          return;
        }
        if (statusBody.target?.status === "failed") throw new Error(statusBody.target.lastError ?? "目标节点连接失败。");
      }
      throw new Error("连接请求已发送，但尚未完成 IBC 验证。");
    } catch (error) {
      setConnectionState("failed");
      setConnectionError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <main className="detail-page">
      <header className="directory-topbar">
        <a className="public-brand" href={pageUrl("agent-public.html")} aria-label="返回 AgentID 公开目录">
          <span className="public-brand-mark">A</span>
          <span>AGENTID / DIRECTORY</span>
        </a>
        <nav className="directory-nav" aria-label="主导航">
          <a className="nav-current" href={pageUrl("agent-public.html")}>Agent 目录</a>
          <a href={pageUrl("control-plane.html")}>控制台 <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <div className="detail-breadcrumb"><a href={pageUrl("agent-public.html")}><ArrowLeftOutlined /> Agent 目录</a><span>/</span><strong>{agent.name}</strong></div>

      <section className="detail-hero" aria-labelledby="agent-title">
        <div className="detail-hero-kicker">AGENT PROFILE / PUBLIC</div>
        <div className="detail-hero-grid">
          <div>
            <div className="agent-public-heading"><div className="agent-public-mark">{agent.initials}</div><div><p className="public-eyebrow">逻辑 Agent</p><h1 id="agent-title">{agent.name}</h1></div></div>
            <p className="agent-summary">{agent.summary} 这个页面只展示 Agent 主动公开的属性，不展示用户账户或设备私密信息。</p>
            <div className="identity-line"><span className="identity-label">AgentID</span><code title={agentId}>{shorten(agentId, 50)}</code><button className="copy-button" type="button" onClick={copyAgentId} aria-label="复制 AgentID" title="复制 AgentID"><CopyOutlined /></button>{copied && <span className="copied-note">已复制</span>}</div>
            <div className="detail-actions"><button className="communication-button" type="button" onClick={() => setCommunicationOpen((value) => !value)} disabled={!isVerified}><MessageOutlined /> {communicationOpen ? "收起通信入口" : "发起通信"}</button><span>{agent.connection?.allowDiscovery ? "可请求本机 OpenClaw 建立连接" : "目标尚未公开连接地址"}</span></div>
          </div>
          <aside className="verification-panel" aria-label="身份状态"><div className="verification-icon"><SafetyCertificateOutlined /></div><div><span className="panel-label">身份状态</span><strong>{isVerified ? "已验证" : "等待绑定"}</strong><p>{isVerified ? "AgentID 绑定凭证有效" : "尚未发现有效绑定"}</p></div>{isVerified && <CheckCircleFilled className="verification-check" />}</aside>
        </div>
      </section>

      {communicationOpen && (
        <section className="communication-panel" aria-labelledby="communication-title">
          <div className="communication-panel-heading">
            <div>
              <p className="public-eyebrow">AGENT-TO-AGENT COMMUNICATION</p>
              <h2 id="communication-title">通过 AgentID 建立通信</h2>
              <p>网页负责发现目标；真正的消息由 OpenClaw 客户端使用本地私钥签名，并在 P2P 接收端验证 IBC。</p>
            </div>
            <button className="copy-button light" type="button" onClick={() => setCommunicationOpen(false)} aria-label="关闭通信入口">×</button>
          </div>
          <div className="communication-grid">
            <div>
              <label className="communication-label" htmlFor="communication-message">首条消息</label>
              <textarea id="communication-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} />
              <div className="communication-steps">
                <span><b>01</b>获取短期 Discovery Ticket</span>
                <span><b>02</b>交给本机 OpenClaw 拨号并验证 IBC</span>
                <span><b>03</b>验证成功后加入 Agent 通信列表</span>
              </div>
              <button
                className="communication-connect"
                type="button"
                disabled={!agent.connection?.allowDiscovery || connectionState === "pairing" || connectionState === "dialing"}
                onClick={() => void connectLocalOpenClaw()}
              >
                <LinkOutlined /> {connectionState === "pairing" ? "正在配对本机 OpenClaw" : connectionState === "dialing" ? "正在建立连接" : connectionState === "verified" ? "已加入通信列表" : "连接到本机 OpenClaw"}
              </button>
              {connectionError ? <p className="communication-error" role="alert">{connectionError}</p> : null}
            </div>
            <div className="communication-command">
              <div className="communication-command-top">
                <span>给第三方 Agent 的调用参数</span>
                <button type="button" onClick={() => void copyCommunicationPayload()}><CopyOutlined /> 复制 JSON</button>
              </div>
              <pre>{JSON.stringify({ agentId, message }, null, 2)}</pre>
              <p><SafetyCertificateOutlined /> 不会在网页中暴露用户 ID、PeerID、JTI、完整 IBC 或私钥。目标实例必须已完成 AgentID 验证。</p>
            </div>
          </div>
        </section>
      )}

      <section className="attribute-layout" aria-labelledby="attribute-title">
        <div className="attribute-main">
          <div className="section-heading"><div><p className="public-eyebrow">公开属性</p><h2 id="attribute-title">这个 Agent 能做什么</h2></div><span className="attribute-count">{visibleAttributes.length} 项公开信息</span></div>
          <div className="attribute-table">{visibleAttributes.map((attribute, index) => <div className="attribute-row" key={`${attribute.key}-${attribute.value}`} style={{ animationDelay: `${index * 60}ms` }}><div className={`attribute-icon ${attribute.kind}`} aria-hidden="true">{attributeIcon(attribute.kind)}</div><div className="attribute-copy"><strong>{attribute.value}</strong><span>{attribute.label}</span></div><span className="trust-label">{attribute.trust === "self_declared" ? "自声明" : "已验证"}</span></div>)}</div>
          <div className="trust-note"><SafetyCertificateOutlined /><p><strong>身份验证不等于能力验证。</strong> 上述能力由 Agent 所有者公开声明，AgentID 身份由身份服务验证。</p></div>
        </div>
        <aside className="attribute-aside"><div className="aside-section"><p className="public-eyebrow">连接状态</p><div className="presence-value"><span className="presence-ring" />{presence}</div><p className="aside-copy">网站不伪造在线状态。只有收到可靠心跳或发现数据时，才会更新为在线或最近活跃。</p></div><div className="aside-section"><p className="public-eyebrow">授权摘要</p><dl className="summary-list">{/* Instance ID and binding count intentionally stay out of the public Agent page. */}<div><dt>公开协议</dt><dd>P2P Mesh</dd></div><div><dt>凭证</dt><dd>{formatDate(client?.expiresAt ?? null)}</dd></div></dl></div><div className="aside-share"><ShareAltOutlined /><div><strong>分享这个 Agent</strong><span>公开页面不包含完整 IBC、Instance ID 或设备详情</span></div></div></aside>
      </section>
      <footer className="public-footer"><span>公开属性由 Agent 所有者维护</span><span>AgentID Identity Network</span></footer>
    </main>
  );
}

function App() {
  const [demo, setDemo] = useState<DemoStatus | null>(null);
  const [loading, setLoading] = useState(demoModeEnabled);
  const [remotePublicAgents, setRemotePublicAgents] = useState<PublicAgentRecord[] | null>(null);
  const selectedId = new URLSearchParams(window.location.search).get("agent");

  useEffect(() => {
    if (!demoModeEnabled) return undefined;
    let active = true;
    void demoApi.getStatus().then((value) => { if (active) setDemo(value); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const records = await agentIdApi.listPublicAgents();
        if (active) setRemotePublicAgents(records);
      } catch {
        // Keep the last verified directory snapshot during a brief service outage.
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const agents = useMemo(() => {
    const current = demo?.clients.a;
    const remoteAgents = remotePublicAgents?.map(mapPublicRecord) ?? baseAgents;
    const currentAgentId = current?.agentId;
    if (!currentAgentId) return remoteAgents;
    return remoteAgents.map((agent) => agent.id === FALLBACK_AGENT_ID || agent.demoBacked ? { ...agent, id: currentAgentId, status: (current.status === "active" ? "verified" : "unknown") as AgentRecord["status"], instanceCount: current.status === "active" ? 1 : 0 } : agent);
  }, [demo, remotePublicAgents]);
  const selectedAgent = agents.find((agent) => agent.id === selectedId) ?? (selectedId ? baseAgents.find((agent) => agent.id === FALLBACK_AGENT_ID) : undefined);

  return selectedAgent ? <AgentDetail agent={selectedAgent} demo={demo} loading={loading} /> : <AgentDirectory agents={agents} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("Agent public root missing");
createRoot(root).render(<App />);
