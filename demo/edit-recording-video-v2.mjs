import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import playwright from "../agentid-ui-demo/node_modules/playwright/index.js";

const exec = promisify(execFile);
const { chromium } = playwright;
const root = path.resolve(new URL("..", import.meta.url).pathname);
const outputDir = path.join(root, "output", "playwright", "current-round", "03-complete-user-journey");
const sourceVideo = path.join(outputDir, "browser-flow.webm");
const publicCommunicationVideo = path.join(root, "output", "playwright", "openclaw-bridge-call", "public-to-openclaw.mp4");
const workDir = path.join(outputDir, "video-edit-work-v2");
const finalMp4 = path.join(outputDir, "agentid-complete-demo-v2.mp4");
const finalWebm = path.join(outputDir, "agentid-complete-demo-v2.webm");
const cardBrowser = await chromium.launch({ channel: "chrome", headless: true });
const cardPage = await cardBrowser.newPage({ viewport: { width: 1440, height: 900 } });

await fs.rm(workDir, { recursive: true, force: true });
await fs.mkdir(workDir, { recursive: true });

async function ffmpeg(args) {
  await exec("/opt/homebrew/bin/ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
}

async function makeCard(name, text, seconds, options = {}) {
  const color = options.color ?? "#10231e";
  const fontSize = options.fontSize ?? 42;
  const y = options.y ?? 260;
  const escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const pngPath = path.join(workDir, `${name}.png`);
  const html = `<!doctype html><style>*{box-sizing:border-box}html,body{margin:0;width:1440px;height:900px;background:${color};color:#fff;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}main{position:absolute;left:96px;top:${y}px;font-size:${fontSize}px;line-height:1.42;font-weight:500;white-space:pre-line;max-width:1200px}</style><main>${escapeHtml(text)}</main>`;
  await cardPage.setContent(html);
  await cardPage.screenshot({ path: pngPath });
  return makeStill(name, pngPath, seconds);
}

async function makeStill(name, source, seconds) {
  const output = path.join(workDir, `${name}.mp4`);
  const filter = "scale=1200:864:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2:color=0x10231e,format=yuv420p";
  await ffmpeg([
    "-loop", "1", "-i", source, "-t", String(seconds), "-r", "30",
    "-vf", filter, "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p",
    output,
  ]);
  return output;
}

async function makeSourcePart(name, input, start, duration) {
  const output = path.join(workDir, `${name}.mp4`);
  await ffmpeg([
    "-ss", String(start), "-t", String(duration), "-i", input,
    "-vf", "scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2:color=0x10231e,format=yuv420p",
    "-an", "-r", "30", "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p",
    output,
  ]);
  return output;
}

const intro = await makeCard(
  "00-intro",
  "AgentID\n让 OpenClaw Agent 可被发现、授权并安全通信\n\n完整演示：从身份创建到 Agent-to-Agent 通信",
  7,
  { fontSize: 46, y: 180 },
);

const loginTitle = await makeCard("01-title-login", "01 / 用户登录\n输入邮箱，接收验证码并进入身份控制台", 2.2, { y: 300 });
const login = await makeSourcePart("02-login", sourceVideo, 0, 10);

const createTitle = await makeCard("03-title-create", "02 / 客户端创建身份\nOpenClaw 发起 agentid link --create-agent 请求", 2.2, { y: 300 });
const terminalRequest = await makeStill("04-terminal-request", path.join(outputDir, "01-terminal-command-and-request.png"), 5);

const approvalTitle = await makeCard("05-title-approval", "03 / 用户授权设备\n核对设备、公钥指纹、权限和自动生成的 Agent 资料", 2.2, { y: 300 });
const approvalFlow = await makeSourcePart("06-approval-flow", sourceVideo, 95, 15);

const ibcTitle = await makeCard("07-title-ibc", "04 / 客户端保存 IBC\nOpenClaw 轮询授权结果，验证凭证并保存本地绑定", 2.2, { y: 300 });
const terminalIbc = await makeStill("08-terminal-ibc", path.join(outputDir, "02-terminal-ibc-saved.png"), 6);

const discoveryTitle = await makeCard("09-title-discovery", "05 / 公共 Agent Discovery\n浏览公开资料，进入目标 Agent 详情页", 2.2, { y: 300 });
const discoveryFlow = await makeSourcePart("10-discovery-flow", sourceVideo, 110, 20);

const publicConnectTitle = await makeCard("11-title-public-connect", "06 / 从公共页面建立通信\n访客点击“发起通信”，网页把目标 Agent 交给本机 OpenClaw", 2.2, { y: 300 });
const publicConnect = await makeSourcePart("12-public-connect", publicCommunicationVideo, 0, 25);
const publicConnectResult = await makeStill(
  "13-public-connect-result",
  path.join(root, "output", "playwright", "openclaw-autonomous-discovery", "openclaw-discovery-connected.png"),
  4,
);

const bridgeTitle = await makeCard("14-title-bridge", "07 / OpenClaw 执行连接\nLocal Bridge 验证 Discovery Ticket，完成目标拨号", 2.2, { y: 300 });
const bridgeLogs = await makeStill(
  "15-bridge-logs",
  path.join(root, "output", "playwright", "openclaw-autonomous-discovery", "openclaw-bridge-logs.png"),
  5,
);

const p2pTitle = await makeCard("16-title-p2p", "08 / 两个 Agent 双向通信成功\nA → B、B → A：消息到达，双方 IBC 均验证通过", 2.2, { y: 300 });
const p2pSuccess = await makeStill(
  "17-p2p-success",
  path.join(root, "output", "playwright", "demo-video-frames", "0010-08-a-revoked.png"),
  7,
);

const parts = [
  intro,
  loginTitle, login,
  createTitle, terminalRequest,
  approvalTitle, approvalFlow,
  ibcTitle, terminalIbc,
  discoveryTitle, discoveryFlow,
  publicConnectTitle, publicConnect, publicConnectResult,
  bridgeTitle, bridgeLogs,
  p2pTitle, p2pSuccess,
];
const concatList = path.join(workDir, "concat.txt");
await fs.writeFile(concatList, parts.map((part) => `file '${part.replaceAll("'", "'\\''")}'`).join("\n"), "utf8");
await ffmpeg(["-f", "concat", "-safe", "0", "-i", concatList, "-c", "copy", finalMp4]);
await ffmpeg(["-i", finalMp4, "-c:v", "libvpx-vp9", "-b:v", "2M", "-an", finalWebm]);
await cardBrowser.close();

console.log(`MP4=${finalMp4}`);
console.log(`WEBM=${finalWebm}`);
