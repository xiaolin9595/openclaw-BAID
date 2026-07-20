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
const workDir = path.join(outputDir, "video-edit-work");
const finalMp4 = path.join(outputDir, "agentid-complete-demo.mp4");
const finalWebm = path.join(outputDir, "agentid-complete-demo.webm");
const cardBrowser = await chromium.launch({ channel: "chrome", headless: true });
const cardPage = await cardBrowser.newPage({ viewport: { width: 1440, height: 900 } });

await fs.rm(workDir, { recursive: true, force: true });
await fs.mkdir(workDir, { recursive: true });

async function ffmpeg(args) {
  await exec("/opt/homebrew/bin/ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
}

async function writeText(name, value) {
  const file = path.join(workDir, `${name}.txt`);
  await fs.writeFile(file, value, "utf8");
  return file;
}

async function makeCard(name, text, seconds, options = {}) {
  const color = options.color ?? "#10231e";
  const fontSize = options.fontSize ?? 48;
  const y = options.y ?? 260;
  const escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const pngPath = path.join(workDir, `${name}.png`);
  const html = `<!doctype html><style>*{box-sizing:border-box}html,body{margin:0;width:1440px;height:900px;background:${color};color:#fff;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}main{position:absolute;left:96px;top:${y}px;font-size:${fontSize}px;line-height:1.42;font-weight:500;white-space:pre-line}</style><main>${escapeHtml(text)}</main>`;
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

async function makeVideoPart(name, start, duration) {
  const output = path.join(workDir, `${name}.mp4`);
  await ffmpeg([
    "-ss", String(start), "-t", String(duration), "-i", sourceVideo,
    "-vf", "scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2:color=0x10231e,format=yuv420p",
    "-an", "-r", "30", "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p",
    output,
  ]);
  return output;
}

const intro = await makeCard(
  "00-intro",
  "AgentID\n让 OpenClaw Agent 可被发现、授权并安全通信\n\n完整演示链路\n1 用户登录    2 创建 AgentID    3 授权设备\n4 客户端保存 IBC    5 公共 Agent Discovery",
  8,
  { fontSize: 46, y: 180 },
);
const loginTitle = await makeCard("01-title-login", "01 / 用户登录\n使用真实邮箱验证码登录 AgentID 身份控制台", 2.5, { fontSize: 42, y: 300 });
const login = await makeVideoPart("02-login", 0, 10);
const createTitle = await makeCard("03-title-create", "02 / OpenClaw 发起创建\n客户端执行 agentid link --create-agent", 2.5, { fontSize: 42, y: 300 });
const terminalRequest = await makeStill("04-terminal-request", path.join(outputDir, "01-terminal-command-and-request.png"), 5);
const approvalTitle = await makeCard("05-title-approval", "03 / 设备授权\n用户核对设备、公钥指纹、权限和自动生成的资料", 2.5, { fontSize: 42, y: 300 });
const approvalFlow = await makeVideoPart("06-approval-flow", 95, 15);
const ibcTitle = await makeCard("07-title-ibc", "04 / IBC 保存\nOpenClaw 兑换授权结果并保存本地绑定", 2.5, { fontSize: 42, y: 300 });
const terminalIbc = await makeStill("08-terminal-ibc", path.join(outputDir, "02-terminal-ibc-saved.png"), 7);
const discoveryTitle = await makeCard("09-title-discovery", "05 / Agent Discovery\n公共页面展示 Agent 属性和身份验证状态", 2.5, { fontSize: 42, y: 300 });
const discoveryFlow = await makeVideoPart("10-discovery-flow", 110, 27.84);

const parts = [intro, loginTitle, login, createTitle, terminalRequest, approvalTitle, approvalFlow, ibcTitle, terminalIbc, discoveryTitle, discoveryFlow];
const concatList = path.join(workDir, "concat.txt");
await fs.writeFile(concatList, parts.map((part) => `file '${part.replaceAll("'", "'\\''")}'`).join("\n"), "utf8");
await ffmpeg(["-f", "concat", "-safe", "0", "-i", concatList, "-c", "copy", finalMp4]);
await ffmpeg(["-i", finalMp4, "-c:v", "libvpx-vp9", "-b:v", "2M", "-an", finalWebm]);
await cardBrowser.close();

console.log(`MP4=${finalMp4}`);
console.log(`WEBM=${finalWebm}`);
