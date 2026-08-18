#!/usr/bin/env node
/**
 * 第二时钟 —— 智谱 API 同源反代（零依赖，只用 node:http / node:https）
 *
 * 存在的理由：前端部署版不再持有 API key。浏览器只请求同源的
 *   POST /api/zhipu/chat    → https://open.bigmodel.cn/api/paas/v4/chat/completions
 *   POST /api/zhipu/search  → https://open.bigmodel.cn/api/paas/v4/web_search
 * key 只活在本进程的环境变量里，由本进程注入 Authorization 头。
 *
 * 运行：
 *   ZHIPU_API_KEY=<key> node proxy.mjs
 * 环境变量：
 *   ZHIPU_API_KEY        必填。缺失即启动失败退出（fail-closed，绝不静默降级为无鉴权转发）。
 *   PORT                 监听端口，默认 8791
 *   HOST                 监听地址，默认 127.0.0.1。**非回环地址默认拒绝启动**，见下方
 *                        「minor-5 转发头信任」一节。
 *   MAX_BODY_BYTES       请求体上限，默认 12582912（12 MiB，识别请求含 base64 照片）
 *   RATE_LIMIT           每 IP 每分钟请求数上限，默认 30
 *   GLOBAL_HOURLY_LIMIT  全局每小时请求上限，默认 600
 *   GLOBAL_DAILY_LIMIT   全局每 24 小时请求上限，默认 2000
 *   ALLOWED_ORIGINS      逗号分隔的允许来源，默认 https://2c.klinik.ren
 *   ALLOW_NON_LOOPBACK_BIND=1  显式放行非回环监听（仅供特殊调试；生产绝不设置）
 *
 * 日志纪律：只打印 方法/路径/状态码/耗时/客户端 IP。
 * 永不打印请求体、响应体、Authorization 头、key 的任何片段（含长度与前缀）。
 * 异常日志一律经 redact() 过一遍，杜绝 key 因某个上游错误对象被顺手带进 journal。
 *
 * ---------------------------------------------------------------------------
 * 【为什么这个文件到处是兜底】—— 它面向公网、无鉴权、且代转**付费**接口。
 * 两类事故会直接变成用户的损失：
 *   ① 进程崩 → systemd Restart=always + StartLimitBurst=5 连崩 5 次即 failed，
 *     **永久停服**，非人工 `systemctl reset-failed` 不能恢复。故本文件的原则是
 *     「运行期宁可带病继续，也不退出」；只有启动期的致命错误才允许非零退出。
 *   ② 无配额 → 任何人拿到域名即可换 IP 无限刷，烧的是真金白银。故除每 IP 频控外，
 *     另有进程内全局令牌桶（小时/日双闸）与 Origin 校验。
 * 注意：进程内配额在**重启后清零**，且多进程不共享。它是「限伤」不是「限死」——
 * 唯一不可绕的最后闸是智谱控制台的账户消费上限，务必去设（见 DEPLOY.md）。
 * ---------------------------------------------------------------------------
 */

import http from "node:http";
import https from "node:https";
import fsp from "node:fs/promises";

// ---------- 配置 ----------

const API_KEY = String(process.env.ZHIPU_API_KEY || "").trim();
if (!API_KEY) {
  console.error("[fatal] 环境变量 ZHIPU_API_KEY 未设置或为空，拒绝启动。");
  console.error("[fatal] 本服务不做无鉴权转发；请通过 systemd EnvironmentFile 注入后重启。");
  process.exit(1);
}

// ---------- 拍照识别的上游选择（2026-08-09 加）----------
//
// 识别链路可以走两家：智谱 GLM-4.6V-Flash（免费）或阿里云百炼 Qwen-VL（新客有免费额度）。
// 之所以把选择放在服务端而不是前端：前端那份 index.html 已经过完整验收，
// 换 provider 只是「同一个 OpenAI 兼容协议换个地址和模型名」，没有任何理由为此
// 去动一个已验证的交付物。这里改一个环境变量即可切换，切错了改回去也是一秒钟。
//
// 实测（2026-08-09，同一套 RECOGNITION_PROMPT、同三张真实药盒照片）：
//   云南白药瓶  GLM: 云南白药(曾误读成「古南白药」)   Qwen-VL: 云南白药 high
//   Panadol药片 GLM: 帕尼培南-倍他米隆钠（幻觉,两次） Qwen-VL: 对乙酰氨基酚片 high ← 正确
//   散装分药盒  GLM: 未识别（正确）                   Qwen-VL: 复方制剂 low（正确）
// 故默认取 bailian。ZHIPU 仍是联网搜索的唯一上游（百炼无等价的 web_search 接口）。
const CHAT_UPSTREAM = String(process.env.CHAT_UPSTREAM || "bailian").trim().toLowerCase();
const BAILIAN_API_KEY = String(process.env.BAILIAN_API_KEY || "").trim();
const BAILIAN_VISION_MODEL = String(process.env.BAILIAN_VISION_MODEL || "qwen-vl-plus").trim();
// 交叉验证用的「另一家」模型。刻意不用免费的 glm-4.6v-flash——实测它被限流得厉害
// (连打 6 次 5 次撞 1305「访问量过大」),而验证一旦频繁失败,这个功能就退化成摆设。
// 也刻意不用更老的免费 glm-4v-flash：验证者太弱会对正确答案提出假分歧,
// 用户很快就学会无视警告——那比没有验证更糟。
// glm-4.6v 是付费但最便宜的一档(1元/百万输入),实测 3/3 可用。
const VERIFY_ZHIPU_MODEL = String(process.env.VERIFY_ZHIPU_MODEL || "glm-4.6v").trim();
if (CHAT_UPSTREAM !== "bailian" && CHAT_UPSTREAM !== "zhipu") {
  console.error('[fatal] CHAT_UPSTREAM 只能是 "bailian" 或 "zhipu"，当前值非法，拒绝启动。');
  process.exit(1);
}
if (CHAT_UPSTREAM === "bailian" && !BAILIAN_API_KEY) {
  console.error("[fatal] CHAT_UPSTREAM=bailian 但 BAILIAN_API_KEY 未设置，拒绝启动。");
  console.error("[fatal] 要么注入该 key，要么把 CHAT_UPSTREAM 设为 zhipu 退回智谱。");
  process.exit(1);
}

function intFromEnv(name, fallback, min, max) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw < min || raw > max) return fallback;
  return Math.floor(raw);
}

const PORT = intFromEnv("PORT", 8791, 1, 65535);
const HOST = String(process.env.HOST || "127.0.0.1");
const MAX_BODY_BYTES = intFromEnv("MAX_BODY_BYTES", 12 * 1024 * 1024, 1024, 64 * 1024 * 1024);
const RATE_LIMIT = intFromEnv("RATE_LIMIT", 30, 1, 100000);
const RATE_WINDOW_MS = 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const GLOBAL_HOURLY_LIMIT = intFromEnv("GLOBAL_HOURLY_LIMIT", 600, 1, 1000000);
const GLOBAL_DAILY_LIMIT = intFromEnv("GLOBAL_DAILY_LIMIT", 2000, 1, 10000000);

// 允许的调用来源。本站前端是同源单文件应用，浏览器对 POST + application/json
// 必发 Origin，故「无 Origin」在本站属异常形态，一律按不可信处理（宁严勿宽）。
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || "https://2c.klinik.ren")
  .split(",")
  .map(function (s) { return s.trim().replace(/\/+$/, ""); })
  .filter(Boolean);

// ---------- minor-5：转发头信任必须由监听地址背书，不能只写在注释里 ----------
//
// 频控键取自 X-Real-IP / X-Forwarded-For。这两个头是**客户端可以随便伪造**的，
// 只有在「本进程只绑回环、流量必经本机 nginx、且 nginx 覆写该头」时才可信。
// 从前这个前提只写在注释里 —— 一旦有人把 HOST 改成 0.0.0.0，每 IP 频控当场失效
// （攻击者每个请求换一个 X-Real-IP 即可），而代码毫无反应。现在由代码强制：

function isLoopbackHost(h) {
  const v = String(h).trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (v === "localhost" || v === "::1" || v === "0:0:0:0:0:0:0:1") return true;
  if (v === "::ffff:127.0.0.1") return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v);
}

const HOST_IS_LOOPBACK = isLoopbackHost(HOST);
// 转发头只在回环监听时可信；非回环一律只认 socket 地址。
const TRUST_FORWARDED_HEADERS = HOST_IS_LOOPBACK;

if (!HOST_IS_LOOPBACK) {
  if (String(process.env.ALLOW_NON_LOOPBACK_BIND || "") !== "1") {
    console.error("[fatal] HOST=" + HOST + " 不是回环地址，拒绝启动。");
    console.error("[fatal] 本服务无鉴权、代转付费接口，只应由本机 nginx 反代，绝不能直接对外监听。");
    console.error("[fatal] 确需如此（仅限调试）请显式设置 ALLOW_NON_LOOPBACK_BIND=1，届时转发头将一律不被信任。");
    process.exit(1);
  }
  console.warn("[warn] 非回环监听已被 ALLOW_NON_LOOPBACK_BIND=1 放行；X-Real-IP / X-Forwarded-For 一律不信任，频控只按 socket 地址计。");
}

// 只允许这两条路径，其余一律 404。新增上游必须显式加进本表。
// 路径名沿用 /api/zhipu/*：前端那份 index.html 已按此验收通过，为了改个名字去动它
// 不划算。路径在这里只是一个不透明的键，真正决定打给谁的是下面的 url / apiKey。
const ROUTES = {
  "/api/zhipu/chat": CHAT_UPSTREAM === "bailian" ? {
    url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    apiKey: BAILIAN_API_KEY,
    // 前端请求体里的 model 是按智谱写死的（glm-4.6v-flash），百炼不认这个名字，
    // 故在转发前改写成百炼的视觉模型。除 model 外整个请求体原样透传——
    // 实测百炼对前端多带的 thinking 参数是容忍的（HTTP 200，直接忽略）。
    rewriteModel: BAILIAN_VISION_MODEL,
    timeoutMs: 120000
  } : {
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    apiKey: API_KEY,
    // 识别请求带图，上游可能思考较久；前端单次尝试预算 60s，这里留出余量
    timeoutMs: 120000
  },
  // 交叉验证专用:恒定打「另一家」。
  // 立它的理由是实测:同一张图,两家模型在三个出问题的样本上全部给出不一致的答案,
  // 而在正确样本上一致。一个模型编不编,自己说了不算;两个独立模型的分歧,是它自己没法圆的。
  "/api/verify/chat": CHAT_UPSTREAM === "bailian" ? {
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    apiKey: API_KEY,
    rewriteModel: VERIFY_ZHIPU_MODEL,
    timeoutMs: 120000
  } : {
    url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    apiKey: BAILIAN_API_KEY,
    rewriteModel: BAILIAN_VISION_MODEL,
    timeoutMs: 120000
  },
  // 联网搜索恒走智谱：百炼没有等价的 web_search 接口。
  "/api/zhipu/search": {
    url: "https://open.bigmodel.cn/api/paas/v4/web_search",
    apiKey: API_KEY,
    timeoutMs: 45000
  }
};

// ---------- 用户反馈（2026-08-09 加）----------
//
// 立这条接口的理由：如果一种药「内置药库没有」且「联网也查不到」，用户就走到死胡同了。
// 这时至少要有个地方能把这件事说出来。**它必须真的落盘**——
// 弹一句「已提交」却什么都不存，比没有这个功能更糟。
//
// 落在 systemd StateDirectory 提供的 /var/lib/2c-proxy 下（该目录是本服务
// 在 ProtectSystem=strict 之下唯一可写的地方）。只增不改，一行一条 JSON。
const FEEDBACK_PATH = "/api/feedback";
const FEEDBACK_MAX_BODY = 8 * 1024;
const FEEDBACK_FILE = String(process.env.STATE_DIRECTORY || "").split(":")[0]
  ? String(process.env.STATE_DIRECTORY).split(":")[0] + "/feedback.jsonl"
  : "";

function clip(v, max) {
  if (typeof v !== "string") return "";
  const s = v.trim();
  return s.length > max ? s.slice(0, max) : s;
}

function handleFeedback(res, parsed) {
  const drug = clip(parsed && parsed.drug, 120);
  const note = clip(parsed && parsed.note, 600);
  if (!drug && !note) {
    sendJson(res, 400, "empty_feedback", "请至少填写药品名称或说明");
    return null;
  }
  if (!FEEDBACK_FILE) {
    // 没有可写目录时**如实告知**，不假装收下
    sendJson(res, 503, "feedback_unavailable", "反馈功能暂时不可用，抱歉。");
    return null;
  }
  const line = JSON.stringify({
    at: new Date().toISOString(),
    drug: drug,
    note: note
  }) + "\n";
  return fsp.appendFile(FEEDBACK_FILE, line, { encoding: "utf8", mode: 0o600 })
    .then(function () {
      // 成功不能走 sendJson —— 那个函数固定把内容包进 {"error":{…}}，
      // 用它回 200 会得到一个自相矛盾的 {"error":{"code":"ok"}}。
      sendOk(res, "已记下，谢谢。");
      return null;
    })
    .catch(function (err) {
      logLine("warn", "反馈写入失败 " + describeErr(err));
      sendJson(res, 500, "feedback_write_failed", "没能记下来，抱歉——请稍后再试。");
      return null;
    });
}

// keep-alive 复用 TLS 连接，省掉每次识别的握手开销
const agent = new https.Agent({ keepAlive: true, maxSockets: 32, timeout: 130000 });

// ---------- 工具 ----------

// 任何进日志的字符串都先过这里：把 key 原文换成 ***，长度截断。
// 这不是「预计会出现 key」，而是「万一某个错误对象带上了它，日志也不许写出去」。
function redact(s) {
  let out = String(s == null ? "" : s);
  if (API_KEY) out = out.split(API_KEY).join("***");
  if (BAILIAN_API_KEY) out = out.split(BAILIAN_API_KEY).join("***");
  if (out.length > 300) out = out.slice(0, 300) + "…";
  return out;
}

// 只记 name/code/message，刻意不记 stack：stack 里可能带上游 URL 与内部路径，
// 对排障的增量远小于它带来的泄漏面。真要看栈就临时改这里。
function describeErr(err) {
  if (!err) return "unknown";
  const name = (err && err.name) || "Error";
  const code = (err && err.code) ? (" code=" + err.code) : "";
  return redact(name + code + " msg=" + ((err && err.message) || ""));
}

function logLine(level, msg) {
  console.log("[" + new Date().toISOString() + "] [" + level + "] " + redact(msg));
}

function clientIp(req) {
  // 只有 HOST 是回环地址时才信转发头（见上方 minor-5 一节）。
  if (TRUST_FORWARDED_HEADERS) {
    const real = req.headers["x-real-ip"];
    if (typeof real === "string" && real.trim()) return real.trim().slice(0, 64);
    const fwd = req.headers["x-forwarded-for"];
    if (typeof fwd === "string" && fwd.trim()) return fwd.split(",")[0].trim().slice(0, 64);
  }
  return (req.socket && req.socket.remoteAddress) || "-";
}

// 成功响应。与 sendJson 分开，是因为后者的形状固定是 {"error":{…}}——
// 那是给错误用的；拿它回 200 会产生 {"error":{"code":"ok"}} 这种自相矛盾的报文。
function sendOk(res, message) {
  if (res.headersSent || res.writableEnded) return;
  const body = Buffer.from(JSON.stringify({ ok: true, message: message }), "utf8");
  try {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": String(body.length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(body);
  } catch (err) {
    logLine("warn", "回写成功响应失败 " + describeErr(err));
  }
}

function sendJson(res, status, code, message, extraHeaders) {
  if (res.headersSent || res.writableEnded) return;
  const body = Buffer.from(JSON.stringify({ error: { code: String(code), message: message } }), "utf8");
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": String(body.length),
    "Cache-Control": "no-store",
    // 刻意不发任何 Access-Control-* 头：同源调用不需要，开了等于把额度送给别的站点
    "X-Content-Type-Options": "nosniff"
  };
  if (extraHeaders) {
    for (const k of Object.keys(extraHeaders)) headers[k] = extraHeaders[k];
  }
  try {
    res.writeHead(status, headers);
    res.end(body);
  } catch (err) {
    // 对端已断开等情形：记一笔就够，绝不让它冒泡成未捕获异常
    logLine("warn", "写响应失败 " + describeErr(err));
  }
}

// ---------- major-3 ②：来源校验 ----------
//
// 无鉴权公网接口的第一道门。放行判据：
//   - 有 Origin：必须**精确**命中白名单（浏览器发的 Origin 不含路径，不做前缀匹配）；
//   - 无 Origin 但有 Referer：取其 origin 部分比对（少数浏览器/扩展会剥 Origin）；
//   - 两者皆无：403。本站前端一定会带 Origin，「裸 POST」只可能是脚本刷量。
// 这拦不住伪造 Origin 的直接 HTTP 调用（那是 curl 一行的事），但能挡掉
// 「别的网页偷偷用你的额度」与绝大多数无脑刷子。真正的止血闸是配额，不是本函数。

function originOf(u) {
  try {
    const parsed = new URL(u);
    return (parsed.protocol + "//" + parsed.host).toLowerCase();
  } catch (_) {
    return null;
  }
}

function originAllowed(req) {
  const raw = req.headers["origin"];
  if (typeof raw === "string" && raw.trim()) {
    const o = originOf(raw.trim());
    if (!o) return false;
    return ALLOWED_ORIGINS.some(function (a) { return a.toLowerCase() === o; });
  }
  const ref = req.headers["referer"];
  if (typeof ref === "string" && ref.trim()) {
    const o = originOf(ref.trim());
    if (!o) return false;
    return ALLOWED_ORIGINS.some(function (a) { return a.toLowerCase() === o; });
  }
  return false;
}

// ---------- 频控：每 IP 滑动窗口 ----------

const hits = new Map(); // ip -> number[]（毫秒时间戳，升序）

function ipWindow(ip, now) {
  let list = hits.get(ip);
  if (!list) {
    list = [];
    hits.set(ip, list);
  }
  const cutoff = now - RATE_WINDOW_MS;
  while (list.length && list[0] <= cutoff) list.shift();
  return list;
}

// ---------- major-3 ①：进程内全局配额（小时 + 日双闸） ----------
//
// 每 IP 频控挡不住「换 IP 刷」——住宅代理池按小时论斤卖。全局桶才是花钱那侧的闸。
// 实现取滑动窗口而非整点重置：整点重置会被「卡点连打两倍额度」利用。
// 内存开销上界 = GLOBAL_DAILY_LIMIT 个 number（默认 2000 个，约 16 KB），可忽略。

const globalHits = []; // 毫秒时间戳，升序，只保留最近 24h

function pruneGlobal(now) {
  const cutoff = now - DAY_MS;
  let i = 0;
  while (i < globalHits.length && globalHits[i] <= cutoff) i++;
  if (i) globalHits.splice(0, i);
}

// 数组升序，二分找第一个 > cutoff 的位置，其后全部计入小时窗
function countSince(cutoff) {
  let lo = 0;
  let hi = globalHits.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (globalHits[mid] > cutoff) hi = mid;
    else lo = mid + 1;
  }
  return globalHits.length - lo;
}

/**
 * 只「看」不「记」：三道闸任一不过就返回拒绝描述，全过返回 null。
 * 记账另由 admitRecord() 完成 —— 被拒的请求不占额度，否则一次刷量会把
 * 后续的正常用户也一起锁死（拒绝也计数 = 攻击者可以用被拒请求维持封锁）。
 */
function quotaVerdict(ip, now) {
  pruneGlobal(now);

  const daily = globalHits.length;
  if (daily >= GLOBAL_DAILY_LIMIT) {
    return {
      status: 429,
      code: "global_daily_quota",
      message: "本站今日的免费调用额度已用完，请明天再来。",
      retryAfter: 3600
    };
  }
  const hourly = countSince(now - HOUR_MS);
  if (hourly >= GLOBAL_HOURLY_LIMIT) {
    return {
      status: 429,
      code: "global_hourly_quota",
      message: "本站本小时的调用额度已用完，请稍后（约一小时后）再试。",
      retryAfter: 600
    };
  }
  if (ipWindow(ip, now).length >= RATE_LIMIT) {
    return {
      status: 429,
      code: "rate_limited",
      message: "调用过于频繁，请稍后再试",
      retryAfter: 60
    };
  }
  return null;
}

function admitRecord(ip, now) {
  ipWindow(ip, now).push(now);
  globalHits.push(now);
}

// 定期清扫空桶，防止 Map 随 IP 数量无限增长
const sweeper = setInterval(function () {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  for (const [ip, list] of hits) {
    while (list.length && list[0] <= cutoff) list.shift();
    if (!list.length) hits.delete(ip);
  }
  pruneGlobal(now);
}, RATE_WINDOW_MS);
sweeper.unref();

// ---------- 读请求体（带上限，超限即断） ----------

function readBody(req, limit) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;
    let done = false;

    // 【major-1 ② 的修法】从前这里在 reject 前先 removeListener("error", fail)，
    // 于是 fail 一旦跑过，IncomingMessage 上的 'error' 监听者就归零 —— 此后
    // socket 再报错（超大 body 被拒后对端 RST 是常态），EventEmitter 对无监听者的
    // 'error' 直接 throw，整个进程崩。现在**只用 done 标志去重，绝不摘监听器**：
    // 首次错误走 reject，后续错误被同一个 fail 静静吃掉，不再有裸奔的 'error'。
    // （server 请求入口另有一个常驻 req.on("error") 兜底，两道锁，见 createServer 内。）
    function fail(err) {
      if (done) return;
      done = true;
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      reject(err);
    }
    function onData(chunk) {
      if (done) return;
      size += chunk.length;
      if (size > limit) {
        const err = new Error("body too large");
        err.code = "E_TOO_LARGE";
        req.pause();
        fail(err);
        return;
      }
      chunks.push(chunk);
    }
    function onEnd() {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks, size));
    }

    // 无论走哪条路，这个监听器都留到请求结束，保证 'error' 永远有人接
    req.on("error", fail);

    // Content-Length 已超限的，连读都不用读
    const declared = Number(req.headers["content-length"]);
    if (Number.isFinite(declared) && declared > limit) {
      const err = new Error("body too large");
      err.code = "E_TOO_LARGE";
      done = true;
      reject(err);
      return;
    }

    req.on("data", onData);
    req.on("end", onEnd);
  });
}

// ---------- 转发 ----------

// 把请求体里的 model 换成本路由上游认识的名字。
// 只动 model 这一个键，其余字段（messages/图片/max_tokens/thinking…）原样保留；
// 解析失败就原样透传——宁可让上游去报错，也不要在这里吞掉用户的请求体。
function applyModelRewrite(route, body) {
  if (!route.rewriteModel) return body;
  try {
    const obj = JSON.parse(body.toString("utf8"));
    if (!obj || typeof obj !== "object") return body;
    obj.model = route.rewriteModel;
    return Buffer.from(JSON.stringify(obj), "utf8");
  } catch (e) {
    return body;
  }
}

function forward(route, rawBody) {
  const body = applyModelRewrite(route, rawBody);
  return new Promise(function (resolve, reject) {
    const target = new URL(route.url);
    // 按 URL 协议选客户端。生产路由全是 https；留这一步是为了让 ROUTES 表成为
    // 唯一权威（改表即改行为），不必再同步改这里的模块名。
    const isTls = target.protocol === "https:";
    const client = isTls ? https : http;
    const opts = {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (isTls ? 443 : 80),
      path: target.pathname + target.search,
      method: "POST",
      headers: {
        // key 在这里、且只在这里进入报文。取本路由自己的 key——
        // chat 与 search 可能分属两家上游（见 ROUTES 与 CHAT_UPSTREAM 说明），
        // 用错 key 的后果是 401 而不是静默降级，但仍不该让它发生。
        Authorization: "Bearer " + route.apiKey,
        "Content-Type": "application/json",
        "Content-Length": String(body.length),
        Accept: "application/json",
        "User-Agent": "second-clock-proxy/1.0"
      }
    };
    if (isTls) opts.agent = agent;

    const upstream = client.request(opts, function (upRes) {
      const parts = [];
      upRes.on("data", function (c) { parts.push(c); });
      upRes.on("end", function () {
        resolve({
          status: upRes.statusCode || 502,
          contentType: upRes.headers["content-type"] || "application/json; charset=utf-8",
          body: Buffer.concat(parts)
        });
      });
      upRes.on("error", reject);
    });

    upstream.setTimeout(route.timeoutMs, function () {
      upstream.destroy(Object.assign(new Error("upstream timeout"), { code: "E_UPSTREAM_TIMEOUT" }));
    });
    upstream.on("error", reject);
    upstream.end(body);
  });
}

// ---------- 服务 ----------

const server = http.createServer(function (req, res) {
  const started = Date.now();
  const ip = clientIp(req);
  let pathname = "/";
  try {
    pathname = new URL(req.url || "/", "http://localhost").pathname;
  } catch (_) {
    pathname = "/";
  }

  // 常驻兜底：无论后面走哪条分支，req / res 的 'error' 永远有监听者。
  // 少了它，客户端中途拔线就是一次未捕获异常（= 一次崩溃 = 逼近 StartLimitBurst）。
  req.on("error", function (err) {
    logLine("warn", "请求流错误 ip=" + ip + " " + describeErr(err));
  });
  res.on("error", function (err) {
    logLine("warn", "响应流错误 ip=" + ip + " " + describeErr(err));
  });

  function finish(status) {
    const ms = Date.now() - started;
    console.log(
      "[" + new Date().toISOString() + "] " + (req.method || "-") + " " + pathname +
      " " + status + " " + ms + "ms ip=" + ip
    );
  }
  res.on("finish", function () { finish(res.statusCode); });

  const route = Object.prototype.hasOwnProperty.call(ROUTES, pathname) ? ROUTES[pathname] : null;
  const isFeedback = pathname === FEEDBACK_PATH;

  if (!route && !isFeedback) {
    sendJson(res, 404, "not_found", "未知接口");
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, "method_not_allowed", "只接受 POST", { Allow: "POST" });
    return;
  }
  if (!originAllowed(req)) {
    // 不回显收到的 Origin，免得把它变成一面镜子
    sendJson(res, 403, "forbidden_origin", "本接口只服务于 " + ALLOWED_ORIGINS[0] + " 的页面调用。");
    return;
  }

  const verdict = quotaVerdict(ip, Date.now());
  if (verdict) {
    // 429 在前端属可重试类，配合其退避即可自愈
    sendJson(res, verdict.status, verdict.code, verdict.message, {
      "Retry-After": String(verdict.retryAfter)
    });
    return;
  }
  admitRecord(ip, Date.now());

  // 反馈接口不打上游、不花钱，请求体上限单独收小（它只该收几行字）
  readBody(req, isFeedback ? FEEDBACK_MAX_BODY : MAX_BODY_BYTES)
    .then(function (body) {
      if (!body.length) {
        sendJson(res, 400, "empty_body", "请求体为空");
        return null;
      }
      // 只做形状校验，不看内容、不打印内容
      let parsed;
      try {
        parsed = JSON.parse(body.toString("utf8"));
      } catch (_) {
        sendJson(res, 400, "bad_json", "请求体不是合法 JSON");
        return null;
      }
      if (isFeedback) return handleFeedback(res, parsed);
      return forward(route, body).then(function (up) {
        if (res.writableEnded || res.headersSent) return;
        try {
          res.writeHead(up.status, {
            "Content-Type": up.contentType,
            "Content-Length": String(up.body.length),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff"
          });
          res.end(up.body);
        } catch (err) {
          logLine("warn", "回写上游响应失败 " + describeErr(err));
        }
      });
    })
    .catch(function (err) {
      const code = err && err.code;
      if (code === "E_TOO_LARGE") {
        sendJson(res, 413, "payload_too_large", "图片过大，请减少张数或降低分辨率后重试");
      } else if (code === "E_UPSTREAM_TIMEOUT") {
        sendJson(res, 504, "upstream_timeout", "上游服务超时，请稍后重试");
      } else {
        // 上游错误只归类不透传细节，免得把上游返回里的敏感字段带给浏览器
        logLine("warn", "转发失败 ip=" + ip + " " + describeErr(err));
        sendJson(res, 502, "upstream_error", "上游服务不可用，请稍后重试");
      }
    });
});

server.headersTimeout = 65000;
server.requestTimeout = 180000;
server.keepAliveTimeout = 65000;

// ---------- major-1：进程级兜底 ----------
//
// 分界线：**启动期**的错误允许（也应该）非零退出——起不来就是起不来，
// 让 systemd 与运维看见；**运行期**的错误一律记日志后继续——单次请求出错
// 不值得赔上整个服务的可用性，何况连崩 5 次会把 unit 打进 failed 永久停服。

let booted = false;

server.on("error", function (err) {
  const code = err && err.code;
  if (code === "EADDRINUSE") {
    console.error("[fatal] 端口 " + PORT + " 已被占用（" + HOST + ":" + PORT + "），无法启动。");
    console.error("[fatal] 排查：sudo ss -lptn 'sport = :" + PORT + "'");
    console.error("[fatal] 若是本服务的旧进程残留：sudo systemctl restart 2c-proxy");
    process.exit(1);
  }
  if (code === "EACCES") {
    console.error("[fatal] 无权监听 " + HOST + ":" + PORT + "（1024 以下端口需要特权）。");
    process.exit(1);
  }
  if (code === "EADDRNOTAVAIL") {
    console.error("[fatal] 监听地址 " + HOST + " 在本机不存在，无法绑定。");
    process.exit(1);
  }
  if (!booted) {
    console.error("[fatal] 启动期服务器错误：" + describeErr(err));
    process.exit(1);
  }
  // 已经在服务了：记一笔继续跑，别把整个站赔进去
  logLine("error", "服务器错误（已忽略，进程继续）" + describeErr(err));
});

// 客户端层面的坏报文（畸形 header、TLS 打到明文端口等）。默认行为会直接扔，
// 这里接管为「安静地关掉这条连接」，避免刷屏也避免冒泡。
server.on("clientError", function (err, socket) {
  logLine("warn", "客户端连接错误 " + describeErr(err));
  if (!socket || socket.destroyed || !socket.writable) return;
  try {
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
  } catch (_) {
    try { socket.destroy(); } catch (_e) { /* 已经没救了，忽略 */ }
  }
});

process.on("uncaughtException", function (err) {
  if (!booted) {
    console.error("[fatal] 启动期未捕获异常，退出：" + describeErr(err));
    process.exit(1);
  }
  // 运行期：记录但**不退出**。带病继续远好于连崩 5 次进 failed 永久停服。
  logLine("error", "未捕获异常（已吞下，进程继续）" + describeErr(err));
});

process.on("unhandledRejection", function (reason) {
  if (!booted) {
    console.error("[fatal] 启动期未处理的 Promise 拒绝，退出：" + describeErr(reason));
    process.exit(1);
  }
  logLine("error", "未处理的 Promise 拒绝（已吞下，进程继续）" + describeErr(reason));
});

server.listen(PORT, HOST, function () {
  booted = true;
  console.log(
    "[boot] 第二时钟 proxy 已启动 http://" + HOST + ":" + PORT +
    " routes=" + Object.keys(ROUTES).join(",") +
    " maxBody=" + MAX_BODY_BYTES + "B rate=" + RATE_LIMIT + "/min" +
    " global=" + GLOBAL_HOURLY_LIMIT + "/h," + GLOBAL_DAILY_LIMIT + "/d" +
    " origins=" + ALLOWED_ORIGINS.join("|") +
    " trustForwardedHeaders=" + (TRUST_FORWARDED_HEADERS ? "yes" : "no")
  );
  console.log("[boot] 提醒：进程内配额重启即清零，唯一不可绕的最后闸是智谱控制台的账户消费上限。");
});

function shutdown(signal) {
  console.log("[exit] 收到 " + signal + "，停止接受新连接");
  server.close(function () { process.exit(0); });
  setTimeout(function () { process.exit(0); }, 10000).unref();
}
process.on("SIGTERM", function () { shutdown("SIGTERM"); });
process.on("SIGINT", function () { shutdown("SIGINT"); });
