#!/usr/bin/env node
/**
 * 第二时钟 —— 产物冒烟测试（零依赖 DOM 桩）
 *
 * 为什么要有这一步：出口断言全是「文本形态」检查，只能看出源码长什么样，
 * 看不出它**跑不跑得起来**。2026-08-09 实测撞到过一次：改写把
 *   function apiCredentialReady() { return CONFIG.useProxy || <肯定式判据>; }
 * 里的判据本身也替换成了 apiCredentialReady()，产物变成自我递归。
 * file:// 下（CONFIG.useProxy 为假，不短路）一打开就
 * RangeError: Maximum call stack size exceeded，初始化 IIFE 整段中断，
 * 页头显示「内置 0 种药品」、卡片区空白；而 http(s) 下 useProxy 为真会短路，
 * 线上完全看不出来 —— 纯文本断言对这类缺陷是瞎的。
 *
 * 因此本模块用 node:vm + 一套极简 DOM 桩把产物的 <script> 真跑一遍，
 * 并且**故意把 location.protocol 设成 file:**（最脆弱的那条链路）：
 * 初始化不得抛异常，且 DRUG_DB 必须完整。
 *
 * DOM 桩是「够用即可」而非「实现 DOM」：所有元素都是同一个 plain object 形态，
 * 事件监听全部丢弃，定时器不排程。它只保证初始化路径能走完，不模拟交互。
 */

import vm from "node:vm";

/** 从整份 HTML 里取出所有内联 <script>（跳过带 src 的外链）。 */
export function extractInlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (/\bsrc\s*=/i.test(m[1])) continue;
    out.push(m[2]);
  }
  return out;
}

function makeElement(tag) {
  const el = {
    tagName: String(tag || "div").toUpperCase(),
    nodeType: 1,
    id: "",
    className: "",
    textContent: "",
    innerHTML: "",
    innerText: "",
    value: "",
    src: "",
    href: "",
    alt: "",
    title: "",
    type: "",
    name: "",
    min: "",
    max: "",
    step: "",
    placeholder: "",
    hidden: false,
    disabled: false,
    checked: false,
    selected: false,
    readOnly: false,
    multiple: false,
    accept: "",
    capture: "",
    width: 0,
    height: 0,
    naturalWidth: 0,
    naturalHeight: 0,
    scrollTop: 0,
    scrollHeight: 0,
    offsetWidth: 0,
    offsetHeight: 0,
    files: null,
    options: [],
    selectedIndex: -1,
    dataset: {},
    style: {},
    attributes: {},
    children: [],
    childNodes: [],
    firstChild: null,
    parentNode: null,
    classList: {
      add() {}, remove() {}, toggle() {}, replace() {}, contains() { return false; }
    }
  };
  el.appendChild = function (child) { el.children.push(child); el.childNodes.push(child); if (child) child.parentNode = el; return child; };
  el.append = function (...kids) { for (const k of kids) el.appendChild(k); };
  el.prepend = function (...kids) { for (const k of kids) el.children.unshift(k); };
  el.insertBefore = function (child) { return el.appendChild(child); };
  el.removeChild = function (child) { return child; };
  el.replaceChildren = function (...kids) { el.children = []; el.childNodes = []; for (const k of kids) el.appendChild(k); };
  el.remove = function () {};
  el.setAttribute = function (k, v) { el.attributes[k] = String(v); };
  el.getAttribute = function (k) { return Object.prototype.hasOwnProperty.call(el.attributes, k) ? el.attributes[k] : null; };
  el.hasAttribute = function (k) { return Object.prototype.hasOwnProperty.call(el.attributes, k); };
  el.removeAttribute = function (k) { delete el.attributes[k]; };
  el.addEventListener = function () {};
  el.removeEventListener = function () {};
  el.dispatchEvent = function () { return true; };
  el.querySelector = function () { return null; };
  el.querySelectorAll = function () { return []; };
  el.closest = function () { return null; };
  el.contains = function () { return false; };
  el.focus = function () {};
  el.blur = function () {};
  el.click = function () {};
  el.select = function () {};
  el.scrollIntoView = function () {};
  el.insertAdjacentHTML = function () {};
  el.getBoundingClientRect = function () { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; };
  el.setCustomValidity = function () {};
  el.checkValidity = function () { return true; };
  el.reset = function () {};
  el.submit = function () {};
  el.getContext = function () {
    return {
      drawImage() {}, fillRect() {}, clearRect() {}, save() {}, restore() {},
      translate() {}, scale() {}, rotate() {}, beginPath() {}, closePath() {},
      fill() {}, stroke() {}, measureText() { return { width: 0 }; }, fillText() {}
    };
  };
  el.toDataURL = function () { return "data:image/jpeg;base64,"; };
  el.toBlob = function (cb) { if (typeof cb === "function") cb(null); };
  el.play = function () { return Promise.resolve(); };
  el.pause = function () {};
  el.load = function () {};
  return el;
}

function makeDocument() {
  const byId = new Map();
  const doc = {
    readyState: "complete",
    title: "",
    cookie: "",
    createElement: (tag) => makeElement(tag),
    createElementNS: (_ns, tag) => makeElement(tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text ?? "") }),
    createDocumentFragment: () => makeElement("fragment"),
    getElementById(id) {
      if (!byId.has(id)) {
        const el = makeElement("div");
        el.id = id;
        byId.set(id, el);
      }
      return byId.get(id);
    },
    getElementsByClassName: () => [],
    getElementsByTagName: () => [],
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    execCommand() { return false; }
  };
  doc.body = makeElement("body");
  doc.head = makeElement("head");
  doc.documentElement = makeElement("html");
  doc.activeElement = doc.body;
  return doc;
}

function makeStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key: (i) => Array.from(map.keys())[i] ?? null,
    getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => { map.set(String(k), String(v)); },
    removeItem: (k) => { map.delete(String(k)); },
    clear: () => { map.clear(); }
  };
}

/**
 * 在 DOM 桩里跑一遍产物脚本。
 * @param {string} html 完整产物 HTML
 * @param {{protocol?: string}} opts protocol 默认 "file:"（最脆弱链路）
 * @returns {{ok: boolean, error: string|null, drugCount: number|null, protocol: string}}
 */
export function runInDomStub(html, opts = {}) {
  const protocol = opts.protocol || "file:";
  const scripts = extractInlineScripts(html);
  if (!scripts.length) {
    return { ok: false, error: "产物里找不到任何内联 <script>", drugCount: null, protocol };
  }

  const document = makeDocument();
  const noopTimer = () => 0;
  const sandbox = {
    document,
    location: { protocol, href: protocol + "///index.html", host: "", hostname: "", origin: "null", search: "", hash: "", pathname: "/index.html", reload() {}, assign() {}, replace() {} },
    navigator: { userAgent: "node-dom-stub", language: "zh-CN", languages: ["zh-CN"], onLine: true, clipboard: { writeText: () => Promise.resolve() }, mediaDevices: { getUserMedia: () => Promise.reject(new Error("stub")) } },
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    setTimeout: noopTimer,
    setInterval: noopTimer,
    clearTimeout() {},
    clearInterval() {},
    requestAnimationFrame: noopTimer,
    cancelAnimationFrame() {},
    queueMicrotask: (fn) => { try { fn(); } catch { /* 桩内异步回调不计入初始化 */ } },
    fetch: () => new Promise(() => {}),
    AbortController: globalThis.AbortController,
    FormData: class { append() {} get() { return null; } },
    Blob: class { constructor() { this.size = 0; this.type = ""; } },
    File: class { constructor() { this.name = ""; this.size = 0; this.type = ""; } },
    FileReader: class { readAsDataURL() {} readAsText() {} addEventListener() {} },
    Image: function Image() { return makeElement("img"); },
    URL: globalThis.URL,
    URLSearchParams: globalThis.URLSearchParams,
    TextEncoder: globalThis.TextEncoder,
    TextDecoder: globalThis.TextDecoder,
    crypto: globalThis.crypto,
    performance: globalThis.performance,
    Intl: globalThis.Intl,
    alert() {}, confirm() { return false; }, prompt() { return null; },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    MutationObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} unobserve() {} },
    ResizeObserver: class { observe() {} disconnect() {} unobserve() {} },
    scrollTo() {}, open() { return null; }, close() {}, print() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; }
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.top = sandbox;
  sandbox.parent = sandbox;
  sandbox.URL.createObjectURL = () => "blob:stub";
  sandbox.URL.revokeObjectURL = () => {};

  const context = vm.createContext(sandbox);

  try {
    scripts.forEach((code, i) => {
      new vm.Script(code, { filename: `dist-inline-${i}.js` }).runInContext(context, { timeout: 20000 });
    });
  } catch (err) {
    return { ok: false, error: (err && err.message) || String(err), drugCount: null, protocol };
  }

  // DRUG_DB 是脚本顶层 const（词法绑定，不挂 globalThis），
  // 只能在**同一 context** 里再跑一段脚本把它读出来。
  let drugCount = null;
  try {
    drugCount = new vm.Script(
      "typeof DRUG_DB === 'undefined' ? null : (Array.isArray(DRUG_DB) ? DRUG_DB.length : -1)",
      { filename: "dist-probe.js" }
    ).runInContext(context, { timeout: 5000 });
  } catch (err) {
    return { ok: false, error: "读取 DRUG_DB 失败：" + ((err && err.message) || String(err)), drugCount: null, protocol };
  }

  return { ok: true, error: null, drugCount, protocol };
}
