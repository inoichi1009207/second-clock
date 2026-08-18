# 第二时钟 · 项目运行说明

> **打开即用，无需安装、无需注册、无需配置环境。**
>
> 👉 **<https://2c.klinik.ren>** ｜ 使用手册 <https://2c.klinik.ren/manual.html>
>
> 手机与电脑浏览器均可，不用装 App，不用扫码。记录只存在你自己的浏览器里。
>
> 开头三节（三分钟验收 / 竞品分析 / 技术栈）写给**第一次打开它的人**，含评委；
> 从第「二」节起是给维护者的运维细节，评委可略过。

---

## 三分钟验收路径

作品最花力气的地方是「**拿不准的时候不猜**」，但这三道防线都要**触发之后**才看得见。
按下面的顺序点，三分钟能全部看到。

### ① 基本功：查得到、算得准（约 40 秒）

1. 打开 <https://2c.klinik.ren>，默认就在「手动填写」页
2. 「产品名称」里打 **`红霉素眼膏`** ——停手约半秒，它会自动填好
   「开封后可用 **28 天**」、储存「阴凉」，并注明依据是《中国药典》对眼用制剂的通用规定
3. 直接点「确认添加」（默认按今天开封）
4. 卡片下方会出现一条**安全提示**：「管口勿触及眼睑睫毛；开封时在盒上写开启日期」
5. 点「时间模拟」→ 连点 **+20 天 / +1 天**，卡片转黄；再 **+7 天**，转红并在顶部弹出红色横幅

> 这一段展示的是产品的基本主张：**药盒上的有效期和开封后的期限是两回事**。
> 时间模拟只改显示用的"今天"，刷新即恢复真实日期，记录不受影响。

### ② 防线一：同名多剂型，它不替你猜（约 40 秒）

1. 把「产品名称」改成 **`希刻劳`**
2. 它**不会**自动填任何天数，而是提示「这个名字下有多个剂型，它们的开封期限不一样」，
   并就地列出两个按钮：**干混悬剂** / **胶囊**
3. 点「干混悬剂」——这时才填入「14 天 / 冷藏」，同时「更多信息」自动展开，剂型字段已写好
4. 换成「胶囊」再试一次，答案完全不同：**按印刷效期 / 常温**

> **为什么这重要**：「希刻劳」两种剂型都真实存在，查表若"先到先得"，用户会拿到另一种剂型的
> 天数而**完全看不出来**。全库有 27 个这样的商品名（泰诺林、可乐必妥、兰美抒、胃复安……）。
> 「剂型」这个字段平时是选填，只在这一刻变成必填——因为剂型就印在药盒上，用户照抄一眼的事。

### ③ 防线二：查不到时不装懂（约 20 秒）

1. 输入一个不存在的名字，比如 **`昆仑雪域回春宝`**
2. 提示是灰色的、不是报错：「未收录，照样可以记：直接在下面填你从说明书上看到的天数即可。
   也可以点下方按钮联网查一次；仍查不到就问药师——**查不到不等于没有期限**。」
3. 下方才出现「联网查询」按钮，紧挨着一行小字：**「只有点上面这个按钮才会联网……不点就不会」**

> 联网是**逐次点击授权**，不是一个设一次就忘的开关。不点，就没有任何数据离开本机。

### ④ 防线三：两家 AI 交叉验证（需要网络，约 60 秒）

1. 切到「拍照识别」页 → 上传一张药盒照片（`shots/` 或 `testshots/` 里有样例）
2. 同一张照片会**分别发给两家不同厂商的模型**：阿里云百炼 `qwen-vl-plus` 主识别、
   智谱 `glm-4.6v` 独立核对，**两边互不知道对方的答案**
3. 药名归一化后**完全相同**才算一致；不一致就一个字都不代填，把两个答案摊给你自己判断
4. 无论一致与否，**包装上的有效期永远只作「待确认」**，要你点头才落账

> 界面上的措辞是「结果一致」而不是「已验证」——一致只降低了单个模型独有错误漏过的概率，
> 两家仍可能被同一处模糊的包装误导而一起读错。这句差别是有意写进去的。

### 如果不方便联网 / 不方便拍照

①②③ 三段**完全离线可用**——药库 1832 条整个内联在网页里，断网照常查。
只有④需要网络。

---

## 竞品分析摘要：这是新东西，还是旧功能的叠加？

自己提的主张自己先去证伪。做了两条独立检索链路：
**Bing／搜狗／DuckDuckGo 三引擎 54 组查询 + App Store 页面原文抓取**，
以及 **Codex CLI 独立联网调研（24 个条目 / 29 个来源链接）**。
两边一致处采信，不一致处按更保守的一方表述。**完整版见 `promo/competitor-analysis.md`。**

### 先说不利结论

**"首创开封后计时"这个说法站不住**——有产品做了：

- **Pharma Stock**（iOS·Android）官网明写 "Shelf Life After Opening"，可按天/周/月设置
- **安心药箱**（iOS）有"记录开封日期和开封后使用期限"，理念也相近
- **Eye Drop Reminder** 记录眼药水开封时间并在失效前通知
- **Regimen 的 Medication Storage Calculator** 对 Ozempic、Wegovy、睾酮等**直接给出 discard date**

### 但它们的形态不同

前两个给的是**一个让你自己填天数的空格子**——而"填多少"正是原始难题本身；
安心药箱的离线药品库是 **57 款**。后两个**直接给答案，但药种极窄**（几种减重针、只做眼药水）。

三个成熟品类各自的边界也很清楚：

| 品类 | 代表 | 管什么 | 不管什么 |
|---|---|---|---|
| 服药提醒 | Medisafe、MyTherapy、Apple 健康·用药 | "该吃药了"（剂量、时间、依从性） | 开封后效期 |
| 家庭药箱 | 智药箱、i药管家、MyAidKit、ExpirAlert | 包装上印刷的有效期 | 开封后效期 |
| 药师 BUD 计算器 | USP 795/797 类工具 | 调配制剂从配制日算失效期 | 家庭药品库、提醒 |

**空隙在于：「家里这盒开过封的药还能用到哪天」，三边都不完整地接。**

### 三个差异点的裁定

| 差异点 | 裁定 |
|---|---|
| 内置开封后效期数据库 | **概念已有先例，规模未找到对手**（未找到覆盖约 1832 条中文家庭药品/用品且离线可查的产品） |
| 多厂商模型独立交叉验证 | **未找到先例**。消费级健康视觉 AI（SkinVision、Aysa）公开表述均为单一算法/模型 |
| 同名多剂型不猜、交还用户指认 | **通用 UX 原则已有，此具体规则未找到先例** |

### 最难反驳的一点

**数据量不是壁垒——1832 条谁都能用 AI 补上。** 而且本作品的 1832 条里相当一部分是
剂型通用参考值，不是逐条核到说明书原文（产品内已标"参考值"）。**数据量的领先不等于精度的领先。**

能站住的回应是：真正补不上的不是数据，是**把"不知道"变成可计算的量、并在算出不知道时拒绝作答**这套机制。
而它与数据量恰好**反向**——库越大，同名多剂型的撞键越多，问题越严重：
1363 条时这个缺陷藏着，1832 条时才暴露出 27 个撞键。用 AI 生成更多数据的人只会更快撞上它，
不会自动获得解法。

---

## 一、技术栈与运行环境

| | |
|---|---|
| 形态 | **单个 HTML 文件**，约 805 KB，CSS/JS/药库数据全部内联 |
| 前端依赖 | **零**。无框架、无构建产物依赖、无 CDN 引用 |
| 后端 | 一个零依赖 Node 脚本（`proxy.mjs`，只用 Node 内置模块），作 API 反代 |
| 运行时 | Node v22（服务器侧）。**浏览器侧不需要任何运行时** |
| 数据库 | 无。药库内联在页面里，用户记录存浏览器 `localStorage` |
| 部署 | nginx 静态托管 + systemd 托管反代进程 |
| 浏览器要求 | 任意现代浏览器；移动端已按 390px 宽度适配 |

**评委不需要在本地跑任何东西**。若仍希望本地打开：双击 `index.html` 即可，
手动填写、药库搜索、倒计时、按人筛选、时间模拟全部可用；
拍照识别与联网查询会提示未配置（因为密钥不在源文件里，见 §6.1）。

---

## 二、五分钟看懂它长什么样

```
浏览器
  │
  │  静态页（HTML/CSS/JS 全在一个文件里，药库内联，断网可用）
  ├──────────────────────────────► nginx  ──► /var/www/2c.klinik.ren/index.html
  │                                              manual.html
  │
  │  /api/*（只有用户主动点"拍照识别""联网查询""提交反馈"时才发生）
  └──────────────────────────────► nginx ──proxy_pass──► 127.0.0.1:8791
                                                              │  proxy.mjs
                                                              │  （systemd 服务 2c-proxy）
                                                              ├─► 阿里云百炼 qwen-vl-plus   拍照识别
                                                              ├─► 智谱 glm-4.6v            交叉核对
                                                              ├─► 智谱 web_search          联网查询
                                                              └─► $STATE_DIRECTORY/feedback.jsonl
```

三件事值得先知道：

1. **前端不持有任何密钥。** key 只活在服务器上 `2c-proxy` 进程的环境变量里，由它注入
   `Authorization` 头。浏览器只看得到 `/api/...` 这样的同源路径。
2. **药库是内联的，不是接口。** `index.html` 里有 `const DRUG_DB = [...]` 一整行（约 500 KB）。
   所以手动录入、药库匹配、计时提醒**全部离线可用**，只有识别与联网查询需要网络。
3. **这台 nginx 同时跑着另一个生产站** `klinik.ren`。改 nginx 一定要按 §6.3 的规矩来，
   否则会把别人的站打下来。

---

## 三、目录速查

| 路径 | 是什么 |
|---|---|
| `index.html` | **源文件**。含 `LOCAL_DEBUG_API_KEY`（本机调试用），**绝不能直接上传服务器** |
| `manual.html` | 用户手册源文件 |
| `db-parts/drug-db.merged.json` | **药库权威数据**，顶层 `{drugs, form_rules}` |
| `deploy/build.mjs` | 构建：抹 key + 校验 + 冒烟，产出 `deploy/dist/` |
| `deploy/dist/` | **可部署产物**。上传的是这里的文件 |
| `deploy/proxy.mjs` | 反代（零依赖，只用 Node 内置模块） |
| `deploy/systemd-2c-proxy.service` | systemd unit（含全部非密钥配置） |
| `deploy/nginx-2c.klinik.ren.conf` | nginx 站点配置 |
| `deploy/DEPLOY.md` | 首次部署的完整分步手册（本文件是日常运维版） |
| `deploy/HANDOFF-server-access.md` | 服务器登录与环境事实 |
| `promo/` | 提交文案、Issue 正文、海报 |
| `shots/` `testshots/` | 截图与测试用药品照片 |
| `clipboard/` | 工作草稿，不入交付 |

> `my.txt` 是用户的私人备忘，**不要读、不要打印、不要提交**。

---

## 四、日常改动的标准流程

### 4.1 只改界面文案 / 样式 / 逻辑

```bash
# 1. 改 index.html 或 manual.html
# 2. 构建（会自动做出口断言，失败就不会产出）
node deploy/build.mjs

# 3. 部署
cd deploy
scp dist/index.html dist/manual.html klinik:/tmp/
ssh klinik 'sudo install -m 644 -o www-data -g www-data \
  /tmp/index.html /tmp/manual.html /var/www/2c.klinik.ren/ && \
  rm -f /tmp/index.html /tmp/manual.html'

# 4. 验（见第五节）
```

`build.mjs` 会做这些事，任一失败就中止：

- 把 `LOCAL_DEBUG_API_KEY` 置空（并断言确实置空了）
- 校验 `DRUG_DB.length === EXPECTED_DRUG_COUNT`
- 用 DOM stub 跑一次初始化冒烟（`file://` 与 `https://` 两种形态）
- 断言无内嵌凭据、代理链路完整、无自我递归

### 4.2 改药库数据

```bash
# 1. 改 db-parts/drug-db.merged.json（先备份！这个文件不在 git 里）
# 2. 重新内联进 index.html 的 DRUG_DB / FORM_RULES 两行
# 3. 条数变了就同步改这些地方：
#    - deploy/build.mjs 的 EXPECTED_DRUG_COUNT
#    - index.html / manual.html / promo/ 下四份文案 / promo/poster.html 里的数字
# 4. node deploy/build.mjs → 部署 → 验
```

**条目 schema（九个字段，不增不减）：**

```json
{
  "name": "通用名（含剂型）",
  "aliases": ["商品名", "俗名"],
  "form": "剂型（须在 form_rules 的枚举内）",
  "open_days": 180,
  "open_note": "一句话说明",
  "storage": "常温|阴凉|避光|冷藏|冷冻",
  "refrigerated": false,
  "tip": "可空，一句安全提示",
  "category": "类目名"
}
```

**改数据前必须知道的三条约束：**

- `refrigerated` 必须与 `storage ∈ {冷藏, 冷冻}` 一致
- `open_days` 为 `null`（按印刷效期）或 1–730 的整数。
  **`null` 会在界面上渲染成"无需开封计时"**——对单剂量液体/粉末这是危险暗示，那类应给 1
- **别名不得等于另一条目的 `name`**，也不得同时挂在两条不同成分的药上（会造成劫持误匹配）
- 标点用中文全角。`name`/`open_note`/`tip` 会直接显示给用户

### 4.3 改反代（换模型、调配额、加路由）

```bash
scp deploy/proxy.mjs klinik:/tmp/
ssh klinik 'sudo install -m 644 -o root -g root /tmp/proxy.mjs /opt/2c-proxy/proxy.mjs && \
  sudo systemctl restart 2c-proxy && sudo systemctl status 2c-proxy --no-pager | head -5'
```

改的若是 `systemd-2c-proxy.service`：

```bash
scp deploy/systemd-2c-proxy.service klinik:/tmp/
ssh klinik 'sudo cp /tmp/systemd-2c-proxy.service /etc/systemd/system/2c-proxy.service && \
  sudo systemctl daemon-reload && sudo systemctl restart 2c-proxy'
```

---

## 五、验证（每次部署后都要跑）

```bash
cd C:/Users/inoichi/AppData/Local/Temp/claude/D--test-qwq/<session>/scratchpad
node smoke.mjs        # 23 项：空箱引导→添加→倒计时三色→红条→刷新→反馈入口→页脚披露
node formtest.mjs "https://2c.klinik.ren/index.html"   # 23 项：同名多剂型消歧全链路
```

两套都需要 **Chrome 开着 9292 调试端口**（`--remote-debugging-port=9292`），
测试脚本通过 CDP 驱动真实浏览器，不是 stub。

**不带浏览器的快速自查：**

```bash
curl -sI https://2c.klinik.ren/ | head -3                    # 200
curl -s https://2c.klinik.ren/ | grep -c "sk-\|apiKey\s*:"   # 必须是 0
curl -s -X POST https://2c.klinik.ren/api/zhipu/chat \
  -H 'Origin: https://evil.example' -d '{}' -o /dev/null -w '%{http_code}\n'   # 403
curl -s -o /dev/null -w '%{http_code}\n' https://2c.klinik.ren/nope           # 404
curl -sI https://klinik.ren/ | head -1                       # 200，确认没打挂邻居站
ssh klinik 'systemctl is-active 2c-proxy'                    # active
```

> **CDP 脚本必须显式 `process.exit()`**，否则 websocket 一直吊着、任务永不结束。
> 建议每个脚本开头加 `setTimeout(() => process.exit(2), 60000)` 兜底。

---

## 六、服务器与配置

### 6.1 密钥怎么进来

**本仓库任何文件都不写 key 值。** key 存在只有 root 可读的环境文件里：

```bash
sudo install -d -m 750 -o root -g root /etc/2c-proxy
sudo install -m 600 -o root -g root /dev/null /etc/2c-proxy/env
sudo nano /etc/2c-proxy/env      # 用编辑器写，不用 echo，避免落进 shell history
```

内容两行（等号两侧无空格，值不加引号）：

```
ZHIPU_API_KEY=<智谱控制台的 API Key>
BAILIAN_API_KEY=<阿里云百炼控制台的 API Key>
```

自查：`sudo stat -c '%a %U:%G' /etc/2c-proxy/env` 必须是 `600 root:root`。

unit 里的 `EnvironmentFile=` **不带前导 `-`**，文件缺失即启动失败——
这是有意的 fail-closed：宁可起不来，不可无鉴权裸跑。

### 6.2 可调的环境变量（写在 systemd unit 里）

| 变量 | 现值 | 说明 |
|---|---|---|
| `HOST` / `PORT` | `127.0.0.1` / `8791` | 只监听回环；绑非回环地址默认拒绝启动 |
| `CHAT_UPSTREAM` | `bailian` | 改成 `zhipu` 即可把识别切回智谱，**前端无需改动、无需重新部署** |
| `BAILIAN_VISION_MODEL` | `qwen-vl-plus` | 主识别模型 |
| `VERIFY_ZHIPU_MODEL` | `glm-4.6v` | 交叉核对模型 |
| `MAX_BODY_BYTES` | `12582912` | 12 MiB，识别请求含 base64 照片 |
| `RATE_LIMIT` | `30` | 每 IP 每分钟 |
| `GLOBAL_HOURLY_LIMIT` | `120` | 全局小时闸 |
| `GLOBAL_DAILY_LIMIT` | `400` | 全局日闸 |
| `ALLOWED_ORIGINS` | `https://2c.klinik.ren` | Origin 白名单，不匹配返回 403 |

**为什么全局闸收得这么紧**：每 IP 30/min 只挡得住单机脚本，住宅代理池按小时论斤卖，
**全局桶才是花钱那一侧的闸**。且作者是个人账号，智谱控制台不提供消费上限，
这里就是唯一的额度护栏。按每次识别约 3400 token、交叉验证打两次算，400/天 ≈ 140 万 token/天。

### 6.3 动 nginx 前必读（这台机器上还有别人的生产站）

`/etc/nginx/sites-enabled/` 里同时有 `klinik` 和 `2c.klinik.ren.conf`，**共用同一个 nginx 实例**。
已经踩过并写进配置注释的两个坑：

- **`gzip on` 不能放 http 上下文**——会和 `/etc/nginx/nginx.conf:46` 已有的那条冲突，
  而且会外溢到邻居站。全部 gzip 指令已下移进本站的 443 server 块（在 server 上下文合法）。
- **`listen 443 ssl http2` 会让 `nginx -t` 直接失败**。本机 nginx 1.24，`http2` 是 listen
  套接字级选项，而同一个套接字已由 `klinik.ren` 以 `default_server` 占用 →
  "duplicate listen options"。本站的 listen 不写 `http2`。

改完**必须**先 `sudo nginx -t` 再 `sudo systemctl reload nginx`。
`-t` 不过就别 reload——reload 一个坏配置会把 `klinik.ren` 一起打下来。

**紧急回滚**（把本站摘掉，不影响邻居）：

```bash
sudo rm -f /etc/nginx/sites-enabled/2c.klinik.ren.conf && sudo nginx -t && sudo systemctl reload nginx
```

### 6.4 证书

Let's Encrypt，webroot 方式签发（该账户当初是无邮箱注册的）：

```bash
sudo certbot certonly --webroot -w /var/www/2c.klinik.ren -d 2c.klinik.ren
```

webroot 方式没有 installer，所以本站的续期配置里**另加了 `renew_hook`** 去 reload nginx。
邻居站用的是 nginx 插件，不受影响。

---

## 七、故障排查

| 症状 | 大概率原因 | 怎么确认 / 怎么办 |
|---|---|---|
| 服务 `active` 但接口恒 502 | `RestrictAddressFamilies` 少了 `AF_UNIX AF_NETLINK` → DNS 解析不出来 | 症状极具迷惑性：启动日志正常、端口也听着。glibc 的 `getaddrinfo` 需要 AF_NETLINK 枚举网卡，NSS 走 AF_UNIX。unit 里这两族必须放行 |
| 服务起不来 | `/etc/2c-proxy/env` 缺失或权限不对 | `sudo systemctl status 2c-proxy`；`EnvironmentFile` 无前导 `-`，缺文件即失败，这是有意的 |
| 反复起崩后彻底停服 | `StartLimitBurst=5` 触发 | 5 分钟内崩 5 次就停下等人工。`systemctl reset-failed 2c-proxy` 后再查根因 |
| 大图并发下 OOM | `MemoryMax` 与 `MAX_BODY_BYTES` 不匹配 | 请求体与响应体都整份进内存，单请求峰值约 2×12=24 MiB。现为 512M（约 20 并发余量），且靠 nginx 的 `limit_conn` 把真实并发压到个位数。**只调一头不算数** |
| 接口 403 | Origin 不在白名单 | 正常防护。换域名要同步改 `ALLOWED_ORIGINS` |
| 接口 429 | 撞了配额闸 | 看是每 IP 的还是全局的；全局闸重启进程即清零（进程内计数） |
| 智谱 429 / 1305 | `glm-4.6v-flash` 拥堵 | 实测只有 flash 拥堵（5/6 失败），`glm-4.6v` 等 3/3 正常。不是账号问题，换模型即可 |
| 页面能开但识别报错 | key 没注入，或上游模型名写错 | `sudo journalctl -u 2c-proxy -n 50`。日志只打方法/路径/状态码/耗时/IP，**不含请求体与 key** |
| 部署后页面没变 | 传的是源文件不是 `dist/` | `curl -s https://2c.klinik.ren/ \| grep -c 'sk-'` 若非 0，**立即回滚并轮换 key** |

**用户反馈落在哪**：`$STATE_DIRECTORY/feedback.jsonl`，即 `/var/lib/2c-proxy/feedback.jsonl`。
`ProtectSystem=strict` 把整个文件系统挂只读，只有 `StateDirectory` 这一个目录可写。

```bash
ssh klinik 'sudo tail -20 /var/lib/2c-proxy/feedback.jsonl'
```

---

## 八、本地开发

**双击 `index.html` 直接跑**（`file://`）：此时走 `LOCAL_DEBUG_API_KEY` 直连智谱。
这个常量在源文件里，构建时会被抹掉。**不要把源文件传服务器。**

想不带 key 调界面：手动填写、药库搜索、倒计时、按人筛选、模拟时间全部离线可用，
只有拍照识别与联网查询会提示未配置。

**改代码时的三个既有约定**（都写在代码注释里，改动前先读那段注释）：

- 渲染一律走 `textContent` / `createElement`，**不用 `innerHTML`**
- 守卫装在**被调用的函数内部**，不是调用处——装调用处的闸换个入口就绕过去了
- 识别出的有效期一律只写 `proposedExpiry`，永不直接落 `expiry`，必须人工确认

---

## 九、已知的不确定性（登记在案，不是 bug）

- 器械类 125 个"别名"是口语俗称（额温枪/验孕棒/暖宝宝），**未经联网核实**，
  判定依据是"风险性质不同"而非"已核实"
- 混合包装条目（同品种既有铝塑板又有瓶装）按更保守的瓶装口径给值，
  说明里写明两种情况——这是一个字段表达两套规则的折中，不是精确答案
- 相当一部分开封期限取自剂型通用值而非说明书原文，均已在 `open_note` 标注"参考值"
- 全库有 27 个商品名同时覆盖多个剂型且期限不同，靠界面消歧兜住（不预填 + 剂型按钮）

---

## 十、涉及产品定位、需要人来拍板的事

- 药库含麻醉/精神类与高致畸管制药品（吗啡缓释片、芬太尼透皮贴、沙利度胺等）。
  `tip` 只写"上锁存放、剩余交回医疗机构、远离儿童孕妇、须遵医嘱"，不写任何用法用量。
  **是否让这些品种出现在面向普通用户的应用里，属产品定位问题。**
- 智谱账户的自动续费开关、消费上限（个人账号不提供上限，只能靠 §6.2 的全局闸）
- 域名、证书、以及与 `klinik.ren` 共用服务器带来的连带风险
