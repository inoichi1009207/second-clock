#!/usr/bin/env node
/**
 * 第二时钟 —— 部署版前端构建（零依赖）
 *
 * 为什么需要这一步：仓库里的 index.html 内嵌了一枚**本地调试用**的智谱 API key
 * （常量 LOCAL_DEBUG_API_KEY）。直接把源文件传上服务器，等于把 key 发给每一个访客。
 * 本脚本产出「部署版」：抹掉该常量的值，并硬校验产物里不含任何凭据。
 *
 * 前端本身已内置双链路（源文件负责，本脚本不发明）：
 *   file://    → 直连智谱，用 LOCAL_DEBUG_API_KEY 鉴权（仅本机双击调试）
 *   http(s):// → CONFIG.useProxy 为真，走同源 /api/zhipu/chat 与 /api/zhipu/search，
 *                请求不带 Authorization，鉴权由 proxy.mjs 在服务端完成
 * 所以部署版只需把 key 置空——链路切换由 location.protocol 自动完成。
 *
 * 用法（在 deploy/ 目录下）：
 *   node build.mjs                 # 产物写到 deploy/dist/
 *   node build.mjs --out /tmp/dist # 自定义输出目录
 *
 * 本脚本只读 ../index.html 与 ../manual.html，只写输出目录，
 * **绝不改动源文件**。
 *
 * 设计取向：改写「宽容」、结论「严格」。
 * 源文件正在演进，逐条改写按命中数硬卡会一改就炸；因此改写允许 0 命中（幂等），
 * 但产物必须通过下面全部出口断言，任何一条不过就不落盘。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInDomStub } from "./smoke-dom.mjs";

/** 产物必须内置的药品条数（源库增删后要连同本常量一起改，别偷偷放行）。 */
const EXPECTED_DRUG_COUNT = 1832;

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, "..");

const outFlag = process.argv.indexOf("--out");
const outDir = outFlag !== -1 && process.argv[outFlag + 1]
  ? path.resolve(process.cwd(), process.argv[outFlag + 1])
  : path.join(here, "dist");

const problems = [];
function fail(msg) {
  console.error("[fail] " + msg);
  process.exit(1);
}
function assertOut(ok, msg) {
  if (!ok) problems.push(msg);
}

// ---------- 读源 ----------

const srcIndex = path.join(srcDir, "index.html");
const srcManual = path.join(srcDir, "manual.html");
for (const f of [srcIndex, srcManual]) {
  if (!fs.existsSync(f)) fail("源文件不存在：" + f);
}
let html = fs.readFileSync(srcIndex, "utf8");
const edits = [];

// ---------- 改写 1：抹除调试 key（必须命中，这是本脚本存在的理由） ----------

const keyDecl = /(const\s+LOCAL_DEBUG_API_KEY\s*=\s*)"[^"]*"/;
if (!keyDecl.test(html)) {
  fail(
    "未找到 LOCAL_DEBUG_API_KEY 声明。源文件结构已变——在人工确认新的密钥承载方式前，" +
    "拒绝产出部署版（若真按新写法已无内嵌密钥，请更新本脚本的断言而不是跳过本步）。"
  );
}
html = html.replace(keyDecl, '$1""');
edits.push("抹除 LOCAL_DEBUG_API_KEY");

// ---------- 改写 2：可用性判据归一（宽容，允许 0 命中） ----------

// 源文件已提供 apiCredentialReady()：代理模式下恒为 true。
// 但历史上有几处仍直接看 CONFIG.apiKey——key 一置空，部署版的「识别 / 联网查询」
// 会被这些旧判据误判为「未配置」而整体禁用。这里统一改写掉。
//
// 【2026-08-09 修】改写必须跳过 apiCredentialReady 自己的函数体。
// 那个函数的定义就是 `return CONFIG.useProxy || Boolean(CONFIG.apiKey && ...)`，
// 也就是说「肯定式判据」在全文的**唯一**命中点恰好是它自己。全局替换会把它写成
//   function apiCredentialReady() { return CONFIG.useProxy || apiCredentialReady(); }
// —— 一个无条件自我递归。file:// 下 useProxy 为假、`||` 不短路，一打开就
// RangeError: Maximum call stack size exceeded，整段初始化 IIFE 中断
// （页头「内置 0 种药品」、卡片区空白）；http(s) 下 useProxy 为真会短路，
// 线上看不出来。所以「归一」的对象只能是**引用点**，绝不能是定义点。
//
const HAS_HELPER = /function\s+apiCredentialReady\s*\(/.test(html);

/**
 * 定位具名函数体的字符区间 [start, end)（含 `function` 关键字到收尾 `}`）。
 * 用括号配平扫描；只用于 apiCredentialReady 这类短小无字符串字面量的函数，
 * 因此不做字符串/注释感知，但限定扫描窗口，配不平就返回 null 交由断言拦下。
 */
function functionRange(src, name, window = 4000) {
  const m = new RegExp("function\\s+" + name + "\\s*\\([^)]*\\)\\s*\\{").exec(src);
  if (!m) return null;
  const open = m.index + m[0].length - 1; // 指向 `{`
  let depth = 0;
  const limit = Math.min(src.length, open + window);
  for (let i = open; i < limit; i += 1) {
    const c = src[i];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return { start: m.index, end: i + 1 };
    }
  }
  return null;
}

const helperRange = HAS_HELPER ? functionRange(html, "apiCredentialReady") : null;
if (HAS_HELPER && !helperRange) {
  fail(
    "找到了 apiCredentialReady 声明但无法圈定其函数体（括号未在窗口内配平）。" +
    "不圈定就无法把它排除在改写之外，会把定义点改成自我递归——拒绝产出。"
  );
}

/**
 * 排除若干区间后的宽容改写（允许 0 命中；replacement 按字面量插入，不解释 $）。
 * skipFn 是**函数**不是常量：每次改写都会挪动后文偏移量，排除区间必须按
 * 「改写前的当前 html」现算，否则第二次调用会拿着第一次之前的旧坐标去比对。
 */
function looseExcluding(label, pattern, replacement, skipFn) {
  const skip = skipFn();
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  let out = "";
  let last = 0;
  let n = 0;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[0].length === 0) { re.lastIndex += 1; continue; }
    const hitStart = m.index;
    const hitEnd = m.index + m[0].length;
    // 与任一排除区间有交叠即跳过（不改、原样留着）
    if (skip.some((r) => r && hitStart < r.end && hitEnd > r.start)) continue;
    out += html.slice(last, hitStart) + replacement;
    last = hitEnd;
    n += 1;
  }
  out += html.slice(last);
  html = out;
  if (n) edits.push(label + " ×" + n);
}

if (HAS_HELPER) {
  // 定义点永不参与归一；现算，不吃前一次改写造成的偏移
  const skipHelper = () => [functionRange(html, "apiCredentialReady")].filter(Boolean);
  // if (!CONFIG.apiKey || !CONFIG.apiKey.trim())  →  if (!apiCredentialReady())
  looseExcluding(
    "归一否定式判据",
    /!\s*CONFIG\.apiKey\s*\|\|\s*!\s*CONFIG\.apiKey\.trim\(\)/g,
    "!apiCredentialReady()",
    skipHelper
  );
  // Boolean(CONFIG.apiKey && CONFIG.apiKey.trim())  →  apiCredentialReady()
  looseExcluding(
    "归一肯定式判据",
    /Boolean\(\s*CONFIG\.apiKey\s*&&\s*CONFIG\.apiKey\.trim\(\)\s*\)/g,
    "apiCredentialReady()",
    skipHelper
  );
}

// ---------- 出口断言（全部通过才落盘） ----------

// A. 凭据面
assertOut(
  /const\s+LOCAL_DEBUG_API_KEY\s*=\s*""/.test(html),
  "LOCAL_DEBUG_API_KEY 未被置空。"
);
// 形似 key 的长串：智谱 key 形如 <32位hex>.<16位串>；另兜底扫常见前缀
const keyShapes = [
  { re: /[0-9a-f]{24,}\.[A-Za-z0-9]{12,}/g, name: "智谱 key 形态" },
  { re: /\b(?:sk|gsk|glm)[-_][A-Za-z0-9]{16,}/gi, name: "通用密钥前缀" }
];
for (const s of keyShapes) {
  const hit = html.match(s.re);
  // 不打印命中内容，只报条数与形态名
  assertOut(!hit, "产物疑似仍含凭据：命中「" + s.name + "」" + (hit ? hit.length : 0) + " 处。");
}

// B. 链路面：部署版必须能走到同源代理
assertOut(/proxyBase:\s*"\/api\/zhipu"/.test(html), "缺少 proxyBase «/api/zhipu»，部署版无出口。");
assertOut(/useProxy:\s*!IS_FILE_PROTOCOL/.test(html), "useProxy 不再由 IS_FILE_PROTOCOL 决定，http(s) 下可能不走代理。");
assertOut(/IS_FILE_PROTOCOL\s*=\s*String\(location\.protocol/.test(html), "IS_FILE_PROTOCOL 判定已变，无法确认 http(s) 走代理。");
assertOut(/apiEndpoint\("chat"\)/.test(html) && /apiEndpoint\("search"\)/.test(html), "两条链路未统一经 apiEndpoint()，可能存在直连旁路。");

// C. 鉴权面：前端唯一一处 Authorization 必须被 !CONFIG.useProxy 守住
const authLines = (html.match(/headers\["Authorization"\]|"Authorization"\s*:/g) || []).length;
assertOut(authLines <= 1, "前端出现 " + authLines + " 处 Authorization 赋值，超出预期的 1 处（file:// 直连分支）。");
// 用「就近守卫」判定而非单条正则：赋值语句往前 200 字符内必须出现 !CONFIG.useProxy，
// 且其间不得再有 `}` 把守卫块闭合掉。
const authIdx = html.search(/headers\["Authorization"\]\s*=/);
assertOut(authIdx !== -1 || authLines === 0, "找不到 Authorization 赋值点，无法确认其守卫。");
if (authIdx !== -1) {
  const lead = html.slice(Math.max(0, authIdx - 200), authIdx);
  const guardIdx = lead.lastIndexOf("!CONFIG.useProxy");
  assertOut(guardIdx !== -1, "Authorization 赋值前 200 字符内无 !CONFIG.useProxy 守卫。");
  assertOut(
    guardIdx !== -1 && !lead.slice(guardIdx).includes("}"),
    "!CONFIG.useProxy 守卫块在 Authorization 赋值前已闭合，代理模式下仍可能下发密钥头。"
  );
}

// D. 判据面：不得残留会把部署版判死的旧闸
const staleGates = (html.match(/!\s*CONFIG\.apiKey/g) || []).length;
assertOut(
  staleGates === 0,
  "残留 " + staleGates + " 处 «!CONFIG.apiKey» 旧判据：key 置空后这些功能会被误判为未配置而禁用。" +
  (HAS_HELPER ? "（改写已尝试但未覆盖，请人工核对写法）" : "（源文件缺 apiCredentialReady()，无法自动归一）")
);

// E. 递归面：apiCredentialReady 的函数体内不得出现对自身的调用
//    （改写把定义点当引用点改掉时的直接指纹；纯文本可判，先于冒烟测试拦一道）
const outHelperRange = functionRange(html, "apiCredentialReady");
assertOut(
  !HAS_HELPER || outHelperRange !== null,
  "产物里 apiCredentialReady 的函数体无法圈定，无法排除自我递归。"
);
if (outHelperRange) {
  const body = html.slice(outHelperRange.start, outHelperRange.end);
  // 去掉函数头（形参表里不会有调用），只看体内
  const bodyOnly = body.slice(body.indexOf("{"));
  assertOut(
    !/apiCredentialReady\s*\(/.test(bodyOnly),
    "apiCredentialReady 函数体内出现了对自身的调用 —— 这是无条件自我递归，" +
    "file:// 下打开即 RangeError，初始化会整段中断（页面显示「内置 0 种药品」）。"
  );
}

// F. 冒烟面：把产物真跑一遍（node:vm + DOM 桩），protocol 取最脆弱的 file://
//    形态断言看不出「跑不跑得起来」，这一条专治那类缺陷。
const smoke = runInDomStub(html, { protocol: "file:" });
assertOut(smoke.ok, "产物在 DOM 桩里初始化抛异常（file://）：" + (smoke.error || ""));
if (smoke.ok) {
  assertOut(
    smoke.drugCount === EXPECTED_DRUG_COUNT,
    "产物 DRUG_DB.length = " + smoke.drugCount + "，预期 " + EXPECTED_DRUG_COUNT +
    "。（药库真变了就同步改 build.mjs 顶部的 EXPECTED_DRUG_COUNT；" +
    "若为 0 或 null，多半是初始化被异常打断。）"
  );
}
// 顺带跑一遍 http(s) 链路，确保代理模式同样不炸
const smokeHttp = runInDomStub(html, { protocol: "https:" });
assertOut(smokeHttp.ok, "产物在 DOM 桩里初始化抛异常（https://）：" + (smokeHttp.error || ""));
assertOut(
  !smokeHttp.ok || smokeHttp.drugCount === EXPECTED_DRUG_COUNT,
  "https:// 下产物 DRUG_DB.length = " + smokeHttp.drugCount + "，预期 " + EXPECTED_DRUG_COUNT + "。"
);

if (problems.length) {
  console.error("[fail] 出口断言未通过，已中止，不输出任何文件：");
  for (const p of problems) console.error("       - " + p);
  process.exit(1);
}

// ---------- 落盘 ----------

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
fs.copyFileSync(srcManual, path.join(outDir, "manual.html"));

const sizeKB = (f) => Math.round(fs.statSync(path.join(outDir, f)).size / 1024);
console.log("[ok] 部署版已生成：" + outDir);
for (const e of edits) console.log("     - " + e);
const sizeB = (f) => fs.statSync(path.join(outDir, f)).size;
console.log("     index.html  " + sizeKB("index.html") + " KB (" + sizeB("index.html") + " B)");
console.log("     manual.html " + sizeKB("manual.html") + " KB (" + sizeB("manual.html") + " B)");
console.log("     冒烟：file:// 初始化通过，DRUG_DB.length = " + smoke.drugCount +
            "；https:// 同样通过。");
console.log("[ok] 出口断言全过：无内嵌凭据、代理链路完整、无残留旧判据、无自我递归、产物可跑。");
