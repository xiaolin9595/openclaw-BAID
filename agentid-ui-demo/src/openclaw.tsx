import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeftOutlined, LinkOutlined, ReloadOutlined } from "@ant-design/icons";
import { demoApi, demoModeEnabled, type DemoStatus } from "./agentid-api";
import { DemoPanel, startDemoP2P } from "./demo-panel";
import "./control-plane.css";
import "./openclaw.css";

const SITE_BASE = import.meta.env.BASE_URL;
const pageUrl = (page: string) => `${SITE_BASE}${page}`;

function OpenClawPage() {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [notice, setNotice] = useState("正在连接 OpenClaw 控制桥");

  useEffect(() => {
    if (!demoModeEnabled) return undefined;
    let active = true;
    const refresh = async () => {
      try {
        const next = await demoApi.getStatus();
        if (active) {
          setStatus(next);
          setNotice(next.p2p.status === "completed" ? "双向通信验证已完成" : "OpenClaw 控制桥已连接");
        }
      } catch {
        if (active) setNotice("OpenClaw 控制桥暂不可用");
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const runP2P = async (mode: "initial" | "after-revoke" = "initial") => {
    try {
      await startDemoP2P(mode);
      setNotice(mode === "initial" ? "双向验证已启动，等待两个节点返回结果" : "撤销后的拒绝验证已启动");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "P2P 验证请求失败");
    }
  };

  const reset = async () => {
    if (!window.confirm("确认重置 Demo？这会清除两个 OpenClaw 节点和演示授权状态。")) return;
    try {
      await demoApi.reset();
      window.location.reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Demo 重置失败");
    }
  };

  return <div className="openclaw-shell"><header className="openclaw-topbar"><div className="openclaw-brand"><span className="openclaw-mark">O</span><div><strong>OpenClaw</strong><span>LOCAL RUNTIME / LIBP2P MESH</span></div></div><div className="openclaw-topbar-actions"><span className="openclaw-notice">{notice}</span><a className="button button-quiet" href={pageUrl("control-plane.html")}><ArrowLeftOutlined /> 身份控制台</a><button className="icon-button" onClick={() => window.location.reload()} aria-label="刷新 OpenClaw 状态" title="刷新"><ReloadOutlined /></button></div></header><main className="openclaw-main"><section className="openclaw-hero"><div><span className="eyebrow">OPENCLAW / AGENTID RUNTIME</span><h1>OpenClaw 节点运行页</h1><p>公共网页只负责发现目标 Agent 和发起连接请求。节点状态、拨号结果、消息接收和 IBC 验证都在 OpenClaw 运行页完成。</p></div><div className="openclaw-hero-actions"><span><LinkOutlined /> 本地 Demo Control Bridge</span><strong>{status?.control.url ?? "127.0.0.1:8798"}</strong></div></section>{demoModeEnabled ? <DemoPanel status={status} onStartP2P={runP2P} onReset={() => void reset()} /> : <section className="openclaw-unavailable"><h2>OpenClaw 本地运行页</h2><p>当前没有启用 Demo Control Bridge。启动本地 Demo 后，这里会显示节点连接和双向 IBC 验证结果。</p></section>}</main></div>;
}

createRoot(document.getElementById("root")!).render(<OpenClawPage />);
