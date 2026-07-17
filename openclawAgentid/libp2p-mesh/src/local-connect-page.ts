export function localConnectPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenClaw Agent Discovery</title>
  <style>
    :root { color-scheme: light; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f4f6f4; color: #17231f; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: linear-gradient(145deg, #f4f6f4, #e8efeb); }
    header { padding: 24px 32px; background: #0d3029; color: #f4fbf7; }
    header strong { font-size: 18px; letter-spacing: .04em; }
    header p { margin: 8px 0 0; color: #b9d1c7; }
    main { width: min(1040px, calc(100% - 40px)); margin: 32px auto; }
    .panel { background: #fff; border: 1px solid #d8e1dc; border-radius: 12px; box-shadow: 0 12px 36px rgba(13,48,41,.08); padding: 24px; margin-bottom: 20px; }
    .eyebrow { color: #177f6e; font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
    h1, h2 { margin: 8px 0; }
    h1 { font-size: clamp(28px, 5vw, 44px); }
    h2 { font-size: 20px; }
    .search { display: flex; gap: 10px; margin-top: 20px; }
    input { flex: 1; min-width: 0; border: 1px solid #bdcbc4; border-radius: 7px; padding: 12px 14px; font-size: 15px; }
    button { border: 0; border-radius: 7px; padding: 11px 16px; background: #168878; color: #fff; font-weight: 700; cursor: pointer; }
    button.secondary { background: #e7f1ed; color: #0d6659; }
    button:disabled { cursor: wait; opacity: .65; }
    .hint { color: #5f716a; font-size: 13px; }
    .results { display: grid; gap: 12px; margin-top: 18px; }
    .agent { display: flex; justify-content: space-between; align-items: center; gap: 18px; border: 1px solid #dbe5df; border-radius: 8px; padding: 16px; }
    .agent h3 { margin: 0 0 5px; font-size: 17px; }
    .agent p { margin: 0; color: #5f716a; font-size: 13px; }
    .meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
    .tag { display: inline-block; padding: 4px 7px; border-radius: 999px; background: #eef5f1; color: #2e6256; font-size: 11px; }
    .status { margin-top: 18px; padding: 14px; border-left: 3px solid #168878; background: #f0f8f4; color: #315b50; white-space: pre-wrap; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; word-break: break-all; }
    @media (max-width: 640px) { header { padding: 20px; } main { width: min(100% - 24px, 1040px); margin: 20px auto; } .panel { padding: 18px; } .search, .agent { align-items: stretch; flex-direction: column; } }
  </style>
</head>
<body>
  <header><strong>OPENCLAW / AGENT DISCOVERY</strong><p>本页面由本机 OpenClaw Local Bridge 提供。搜索和连接动作由客户端执行。</p></header>
  <main>
    <section class="panel">
      <div class="eyebrow">OpenClaw client-side discovery</div>
      <h1>从 AgentID 网站检索 Agent</h1>
      <p class="hint">OpenClaw 服务端查询 AgentID 公共目录，获取短期 Discovery Ticket，并使用本地 libp2p 节点建立通信。</p>
      <div class="search"><input id="query" placeholder="搜索 Agent 名称、能力或 AgentID" autocomplete="off"><button id="search">搜索目录</button></div>
      <div id="status" class="status" hidden></div>
    </section>
    <section class="panel"><div class="eyebrow">Public Agent directory</div><h2>可连接 Agent</h2><div id="results" class="results"><p class="hint">输入关键词后开始搜索。</p></div></section>
  </main>
  <script>
    const query = document.querySelector('#query');
    const results = document.querySelector('#results');
    const status = document.querySelector('#status');
    const search = document.querySelector('#search');
    function showStatus(message, error = false) { status.hidden = false; status.textContent = message; status.style.borderLeftColor = error ? '#b64c3c' : '#168878'; status.style.background = error ? '#fff2ef' : '#f0f8f4'; }
    function addText(parent, tag, text, className) { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; parent.append(node); return node; }
    function render(items) {
      results.replaceChildren();
      if (!items.length) { addText(results, 'p', '没有找到公开且可连接的 Agent。', 'hint'); return; }
      for (const item of items) {
        const card = document.createElement('article'); card.className = 'agent';
        const content = document.createElement('div');
        addText(content, 'h3', item.name || 'Unnamed Agent');
        addText(content, 'p', item.summary || '没有公开简介');
        addText(content, 'p', item.agentId, 'hint');
        const tags = document.createElement('div'); tags.className = 'meta';
        for (const value of item.capabilities || []) addText(tags, 'span', value, 'tag');
        content.append(tags); card.append(content);
        const button = document.createElement('button'); button.className = 'secondary'; button.textContent = '由 OpenClaw 连接';
        button.addEventListener('click', async () => {
          button.disabled = true; showStatus('OpenClaw 正在向 AgentID 网站获取 Discovery Ticket...');
          try {
            const pair = await fetch('/v1/local/pair', { method: 'POST' }).then(r => r.json());
            if (!pair.localSessionToken) throw new Error('本机配对失败');
            const response = await fetch('/v1/local/connections/from-directory', { method: 'POST', headers: { 'content-type': 'application/json', 'x-openclaw-bridge-token': pair.localSessionToken }, body: JSON.stringify({ agentId: item.agentId, label: item.name }) });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || 'OpenClaw 建立连接失败');
            showStatus('OpenClaw 已验证 Discovery Ticket，并完成目标拨号。\\nAgentID: ' + item.agentId + '\\n状态: ' + (body.status || 'dialing'));
            button.textContent = '已加入通信列表';
          } catch (error) { showStatus(String(error.message || error), true); button.disabled = false; }
        });
        card.append(button); results.append(card);
      }
    }
    async function load() {
      search.disabled = true; showStatus('OpenClaw 正在查询 AgentID 公共目录...');
      try { const params = new URLSearchParams(); if (query.value.trim()) params.set('query', query.value.trim()); const body = await fetch('/v1/local/discovery?' + params).then(r => r.json()); if (body.error) throw new Error(body.error); render(body.agents || []); showStatus('OpenClaw 已从 AgentID 网站获取 ' + (body.agents || []).length + ' 个公开 Agent。'); }
      catch (error) { showStatus(String(error.message || error), true); }
      finally { search.disabled = false; }
    }
    search.addEventListener('click', load); query.addEventListener('keydown', event => { if (event.key === 'Enter') load(); }); load();
  </script>
</body>
</html>`;
}
