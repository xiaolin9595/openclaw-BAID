import { createRoot, type Root } from "react-dom/client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  BellOutlined,
  CheckCircleFilled,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  FileSearchOutlined,
  LaptopOutlined,
  LinkOutlined,
  LockOutlined,
  PlusOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  agentIdApi,
  ApiError,
  demoModeEnabled,
  type Agent,
  type AgentPublicProfile,
  type PublicAttribute,
  type AgentMember,
  type Approval,
  type AuditEvent,
  type CurrentUser,
  type Instance,
} from "./agentid-api";
import "./control-plane.css";

const SITE_BASE = import.meta.env.BASE_URL;

function pageUrl(page: string, query = "") {
  return `${SITE_BASE}${page}${query}`;
}

type View = "agents" | "approvals" | "activity" | "security";
type DetailTab = "devices" | "public" | "members" | "rules" | "activity";
const navigation: Array<{ id: View; label: string; icon: ReactNode }> = [
  { id: "agents", label: "我的 Agent", icon: <AppstoreOutlined /> },
  { id: "approvals", label: "待授权", icon: <SafetyCertificateOutlined /> },
  { id: "activity", label: "活动记录", icon: <FileSearchOutlined /> },
  { id: "security", label: "账户与安全", icon: <SettingOutlined /> },
];
const suggestedProfileAttributes: Array<Pick<PublicAttribute, "key" | "label" | "value" | "kind">> = [
  { key: "capability:research", label: "能力", value: "research", kind: "capability" },
  { key: "capability:web-search", label: "能力", value: "web-search", kind: "capability" },
  { key: "capability:data-analysis", label: "能力", value: "data-analysis", kind: "capability" },
  { key: "capability:code-generation", label: "能力", value: "code-generation", kind: "capability" },
  { key: "capability:translation", label: "能力", value: "translation", kind: "capability" },
  { key: "context:finance", label: "领域", value: "finance", kind: "context" },
  { key: "context:healthcare", label: "领域", value: "healthcare", kind: "context" },
  { key: "context:robotics", label: "领域", value: "robotics", kind: "context" },
  { key: "context:education", label: "领域", value: "education", kind: "context" },
];
function formatTime(value?: string) {
  if (!value) return "未知";
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(time);
}

function expiryLabel(value: string) {
  const milliseconds = Date.parse(value) - Date.now();
  if (milliseconds <= 0) return "已到期";
  const days = Math.ceil(milliseconds / 86_400_000);
  return days === 1 ? "1 天后到期" : `${days} 天后到期`;
}

function instanceStatus(instance: Instance) {
  if (instance.status === "active") return { className: "online", label: "已授权" };
  if (instance.status === "revoked") return { className: "offline", label: "已撤销" };
  return { className: "expiring", label: instance.status === "expired" ? "已到期" : instance.status };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求未能完成。";
}

function isAuthenticationError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export default function ControlPlane() {
  const params = new URLSearchParams(window.location.search);
  const authorizationRequestId = params.get("request_id") ?? undefined;
  const authOnly = window.location.pathname.endsWith("/login.html") || params.get("auth") === "login";
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [members, setMembers] = useState<Record<string, AgentMember[]>>({});
  const [publicProfiles, setPublicProfiles] = useState<Record<string, AgentPublicProfile>>({});
  const [instances, setInstances] = useState<Record<string, Instance[]>>({});
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [activeView, setActiveView] = useState<View>("agents");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("devices");
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("正在连接身份服务");
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<Approval | null>(null);
  const [approvalAgentId, setApprovalAgentId] = useState("");
  const [deviceDetail, setDeviceDetail] = useState<Instance | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Instance | null>(null);
  const [revokeName, setRevokeName] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const loadWorkspace = useCallback(async (requestId?: string, signedInUser?: CurrentUser) => {
    setIsLoading(true);
    setFatalError(null);
    try {
      const currentUser = signedInUser ?? await agentIdApi.getCurrentUser();
      const [agentResponse, approvalResponse, activityResponse] = await Promise.all([
        agentIdApi.listAgents(),
        agentIdApi.listApprovals(),
        agentIdApi.listActivity(),
      ]);
      const nextAgents = agentResponse.items;
      const instanceResponses = await Promise.all(nextAgents.map(async (agent) => [agent.id, await agentIdApi.listInstances(agent.id)] as const));
      const nextInstances = Object.fromEntries(instanceResponses.map(([agentId, response]) => [agentId, response.items]));
      const memberResponses = await Promise.all(nextAgents.map(async (agent) => [agent.id, await agentIdApi.listMembers(agent.id)] as const));
      const nextMembers = Object.fromEntries(memberResponses.map(([agentId, response]) => [agentId, response.items]));
      const profileResponses = await Promise.all(nextAgents.map(async (agent) => [agent.id, await agentIdApi.getPublicProfile(agent.id)] as const));
      const nextPublicProfiles = Object.fromEntries(profileResponses.map(([agentId, profile]) => [agentId, profile]));

      setUser(currentUser);
      setAgents(nextAgents);
      setInstances(nextInstances);
      setMembers(nextMembers);
      setPublicProfiles(nextPublicProfiles);
      setApprovals(approvalResponse.items);
      setEvents(activityResponse.items);
      setSelectedAgentId((current) => current || nextAgents[0]?.id || "");
      setNotice("身份服务已同步");

      if (requestId) {
        const request = await agentIdApi.getApproval(requestId);
        setApprovalTarget(request);
        setApprovalAgentId(request.agentCreationRequested ? "" : request.agentId && nextAgents.some((agent) => agent.id === request.agentId) ? request.agentId : nextAgents[0]?.id ?? "");
        setActiveView("approvals");
      }
    } catch (error) {
      if (isAuthenticationError(error)) {
        setUser(null);
        setNotice("请登录后管理你的 Agent");
      } else {
        setFatalError(errorMessage(error));
        setNotice("身份服务不可用");
      }
    } finally {
      setIsLoading(false);
    }
  }, [authOnly]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const magicToken = params.get("token");
    const requestId = params.get("request_id") ?? undefined;
    const initialize = async () => {
      if (magicToken) {
        try {
          await agentIdApi.consumeMagicLink(magicToken);
          window.history.replaceState({}, document.title, `${window.location.pathname}${requestId ? `?request_id=${encodeURIComponent(requestId)}` : ""}`);
        } catch (error) {
          setFatalError(errorMessage(error));
        }
      }
      await loadWorkspace(requestId);
    };
    void initialize();
  }, [loadWorkspace]);

  const selectedAgent = useMemo(() => agents.find((agent) => agent.id === selectedAgentId) ?? null, [agents, selectedAgentId]);
  const selectedInstances = selectedAgent ? instances[selectedAgent.id] ?? [] : [];
  const pendingCount = approvals.length + (approvalTarget?.status === "pending" && !approvals.some((approval) => approval.id === approvalTarget.id) ? 1 : 0);

  const copyValue = async (value: string, label: string) => {
    await navigator.clipboard?.writeText(value);
    setNotice(`${label}已复制`);
  };

  const handleCreateAgent = async () => {
    const name = newAgentName.trim();
    if (!name) return;
    setIsBusy(true);
    try {
      const created = await agentIdApi.createAgent(name);
      setAgents((current) => [...current, { ...created, instanceCount: created.instanceCount ?? 0, pendingApprovalCount: created.pendingApprovalCount ?? 0 }]);
      setInstances((current) => ({ ...current, [created.id]: [] }));
      setSelectedAgentId(created.id);
      if (approvalTarget) setApprovalAgentId(created.id);
      setIsCreateOpen(false);
      setNewAgentName("");
      setNotice(`${created.name} 已创建`);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const handleRenameAgent = async (agent: Agent) => {
    const name = window.prompt("Agent 名称", agent.name)?.trim();
    if (!name || name === agent.name) return;
    setIsBusy(true);
    try {
      const updated = await agentIdApi.updateAgent(agent.id, name);
      setAgents((current) => current.map((entry) => entry.id === updated.id ? { ...entry, ...updated } : entry));
      setNotice("Agent 名称已更新");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const openApproval = (request: Approval) => {
    setApprovalTarget(request);
    setApprovalAgentId(request.agentCreationRequested ? "" : request.agentId && agents.some((agent) => agent.id === request.agentId) ? request.agentId : agents[0]?.id ?? "");
  };

  const handleApprove = () => {
    if (!approvalTarget) return;
    setIsBusy(true);
    void agentIdApi.approve(approvalTarget.id, approvalAgentId)
      .then(() => {
        setApprovals((current) => current.filter((request) => request.id !== approvalTarget.id));
        setApprovalTarget(null);
        setNotice("设备已获授权，客户端现在可以兑换绑定凭证");
        return loadWorkspace();
      })
      .catch((error) => setNotice(errorMessage(error)))
      .finally(() => setIsBusy(false));
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setIsBusy(true);
    try {
      await agentIdApi.revoke(revokeTarget.agentId, revokeTarget.instanceId);
      setInstances((current) => ({
        ...current,
        [revokeTarget.agentId]: (current[revokeTarget.agentId] ?? []).filter((instance) => instance.jti !== revokeTarget.jti),
      }));
      setDeviceDetail(null);
      setRevokeTarget(null);
      setRevokeName("");
      setNotice("设备授权已撤销");
      await loadWorkspace();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeny = async () => {
    if (!approvalTarget) return;
    setIsBusy(true);
    try {
      await agentIdApi.deny(approvalTarget.id);
      setApprovals((current) => current.filter((request) => request.id !== approvalTarget.id));
      setApprovalTarget(null);
      setNotice("设备请求已拒绝");
      await loadWorkspace();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading) return <LoadingScreen />;
  if (!user) return <SignInScreen error={fatalError} onSignedIn={(signedInUser) => {
    if (authOnly) {
      const query = authorizationRequestId ? `?request_id=${encodeURIComponent(authorizationRequestId)}` : "";
      window.location.assign(pageUrl("control-plane.html", query));
      return;
    }
    void loadWorkspace(authorizationRequestId, signedInUser);
  }} />;

  return (
    <div className="console-shell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand-lockup"><div className="brand-mark" aria-hidden="true">A</div><div><strong>AgentID</strong><span>IDENTITY CONSOLE</span></div></div>
        <nav className="primary-nav">
          {navigation.map((item) => <button className={`nav-item ${activeView === item.id ? "is-active" : ""}`} key={item.id} onClick={() => setActiveView(item.id)} type="button"><span className="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>{item.id === "approvals" && pendingCount ? <b className="nav-count">{pendingCount}</b> : null}</button>)}
        </nav>
        <div className="service-indicator"><span className="service-dot" /><span>身份服务已连接</span></div>
        <button className="account-chip" onClick={() => setActiveView("security")} type="button"><span className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{user.displayName}</strong><small>账户所有者</small></span><RightOutlined aria-hidden="true" /></button>
      </aside>

      <main className="console-main">
        <header className="topbar"><div className="topbar-context"><span className="eyebrow">AGENT IDENTITY PLATFORM</span><span className="notice" role="status">{notice}</span></div><div className="topbar-actions">{demoModeEnabled ? <a className="topbar-link" href={pageUrl("openclaw.html")}><LinkOutlined /> OpenClaw 运行页</a> : null}<button className="icon-button" aria-label="刷新身份数据" onClick={() => void loadWorkspace()} title="刷新" type="button"><BellOutlined /></button></div></header>
        {fatalError ? <div className="surface-error" role="alert">{fatalError}</div> : null}
        {activeView === "agents" ? <AgentsView agents={agents} publicProfile={selectedAgent ? publicProfiles[selectedAgent.id] ?? null : null} members={selectedAgent ? members[selectedAgent.id] ?? [] : []} instances={selectedInstances} selectedAgent={selectedAgent} selectedAgentId={selectedAgentId} detailTab={detailTab} onSavePublicProfile={async (profile) => { if (!selectedAgent) return; const saved = await agentIdApi.updatePublicProfile(selectedAgent.id, profile); setPublicProfiles((current) => ({ ...current, [selectedAgent.id]: saved })); setNotice(saved.published ? "公开资料已发布" : "公开资料已保存为草稿"); }} onCreate={() => setIsCreateOpen(true)} onRename={handleRenameAgent} onOpenApprovals={() => setActiveView("approvals")} onOpenDevice={setDeviceDetail} onPair={() => setIsPairingOpen(true)} onRevoke={setRevokeTarget} onSelectAgent={setSelectedAgentId} onSelectTab={setDetailTab} /> : null}
        {activeView === "approvals" ? <ApprovalsView agents={agents} approvals={approvals} deepLinkRequest={approvalTarget} onBack={() => setActiveView("agents")} onOpen={openApproval} /> : null}
        {activeView === "activity" ? <ActivityView events={events} onBack={() => setActiveView("agents")} /> : null}
        {activeView === "security" ? <SecurityView user={user} onEmailBound={(updated) => { setUser(updated); setNotice("邮箱已绑定，可用于恢复账号"); }} /> : null}
      </main>

      <div className="mobile-nav" aria-label="移动端导航">{navigation.map((item) => <button className={activeView === item.id ? "is-active" : ""} key={item.id} onClick={() => setActiveView(item.id)} type="button">{item.icon}<span>{item.label}</span></button>)}</div>

      {isCreateOpen ? <Modal title="创建 Agent" onClose={() => setIsCreateOpen(false)}><div className="modal-copy"><p>名称将用于你的身份控制台。服务端会生成长期稳定的 Agent ID，并将当前账户设为 Owner。</p></div><label className="field-label" htmlFor="agent-name">Agent 名称</label><input autoFocus id="agent-name" onChange={(event) => setNewAgentName(event.target.value)} placeholder="例如：旅行助理" value={newAgentName} /><div className="modal-actions"><button className="button button-quiet" onClick={() => setIsCreateOpen(false)} type="button">取消</button><button className="button button-primary" disabled={!newAgentName.trim() || isBusy} onClick={() => void handleCreateAgent()} type="button">创建 Agent <RightOutlined /></button></div></Modal> : null}
      {isPairingOpen && selectedAgent ? <PairingModal onClose={() => setIsPairingOpen(false)} onCopy={copyValue} /> : null}
      {approvalTarget ? <ApprovalModal agents={agents} busy={isBusy} request={approvalTarget} selectedAgentId={approvalAgentId} onApprove={handleApprove} onDeny={() => void handleDeny()} onSelectAgent={setApprovalAgentId} onClose={() => setApprovalTarget(null)} /> : null}
      {deviceDetail ? <DeviceDrawer device={deviceDetail} onClose={() => setDeviceDetail(null)} onCopy={copyValue} onRevoke={() => setRevokeTarget(deviceDetail)} /> : null}
      {revokeTarget ? <RevokeModal busy={isBusy} device={revokeTarget} name={revokeName} onChange={setRevokeName} onClose={() => { setRevokeTarget(null); setRevokeName(""); }} onConfirm={() => void handleRevoke()} /> : null}
    </div>
  );
}

function SignInScreen({ error, onSignedIn }: { error: string | null; onSignedIn: (user?: CurrentUser) => void }) {
  const [authMode, setAuthMode] = useState<"password" | "email">("password");
  const [accountMode, setAccountMode] = useState<"login" | "register">("login");
  const [emailMode, setEmailMode] = useState<"login" | "recovery">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [registrationCodeSent, setRegistrationCodeSent] = useState(false);
  const [consoleDelivery, setConsoleDelivery] = useState(false);
  const [notice, setNotice] = useState("");
  const [mailboxNotice, setMailboxNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const submitPassword = async () => {
    setBusy(true);
    try {
      if (accountMode === "register") {
        if (registrationCodeSent) {
          const verifiedUser = await agentIdApi.verifyRegistration(email.trim(), code.trim());
          await onSignedIn(verifiedUser);
        } else {
          const result = await agentIdApi.registerAccount(username.trim(), email.trim(), password, displayName.trim() || undefined);
          setRegistrationCodeSent(true);
          setConsoleDelivery(result.delivery === "console");
          setNotice(`注册验证码已发送，有效期至 ${formatTime(result.expiresAt)}。`);
        }
      } else {
        const signedInUser = await agentIdApi.login(username.trim(), password);
        await onSignedIn(signedInUser);
      }
    } catch (requestError) {
      setNotice(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };
  const resendRegistration = async () => {
    setBusy(true);
    try {
      const result = await agentIdApi.resendRegistrationCode(email.trim());
      setConsoleDelivery(result.delivery === "console");
      setNotice(`注册验证码已重新发送，有效期至 ${formatTime(result.expiresAt)}。`);
    } catch (requestError) {
      setNotice(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };
  const start = async () => {
    setBusy(true);
    setCode("");
    setNotice("");
    try {
      if (emailMode === "recovery") {
        const result = await agentIdApi.startAccountRecovery(email.trim());
        setConsoleDelivery(result.delivery === "console");
        setNotice(`恢复验证码已发送，有效期至 ${formatTime(result.expiresAt)}。`);
      } else {
        const result = await agentIdApi.startEmailCode(email.trim());
        setNotice(result.message);
        setConsoleDelivery(result.delivery === "console");
      }
      setCodeSent(true);
    } catch (requestError) {
      setNotice(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    setBusy(true);
    try {
      let signedInUser: CurrentUser;
      if (emailMode === "recovery") {
        if (recoveryPassword.length < 8) throw new Error("新密码至少需要 8 位。");
        signedInUser = await agentIdApi.completeAccountRecovery(email.trim(), code.trim(), recoveryPassword);
      } else {
        const result = await agentIdApi.consumeEmailCode(email.trim(), code.trim());
        signedInUser = result.user;
      }
      await onSignedIn(signedInUser);
    } catch (requestError) {
      setNotice(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };
  const readDemoMailbox = async () => {
    setBusy(true);
    try {
      const result = await agentIdApi.getDemoMailbox(email.trim());
      if (!result.code) throw new Error("本地邮箱桥还没有收到验证码，请先发送验证码。");
      setCode(result.code);
      setMailboxNotice(`已读取本地演示邮箱中的验证码，有效期至 ${result.expiresAt ? formatTime(result.expiresAt) : "未知"}。`);
    } catch (requestError) {
      setMailboxNotice(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };
  const readConsoleMailbox = async () => {
    setBusy(true);
    try {
      const result = await agentIdApi.getConsoleMailbox(email.trim());
      if (!result.code) throw new Error("本地验证码不存在或已过期，请重新发送验证码。");
      setCode(result.code);
      setNotice(`已读取本次验证码，有效期至 ${result.expiresAt ? formatTime(result.expiresAt) : "未知"}。`);
    } catch (requestError) {
      setNotice(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-lockup"><div className="brand-mark">A</div><div><strong>AgentID</strong><span>IDENTITY CONSOLE</span></div></div>
        <span className="eyebrow">ACCOUNT ACCESS</span>
        <h1>{accountMode === "register" && authMode === "password" ? "创建账号" : "登录"}</h1>
        <p>{authMode === "password" ? "使用账号和密码访问 AgentID 控制台。注册时需要验证邮箱，忘记密码时可用邮箱恢复。登录后即可管理 Agent 和授权设备。" : "使用已绑定邮箱登录，或通过邮箱验证码重置账号密码。"}</p>
        {error ? <div className="surface-error" role="alert">{error}</div> : null}
        <div className="auth-tabs" role="tablist">
          <button className={authMode === "password" ? "is-active" : ""} onClick={() => { setAuthMode("password"); setCodeSent(false); setConsoleDelivery(false); }} role="tab" type="button">账号密码</button>
          <button className={authMode === "email" ? "is-active" : ""} onClick={() => { setAuthMode("email"); setCodeSent(false); setConsoleDelivery(false); }} role="tab" type="button">邮箱登录 / 恢复</button>
        </div>
        {authMode === "password" ? (
          <>
            <div className="auth-switch"><span>{accountMode === "register" ? "已有账号？" : "还没有账号？"}</span><button className="text-action" onClick={() => { setAccountMode(accountMode === "register" ? "login" : "register"); setRegistrationCodeSent(false); setCode(""); setNotice(""); }} type="button">{accountMode === "register" ? "返回登录" : "创建账号"}</button></div>
            <label className="field-label" htmlFor="username">账号</label>
            <input autoComplete="username" disabled={accountMode === "register" && registrationCodeSent} id="username" onChange={(event) => setUsername(event.target.value)} placeholder="例如 agent_owner" value={username} />
            <label className="field-label" htmlFor="password">密码</label>
            <input autoComplete={accountMode === "register" ? "new-password" : "current-password"} disabled={accountMode === "register" && registrationCodeSent} id="password" onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" type="password" value={password} />
            {accountMode === "register" ? (
              <>
                <label className="field-label" htmlFor="register-email">绑定邮箱</label>
                <input autoComplete="email" disabled={registrationCodeSent} id="register-email" inputMode="email" onChange={(event) => setEmail(event.target.value)} placeholder="用于验证和找回账号" type="email" value={email} />
                {registrationCodeSent ? (
                  <>
                    <label className="field-label verification-code-label" htmlFor="registration-code">邮箱验证码</label>
                    <input autoComplete="one-time-code" id="registration-code" inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="输入邮件中的 6 位验证码" value={code} />
                    {consoleDelivery ? <button className="button button-quiet auth-submit" disabled={busy} onClick={() => void readConsoleMailbox()} type="button">读取本地验证码</button> : null}
                    {demoModeEnabled ? <button className="button button-quiet auth-submit" disabled={busy} onClick={() => void readDemoMailbox()} type="button">读取本地演示邮箱验证码</button> : null}
                  </>
                ) : null}
                <label className="field-label" htmlFor="display-name">显示名称（可选）</label>
                <input disabled={registrationCodeSent} id="display-name" onChange={(event) => setDisplayName(event.target.value)} placeholder="例如 Agent Owner" value={displayName} />
              </>
            ) : null}
            <button className="button button-primary auth-submit" disabled={username.trim().length < 3 || password.length < 8 || (accountMode === "register" && (!email.includes("@") || (registrationCodeSent && code.length !== 6))) || busy} onClick={() => void submitPassword()} type="button">{accountMode === "register" ? (registrationCodeSent ? "验证邮箱并创建账号" : "发送注册验证码") : "登录"} <RightOutlined /></button>
            {accountMode === "register" && registrationCodeSent ? <button className="text-action" disabled={busy} onClick={() => void resendRegistration()} type="button">重新发送注册验证码</button> : null}
          </>
        ) : (
          <>
            <div className="auth-switch"><span>{emailMode === "recovery" ? "记得密码？" : "忘记密码？"}</span><button className="text-action" onClick={() => { setEmailMode(emailMode === "recovery" ? "login" : "recovery"); setCodeSent(false); setCode(""); setConsoleDelivery(false); }} type="button">{emailMode === "recovery" ? "返回邮箱登录" : "邮箱恢复密码"}</button></div>
            <label className="field-label" htmlFor="email">绑定邮箱</label>
            <input disabled={codeSent} id="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
            {codeSent ? (
              <>
                <label className="field-label verification-code-label" htmlFor="login-code">6 位验证码</label>
                <input autoComplete="one-time-code" id="login-code" inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="123456" value={code} />
                {consoleDelivery ? <button className="button button-quiet auth-submit" disabled={busy} onClick={() => void readConsoleMailbox()} type="button">读取本地验证码</button> : null}
                {emailMode === "recovery" ? <><label className="field-label" htmlFor="recovery-password">新密码</label><input autoComplete="new-password" id="recovery-password" onChange={(event) => setRecoveryPassword(event.target.value)} placeholder="至少 8 位" type="password" value={recoveryPassword} /></> : null}
                {demoModeEnabled ? <><button className="button button-quiet auth-submit" disabled={busy} onClick={() => void readDemoMailbox()} type="button">读取本地演示邮箱验证码</button>{mailboxNotice ? <p className="auth-notice" role="status">{mailboxNotice}</p> : null}</> : null}
                <button className="button button-primary auth-submit" disabled={code.length !== 6 || (emailMode === "recovery" && recoveryPassword.length < 8) || busy} onClick={() => void verify()} type="button">{emailMode === "recovery" ? "验证并恢复账号" : "验证并登录"} <RightOutlined /></button>
                <button className="text-action" disabled={busy} onClick={() => void start()} type="button">重新发送验证码</button>
              </>
            ) : <button className="button button-primary auth-submit" disabled={!email.includes("@") || busy} onClick={() => void start()} type="button">{emailMode === "recovery" ? "发送恢复验证码" : "发送登录验证码"} <RightOutlined /></button>}
          </>
        )}
        {notice ? <p className="auth-notice" role="status">{notice}</p> : null}
      </section>
    </main>
  );
}

function LoadingScreen() {
  return <main className="auth-shell"><section className="auth-panel loading-panel"><span className="eyebrow">AGENTID</span><h1>正在加载身份控制台</h1><p>只会显示服务端确认的身份和授权状态。</p></section></main>;
}

function AgentsView({ agents, publicProfile, members, instances, selectedAgent, selectedAgentId, detailTab, onSavePublicProfile, onCreate, onRename, onOpenApprovals, onOpenDevice, onPair, onRevoke, onSelectAgent, onSelectTab }: { agents: Agent[]; publicProfile: AgentPublicProfile | null; members: AgentMember[]; instances: Instance[]; selectedAgent: Agent | null; selectedAgentId: string; detailTab: DetailTab; onSavePublicProfile: (profile: Omit<AgentPublicProfile, "agentId" | "updatedAt">) => Promise<void>; onCreate: () => void; onRename: (agent: Agent) => void; onOpenApprovals: () => void; onOpenDevice: (device: Instance) => void; onPair: () => void; onRevoke: (device: Instance) => void; onSelectAgent: (id: string) => void; onSelectTab: (tab: DetailTab) => void }) {
  const tabs: Array<{ id: DetailTab; label: string }> = [{ id: "devices", label: "设备" }, { id: "public", label: "公开资料" }, { id: "members", label: "成员" }, { id: "rules", label: "规则" }, { id: "activity", label: "活动" }];
  return <section className="page page-agents"><div className="page-heading"><div><span className="eyebrow">WORKSPACE</span><h1>我的 Agent</h1><p>控制哪些 OpenClaw 实例可以代表你的 Agent 运行。</p></div><button className="button button-primary" onClick={onCreate} type="button"><PlusOutlined /> 创建 Agent</button></div><div className="workspace-grid"><section className="agent-index" aria-label="Agent 列表"><div className="index-heading"><span>你的 Agent</span><span>{agents.length}</span></div>{agents.map((agent) => <button className={`agent-row ${agent.id === selectedAgentId ? "is-selected" : ""}`} key={agent.id} onClick={() => onSelectAgent(agent.id)} type="button"><span className="agent-monogram">{agent.name.slice(0, 1)}</span><span className="agent-row-copy"><strong>{agent.name}</strong><small>{agent.pendingApprovalCount ? `${agent.pendingApprovalCount} 个待授权请求` : `${agent.instanceCount} 台已授权设备`}</small></span>{agent.pendingApprovalCount ? <b className="request-pip">{agent.pendingApprovalCount}</b> : <RightOutlined />}</button>)}</section>{selectedAgent ? <section className="agent-workspace"><div className="agent-identity-strip"><div><span className="eyebrow">AGENT / {selectedAgent.id}</span><div className="agent-title-line"><h2>{selectedAgent.name}</h2><span className="trust-badge"><CheckCircleFilled /> {selectedAgent.role === "owner" ? "Owner" : selectedAgent.role}</span></div><p>Agent ID 由服务端管理；已绑定的设备可在不泄露账户 ID 的情况下代表它通信。</p></div><div className="workspace-actions"><button className="icon-button" aria-label="重命名 Agent" onClick={() => onRename(selectedAgent)} title="重命名 Agent" type="button"><SettingOutlined /></button><a className="button button-quiet" href={pageUrl("agent-public.html", `?agent=${encodeURIComponent(selectedAgent.id)}`)} target="_blank" rel="noreferrer"><LinkOutlined /> 公共页面</a>{selectedAgent.pendingApprovalCount ? <button className="button button-quiet with-count" onClick={onOpenApprovals} type="button">待处理请求 <b>{selectedAgent.pendingApprovalCount}</b></button> : null}<button className="button button-primary" onClick={onPair} type="button"><LinkOutlined /> 连接设备</button></div></div><div className="agent-tabs" role="tablist">{tabs.map((tab) => <button aria-selected={detailTab === tab.id} className={detailTab === tab.id ? "is-active" : ""} key={tab.id} onClick={() => onSelectTab(tab.id)} role="tab" type="button">{tab.label}</button>)}</div>{detailTab === "devices" ? <DeviceTable instances={instances} onOpen={onOpenDevice} onPair={onPair} onRevoke={onRevoke} /> : null}{detailTab === "public" ? <PublicProfilePanel agent={selectedAgent} profile={publicProfile} onSave={onSavePublicProfile} /> : null}{detailTab === "members" ? <MembersPanel members={members} /> : null}{detailTab === "rules" ? <div className="plain-panel rules-panel"><div><span className="label">新设备</span><strong>需要 Owner 批准</strong><p>网站会核对设备名称、实例公钥和权限范围。</p></div><div><span className="label">凭证期限</span><strong>90 天</strong><p>已撤销或密钥变化的设备必须重新链接。</p></div><div><span className="label">身份模式</span><strong>兼容模式</strong><p>未升级节点仍可互通；严格模式由插件策略启用。</p></div></div> : null}{detailTab === "activity" ? <div className="plain-panel activity-panel"><div><span>服务端审计</span><strong>身份事件在“活动记录”中查看</strong><p>设备授权、拒绝与撤销均由服务端写入不可变审计流。</p></div></div> : null}</section> : <EmptyAgentWorkspace onCreate={onCreate} />}</div></section>;
}

function PublicProfilePanel({ agent, profile, onSave }: { agent: Agent; profile: AgentPublicProfile | null; onSave: (profile: Omit<AgentPublicProfile, "agentId" | "updatedAt">) => Promise<void> }) {
  const [summary, setSummary] = useState(profile?.summary ?? "");
  const [role, setRole] = useState(profile?.role ?? "");
  const [language, setLanguage] = useState(profile?.language ?? "");
  const [published, setPublished] = useState(profile?.published ?? false);
  const [attributes, setAttributes] = useState<PublicAttribute[]>(profile?.attributes ?? []);
  const [allowDiscovery, setAllowDiscovery] = useState(profile?.connection?.allowDiscovery ?? false);
  const [allowDirectDial, setAllowDirectDial] = useState(profile?.connection?.allowDirectDial ?? false);
  const [peerId, setPeerId] = useState(profile?.connection?.peerId ?? "");
  const [multiaddrs, setMultiaddrs] = useState(profile?.connection?.multiaddrs.join("\n") ?? "");
  const [relayMultiaddrs, setRelayMultiaddrs] = useState(profile?.connection?.relayMultiaddrs.join("\n") ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSummary(profile?.summary ?? "");
    setRole(profile?.role ?? "");
    setLanguage(profile?.language ?? "");
    setPublished(profile?.published ?? false);
    setAttributes(profile?.attributes ?? []);
    setAllowDiscovery(profile?.connection?.allowDiscovery ?? false);
    setAllowDirectDial(profile?.connection?.allowDirectDial ?? false);
    setPeerId(profile?.connection?.peerId ?? "");
    setMultiaddrs(profile?.connection?.multiaddrs.join("\n") ?? "");
    setRelayMultiaddrs(profile?.connection?.relayMultiaddrs.join("\n") ?? "");
  }, [profile]);

  const addAttribute = () => setAttributes((current) => [...current, { key: `attribute-${Date.now()}`, label: "公开属性", value: "", kind: "capability", trust: "self_declared", visible: true }]);
  const addSuggestedAttribute = (suggestion: Pick<PublicAttribute, "key" | "label" | "value" | "kind">) => setAttributes((current) => current.some((attribute) => attribute.key === suggestion.key || (attribute.kind === suggestion.kind && attribute.value === suggestion.value)) ? current : [...current, { ...suggestion, trust: "self_declared", visible: true }]);
  const updateAttribute = (index: number, patch: Partial<PublicAttribute>) => setAttributes((current) => current.map((attribute, currentIndex) => currentIndex === index ? { ...attribute, ...patch } : attribute));
  const removeAttribute = (index: number) => setAttributes((current) => current.filter((_, currentIndex) => currentIndex !== index));
  const save = async () => {
    setBusy(true);
    try {
      await onSave({ summary: summary.trim(), role: role.trim(), language: language.trim(), published, attributes: attributes.filter((attribute) => attribute.value.trim()).map((attribute) => ({ ...attribute, value: attribute.value.trim() })), connection: { allowDiscovery, allowDirectDial, peerId: peerId.trim() || null, multiaddrs: multiaddrs.split(/\r?\n/).map((value) => value.trim()).filter(Boolean), relayMultiaddrs: relayMultiaddrs.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) } });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } finally {
      setBusy(false);
    }
  };

  return <div className="public-profile-panel"><div className="public-profile-header"><div><span className="eyebrow">PUBLIC PROFILE</span><h3>公开资料</h3><p>这些内容会显示在 Agent 目录和公开详情页。用户 ID、设备和 IBC 永远不会公开。</p></div><label className="publish-switch"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /><span className="switch-track" /><span>{published ? "已发布" : "草稿"}</span></label></div><div className="public-profile-grid"><div className="public-profile-form"><label className="field-label" htmlFor="public-summary">公开简介</label><textarea id="public-summary" maxLength={500} onChange={(event) => setSummary(event.target.value)} placeholder="说明这个 Agent 适合处理什么任务" value={summary} /><div className="form-row"><div><label className="field-label" htmlFor="public-role">Agent 角色</label><input id="public-role" onChange={(event) => setRole(event.target.value)} placeholder="例如：研究助理" value={role} /></div><div><label className="field-label" htmlFor="public-language">运行环境</label><input id="public-language" onChange={(event) => setLanguage(event.target.value)} placeholder="例如：TypeScript" value={language} /></div></div><div className="profile-connection-settings"><div className="profile-section-heading"><div><strong>连接发现</strong><span>开启后，第三方可以通过公共页面请求本机 OpenClaw 连接。</span></div><label className="attribute-visibility"><input type="checkbox" checked={allowDiscovery} onChange={(event) => setAllowDiscovery(event.target.checked)} />允许发现</label></div><label className="field-label" htmlFor="public-peer-id">PeerID</label><input id="public-peer-id" onChange={(event) => setPeerId(event.target.value)} placeholder="12D3KooW..." value={peerId} /><label className="field-label" htmlFor="public-multiaddrs">Direct multiaddr（每行一个）</label><textarea id="public-multiaddrs" onChange={(event) => setMultiaddrs(event.target.value)} placeholder="/ip4/203.0.113.10/tcp/4001/p2p/12D3KooW..." value={multiaddrs} /><label className="attribute-visibility"><input type="checkbox" checked={allowDirectDial} onChange={(event) => setAllowDirectDial(event.target.checked)} />允许公开直连地址</label><label className="field-label" htmlFor="public-relay-multiaddrs">Relay multiaddr（每行一个）</label><textarea id="public-relay-multiaddrs" onChange={(event) => setRelayMultiaddrs(event.target.value)} placeholder="/ip4/relay.example/tcp/4001/p2p/12D3KooW.../p2p-circuit" value={relayMultiaddrs} /></div><div className="profile-section-heading"><div><strong>公开属性</strong><span>默认标记为自声明，不代表身份服务背书。</span></div><button className="button button-quiet" type="button" onClick={addAttribute}><PlusOutlined /> 添加属性</button></div><div className="profile-suggestions" aria-label="快速添加公开属性"><span>快速添加</span><div>{suggestedProfileAttributes.map((suggestion) => <button className="attribute-suggestion" key={suggestion.key} onClick={() => addSuggestedAttribute(suggestion)} type="button">{suggestion.value}</button>)}</div></div><div className="profile-attribute-editor">{attributes.length ? attributes.map((attribute, index) => <div className="profile-attribute-row" key={attribute.key}><input aria-label={`属性 ${index + 1} 值`} onChange={(event) => updateAttribute(index, { value: event.target.value })} placeholder="research" value={attribute.value} /><input aria-label={`属性 ${index + 1} 标签`} onChange={(event) => updateAttribute(index, { label: event.target.value })} placeholder="属性说明" value={attribute.label} /><select aria-label={`属性 ${index + 1} 类型`} onChange={(event) => updateAttribute(index, { kind: event.target.value as PublicAttribute["kind"] })} value={attribute.kind}><option value="capability">能力</option><option value="tag">标签</option><option value="context">项目</option></select><label className="attribute-visibility"><input type="checkbox" checked={attribute.visible} onChange={(event) => updateAttribute(index, { visible: event.target.checked })} />公开</label><button className="icon-button danger" type="button" onClick={() => removeAttribute(index)} aria-label="删除属性">×</button></div>) : <div className="profile-empty-attributes">还没有公开属性。添加能力、标签或项目。</div>}</div><div className="profile-form-actions"><span>{saved ? "已保存" : "保存后公开页面会自动更新"}</span><button className="button button-primary" disabled={busy} onClick={() => void save()} type="button">{busy ? "保存中…" : "保存公开资料"}</button></div></div><div className="public-profile-preview"><div className="preview-label"><span>访客预览</span><a href={pageUrl("agent-public.html", `?agent=${encodeURIComponent(agent.id)}`)} target="_blank" rel="noreferrer">打开公开页 ↗</a></div><div className="preview-card"><div className="preview-card-top"><span className="preview-monogram">{agent.name.slice(0, 2).toUpperCase()}</span><span className={published ? "preview-published" : "preview-draft"}>{published ? "公开" : "草稿"}</span></div><h4>{agent.name}</h4><p>{summary || "还没有公开简介"}</p><div className="preview-meta"><span>{role || "未设置角色"}</span><span>{language || "未设置环境"}</span></div><div className="preview-attributes">{attributes.filter((attribute) => attribute.visible && attribute.value.trim()).slice(0, 5).map((attribute) => <span key={attribute.key}>{attribute.value}</span>)}</div><div className="preview-footer"><SafetyCertificateOutlined /> 身份状态由 AgentID 服务验证</div></div></div></div></div>;
}

function MembersPanel({ members }: { members: AgentMember[] }) {
  return <div className="plain-panel">{members.map((member) => <div className="member-line" key={member.userId}><span className="avatar large"><UserOutlined /></span><span><strong>{member.displayName}</strong><small>{member.email}</small></span><span className="status status-online">{member.role}</span></div>)}</div>;
}

function EmptyAgentWorkspace({ onCreate }: { onCreate: () => void }) {
  return <section className="agent-workspace empty-device-state"><SafetyCertificateOutlined /><h3>创建第一个 Agent</h3><p>创建后，OpenClaw 客户端即可为它发起实例授权。</p><button className="button button-primary" onClick={onCreate} type="button"><PlusOutlined /> 创建 Agent</button></section>;
}

function DeviceTable({ instances, onOpen, onPair, onRevoke }: { instances: Instance[]; onOpen: (device: Instance) => void; onPair: () => void; onRevoke: (device: Instance) => void }) {
  return <div className="device-section"><div className="device-section-header"><span>{instances.length} 台已授权设备</span><span className="technical-note">Instance ID 和公钥指纹仅在技术详情显示</span></div>{instances.length ? <div className="device-table" role="table"><div className="device-table-head" role="row"><span>设备</span><span>状态</span><span>凭证</span><span>系统</span><span>操作</span></div>{instances.map((device) => { const status = instanceStatus(device); return <div className="device-table-row" key={device.jti} role="row"><div className="device-name-cell"><span className="device-icon"><LaptopOutlined /></span><span><strong>{device.instanceLabel}</strong><small>{device.publicKeyFingerprint}</small></span></div><span className={`status status-${status.className}`}>{status.label}</span><span className="expiry-cell">{expiryLabel(device.expiresAt)}</span><span>{device.platform}</span><div className="row-actions"><button className="text-action" onClick={() => onOpen(device)} type="button">查看</button>{device.status === "active" ? <button className="text-action is-danger" onClick={() => onRevoke(device)} type="button">撤销</button> : null}</div></div>; })}</div> : <div className="empty-device-state"><LaptopOutlined /><h3>还没有已授权设备</h3><p>在 OpenClaw 客户端执行连接命令后，授权请求会出现在待授权中。</p><button className="button button-primary" onClick={onPair} type="button"><LinkOutlined /> 连接设备</button></div>}</div>;
}

function ApprovalsView({ agents, approvals, deepLinkRequest, onBack, onOpen }: { agents: Agent[]; approvals: Approval[]; deepLinkRequest: Approval | null; onBack: () => void; onOpen: (request: Approval) => void }) {
  const requests = deepLinkRequest && !approvals.some((request) => request.id === deepLinkRequest.id) && deepLinkRequest.status === "pending" ? [deepLinkRequest, ...approvals] : approvals;
  return <section className="page"><div className="page-heading"><div><span className="eyebrow">SECURITY QUEUE</span><h1>待授权</h1><p>只批准你刚刚在 OpenClaw 客户端发起的请求。</p></div><button className="button button-quiet" onClick={onBack} type="button"><ArrowLeftOutlined /> 返回 Agent</button></div>{requests.length ? <section className="approval-list">{requests.map((request) => <div className="approval-row" key={request.id}><div className="approval-device"><LaptopOutlined /><span><strong>{request.instanceLabel}</strong><small>{request.platform}</small></span></div><div><span className="label">目标 Agent</span><strong>{agents.find((agent) => agent.id === request.agentId)?.name ?? "登录后选择"}</strong></div><div><span className="label">到期时间</span><strong className="countdown">{formatTime(request.expiresAt)}</strong></div><div><span className="label">公钥指纹</span><code>{request.publicKeyFingerprint}</code></div><button className="button button-primary" onClick={() => onOpen(request)} type="button">核对并授权 <RightOutlined /></button></div>)}</section> : <section className="empty-device-state compact"><CheckCircleFilled className="success-icon" /><h3>没有待处理请求</h3><p>从 OpenClaw 客户端发起连接后，新的设备请求会安全地显示在这里。</p></section>}<div className="approval-footnote"><SafetyCertificateOutlined /> 登录成功后，核对设备名称、公钥指纹和权限范围即可批准。</div></section>;
}

function ActivityView({ events, onBack }: { events: AuditEvent[]; onBack: () => void }) {
  return <section className="page"><div className="page-heading"><div><span className="eyebrow">AUDIT LOG</span><h1>活动记录</h1><p>来自服务端追加审计流的身份与授权事件。</p></div><button className="button button-quiet" onClick={onBack} type="button"><ArrowLeftOutlined /> 返回 Agent</button></div>{events.length ? <section className="audit-list">{events.map((event) => <div className="audit-item" key={event.id}><span className="audit-mark" /><time>{formatTime(event.at)}</time><strong>{event.type.replaceAll("_", " ")}</strong><span>{event.agentId ?? event.instanceId ?? "账户"}</span><span aria-hidden="true"><RightOutlined /></span></div>)}</section> : <section className="empty-device-state compact"><FileSearchOutlined /><h3>尚无审计事件</h3><p>创建 Agent、批准、拒绝和撤销设备后，事件将显示在这里。</p></section>}</section>;
}

function SecurityView({ user, onEmailBound }: { user: CurrentUser; onEmailBound: (user: CurrentUser) => void }) {
  const [email, setEmail] = useState(user.email ?? "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const sendBindingCode = async () => {
    setBusy(true);
    try {
      const result = await agentIdApi.startEmailBinding(email.trim());
      setSent(true);
      setNotice(`验证码已发送，有效期至 ${formatTime(result.expiresAt)}。`);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const verifyBindingCode = async () => {
    setBusy(true);
    try {
      const updated = await agentIdApi.verifyEmailBinding(email.trim(), code.trim());
      onEmailBound(updated);
      setNotice("邮箱已绑定，可用于恢复账号。");
      setSent(false);
      setCode("");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const readDemoMailbox = async () => {
    setBusy(true);
    try {
      const result = await agentIdApi.getDemoMailbox(email.trim());
      if (!result.code) throw new Error("本地邮箱桥还没有收到验证码，请先发送验证码。");
      setCode(result.code);
      setNotice(`已读取本地演示邮箱验证码，有效期至 ${result.expiresAt ? formatTime(result.expiresAt) : "未知"}。`);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return <section className="page"><div className="page-heading"><div><span className="eyebrow">ACCOUNT PROTECTION</span><h1>账户与安全</h1><p>管理账号密码和邮箱恢复。</p></div></div><section className="security-list"><div className="security-row"><span className="security-icon"><UserOutlined /></span><div><strong>账号</strong><p>{user.username}</p></div><span className="status status-online"><CheckCircleFilled /> 已启用</span></div><div className="security-row email-security-row"><span className="security-icon"><UserOutlined /></span><div><strong>恢复邮箱</strong><p>{user.email ?? "尚未绑定邮箱"}</p>{!user.email || sent ? <div className="email-binding-form"><input aria-label="恢复邮箱" disabled={sent} inputMode="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />{sent ? <><input aria-label="邮箱验证码" inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="6 位验证码" value={code} />{demoModeEnabled ? <button className="text-action" disabled={busy} onClick={() => void readDemoMailbox()} type="button">读取演示验证码</button> : null}<button className="text-action" disabled={code.length !== 6 || busy} onClick={() => void verifyBindingCode()} type="button">确认绑定</button></> : <button className="text-action" disabled={!email.includes("@") || busy} onClick={() => void sendBindingCode()} type="button">发送验证邮件</button>}</div> : null}{notice ? <span className="auth-notice" role="status">{notice}</span> : null}</div><span className={`status status-${user.email ? "online" : "expiring"}`}>{user.email ? <CheckCircleFilled /> : <BellOutlined />}{user.email ? " 已绑定" : " 待绑定"}</span></div></section><section className="security-note"><SafetyCertificateOutlined /><span>网站不会保存 OpenClaw 实例私钥、设备码或长期客户端令牌。</span></section></section>;
}

function PairingModal({ onClose, onCopy }: { onClose: () => void; onCopy: (value: string, label: string) => void }) {
  const command = "openclaw libp2p-mesh agentid link";
  return <Modal title="连接 OpenClaw" wide onClose={onClose}><div className="pairing-layout"><div className="pairing-qr pairing-icon"><LinkOutlined /></div><div className="pairing-copy"><span className="eyebrow">DEVICE AUTHORIZATION</span><h3>从客户端发起连接</h3><p>设备授权必须由持有 Instance ID 私钥的 OpenClaw 客户端发起。网站会核对设备名称、公钥指纹和权限范围。</p><div className="command-line"><code>{command}</code><button aria-label="复制命令" onClick={() => void onCopy(command, "连接命令")} title="复制命令" type="button"><CopyOutlined /></button></div><div className="pairing-checklist"><span><CheckOutlined /> 客户端生成 PKCE 与实例签名密钥证明</span><span><CheckOutlined /> 登录用户核对设备指纹并确认授权</span><span><CheckOutlined /> 客户端本地验证并保存 IBC</span></div></div></div></Modal>;
}

function ApprovalModal({ agents, busy, request, selectedAgentId, onApprove, onDeny, onSelectAgent, onClose }: { agents: Agent[]; busy: boolean; request: Approval; selectedAgentId: string; onApprove: () => void; onDeny: () => void; onSelectAgent: (value: string) => void; onClose: () => void }) {
  const proposedAgentId = request.proposedAgentId ?? `did:agentid:agt_${request.id.replaceAll("-", "").slice(0, 24)}`;
  return <Modal secure title="创建 AgentID 并授权设备" onClose={onClose}><div className="approval-modal-heading"><span className="device-icon large"><LaptopOutlined /></span><div><h3>{request.instanceLabel}</h3><p>{request.platform} · 到期 {formatTime(request.expiresAt)}</p></div></div><div className="approval-facts"><div><span>密钥指纹</span><code>{request.publicKeyFingerprint}</code></div><div><span>申请权限</span><strong>{request.scopes.join("、")}</strong></div><div><span>AgentID</span>{request.agentCreationRequested ? <><strong>将创建新的 AgentID</strong><code>{proposedAgentId}</code></> : agents.length && selectedAgentId ? <select aria-label="选择授权 Agent" onChange={(event) => onSelectAgent(event.target.value)} value={selectedAgentId}>{agents.filter((agent) => ["owner", "admin"].includes(agent.role)).map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select> : <code>{proposedAgentId}</code>}</div></div>{request.agentCreationRequested && request.agentProfile ? <div className="approval-profile-preview"><strong>OpenClaw 自动生成的资料草稿</strong><span>{request.agentProfile.summary}</span><span>{request.agentProfile.role} · {request.agentProfile.language}</span><div>{request.agentProfile.attributes.map((attribute) => <code key={`${attribute.key}:${attribute.value}`}>{attribute.label}: {attribute.value}</code>)}</div></div> : null}<p className="phishing-note"><SafetyCertificateOutlined /> {request.agentCreationRequested ? "确认后身份服务会创建此 AgentID，并保存以上资料草稿。" : "确认后将使用所选 AgentID，并授权设备使用以上权限。"} 当前登录账户将作为授权主体。</p><div className="modal-actions split"><button className="button button-quiet" disabled={busy} onClick={onDeny} type="button"><CloseOutlined /> 拒绝请求</button><button className="button button-primary" disabled={busy} onClick={onApprove} type="button"><CheckOutlined /> 创建并授权</button></div></Modal>;
}

function RevokeModal({ busy, device, name, onChange, onClose, onConfirm }: { busy: boolean; device: Instance; name: string; onChange: (value: string) => void; onClose: () => void; onConfirm: () => void }) {
  return <Modal danger title="撤销设备授权" onClose={onClose}><div className="danger-callout"><LockOutlined /><p><strong>{device.instanceLabel}</strong> 将立即停止代表当前 Agent 通信。恢复使用必须由客户端重新发起授权。</p></div><label className="field-label" htmlFor="revoke-name">输入设备名称以确认撤销</label><input id="revoke-name" onChange={(event) => onChange(event.target.value)} placeholder={device.instanceLabel} value={name} /><div className="modal-actions"><button className="button button-quiet" disabled={busy} onClick={onClose} type="button">保留设备</button><button className="button button-danger" disabled={name !== device.instanceLabel || busy} onClick={onConfirm} type="button">撤销设备授权</button></div></Modal>;
}

function DeviceDrawer({ device, onClose, onCopy, onRevoke }: { device: Instance; onClose: () => void; onCopy: (value: string, label: string) => void; onRevoke: () => void }) {
  const status = instanceStatus(device);
  const details = [["Instance ID", device.instanceId], ["绑定编号", device.jti], ["公钥指纹", device.publicKeyFingerprint]] as const;
  return <div className="drawer-backdrop" onMouseDown={onClose} role="presentation"><aside aria-label="设备技术详情" className="device-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-header"><div><span className="eyebrow">DEVICE DETAILS</span><h2>{device.instanceLabel}</h2></div><button aria-label="关闭" className="icon-button" onClick={onClose} title="关闭" type="button"><CloseOutlined /></button></div><div className="drawer-overview"><span className={`status status-${status.className}`}>{status.label}</span><p>平台：{device.platform}</p><p>凭证：{expiryLabel(device.expiresAt)}</p></div><section className="technical-details"><h3>技术详情</h3>{details.map(([label, value]) => <div className="technical-row" key={label}><span>{label}</span><code>{value}</code><button aria-label={`复制${label}`} onClick={() => void onCopy(value, label)} title={`复制${label}`} type="button"><CopyOutlined /></button></div>)}</section>{device.status === "active" ? <section className="drawer-danger"><span className="label">危险操作</span><p>撤销后，这台设备必须重新通过网站授权才能代表当前 Agent 通信。</p><button className="button button-danger-outline" onClick={onRevoke} type="button">撤销设备授权</button></section> : null}</aside></div>;
}

function Modal({ children, title, onClose, wide = false, danger = false, secure = false }: { children: ReactNode; title: string; onClose: () => void; wide?: boolean; danger?: boolean; secure?: boolean }) {
  return <div className="modal-backdrop" onMouseDown={onClose} role="presentation"><section aria-label={title} aria-modal="true" className={`modal ${wide ? "modal-wide" : ""} ${danger ? "modal-danger" : ""} ${secure ? "modal-secure" : ""}`} onMouseDown={(event) => event.stopPropagation()} role="dialog"><div className="modal-header"><div><span className="eyebrow">{secure ? "SECURITY CONFIRMATION" : danger ? "DANGEROUS ACTION" : "AGENTID"}</span><h2>{title}</h2></div><button aria-label="关闭" className="icon-button" onClick={onClose} title="关闭" type="button"><CloseOutlined /></button></div>{children}</section></div>;
}

const root = document.getElementById("root");
if (!root) throw new Error("Unable to mount AgentID control plane");

type ControlPlaneWindow = Window & { __agentIdControlPlaneRoot?: Root };
const controlPlaneWindow = window as ControlPlaneWindow;
const controlPlaneRoot = controlPlaneWindow.__agentIdControlPlaneRoot ?? createRoot(root);
controlPlaneWindow.__agentIdControlPlaneRoot = controlPlaneRoot;
controlPlaneRoot.render(<ControlPlane />);
