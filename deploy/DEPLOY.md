# 第二时钟 · 部署手册

> **你的药，开封后还能用多久**
> 目标站点：`https://2c.klinik.ren` ｜ 宿主：腾讯云 Lighthouse（香港）

本手册面向**执行者**，从零到站点可用逐步走完。命令可直接复制；
凡需要你填的值一律写成 `<尖括号>`，**全文没有其他占位符**。

---

## 0. 先看这张表：哪些必须你本人做

代理与自动化能代跑绝大多数命令，但下面几步**只能由账号主人操作**，
因为它们要么涉及账号所有权，要么涉及凭据，要么是花钱的动作。

| # | 事项 | 为什么只能你做 |
|---|---|---|
| U1 | 确认 `klinik.ren` 域名在你名下、可加解析 | 域名所有权 |
| U2 | 在 DNS 控制台加 `2c` 的 A 记录 | 需登录域名商后台 |
| U3 | Lighthouse 防火墙放行 80 / 443 | 需登录腾讯云控制台 |
| U4 | 提供服务器 SSH 登录方式（或代为执行第 2–9 步） | 服务器凭据 |
| U5 | 在智谱控制台取 API Key，并**亲手**写进 `/etc/2c-proxy/env` | 凭据绝不经他人之手、不进聊天记录 |
| U6 | 确认智谱账户余额够用（识别与联网查询按次计费） | 涉钱 |
| U7 | 证书签发时填的邮箱 | 属你的身份信息 |
| U8 | **在智谱控制台设账户消费上限 / 用量告警** | 涉钱，且是唯一不可绕的最后一道闸（见下） |

> **凭据纪律**：API Key 从头到尾只出现在两个地方——智谱控制台，
> 和服务器上的 `/etc/2c-proxy/env`。不进仓库、不进命令行参数、不进 shell history、
> 不贴进任何对话。下面第 6 步给了安全的写入方式。

---

## 0.5 【U8】去智谱控制台设消费上限（**上线前就去设，别等出事**）

本站是一个**公开、无需登录**的页面，而它背后代转的是**按次计费**的接口。
也就是说：任何人只要知道 `2c.klinik.ren`，就能替你花钱。

代码侧已经加了三道闸，但**没有一道是不可绕的**：

| 闸 | 位置 | 拦得住什么 | 拦不住什么 |
|---|---|---|---|
| 每 IP 30 次/分钟 | `proxy.mjs` `RATE_LIMIT` | 单机脚本连打 | 换 IP（住宅代理池按小时论斤卖） |
| 全局 600 次/小时 + 2000 次/天 | `proxy.mjs` `GLOBAL_HOURLY_LIMIT` / `GLOBAL_DAILY_LIMIT` | 换 IP 刷量的总量 | **进程重启即清零**；服务被反复重启时闸门跟着归零 |
| 只放行 `https://2c.klinik.ren` 的 Origin | `proxy.mjs` 来源校验 | 别的网页偷用你的额度、无脑爬虫 | 伪造 Origin 的直接调用（`curl -H` 一行的事） |
| 每 IP 3 条并发 | nginx `limit_conn` | 单人开一百个标签页打爆内存 | 多 IP 协同 |

这些闸的作用是**限伤**，把"一夜之间烧掉四位数"压成"一夜之间烧掉个位数"。
真正**不可绕**的只有一个，因为它不在这台服务器上、攻击者碰不到：

> **智谱开放平台控制台 → 费用中心 / 账户管理 → 设置消费限额与用量告警。**
> 建议同时设两项：① 日消费上限（按你能接受的损失填，例如 5–20 元）；
> ② 余额/用量告警到手机或邮箱，好让你在触顶之前就知道。
>
> 另外**不要给这枚 Key 充太多余额**——账户里没有的钱，谁也刷不走。
> 更稳的做法是给本站单开一个子账号/独立 Key，与你其他用途的 Key 隔离，
> 万一被刷可以直接吊销这一枚，不影响别的。

**若发现被刷**（`journalctl -u 2c-proxy` 里出现大量陌生 IP，或智谱侧用量异常），
按这个顺序处置：

```bash
# 1. 立刻断流（页面仍可用，只是识别与联网查询提示服务不可用）
sudo systemctl stop 2c-proxy

# 2. 去智谱控制台吊销并重签 Key（这一步只有你能做）

# 3. 把新 Key 写进 /etc/2c-proxy/env（方式见第 5 步），然后
sudo systemctl start 2c-proxy
```

> 注意第 1 步只是止血：Key 在被停掉之前已经泄漏给了谁，是查不清的，
> 所以第 2 步的**吊销重签不能省**。

---

## 1. 本地：生成不含密钥的部署版（在你的开发机上做）

仓库里的 `index.html` 内嵌了一枚**本地调试用**的智谱 Key（常量 `LOCAL_DEBUG_API_KEY`），
方便双击 `file://` 直接试。**这份文件绝不能原样上传**——它会把 Key 发给每一个访客。

`build.mjs` 负责产出部署版：抹掉该常量，并做出口断言（无内嵌凭据、代理链路完整、
无自我递归、**产物在 DOM 桩里真跑得起来**）。

```bash
cd <仓库根目录>/deploy
node build.mjs
```

预期输出（体积为 2026-08-09 实测值，随源文件增删会小幅浮动）：

```
[ok] 部署版已生成：<...>/deploy/dist
     - 抹除 LOCAL_DEBUG_API_KEY
     index.html  379 KB (388461 B)
     manual.html 33 KB (33493 B)
     冒烟：file:// 初始化通过，DRUG_DB.length = 703；https:// 同样通过。
[ok] 出口断言全过：无内嵌凭据、代理链路完整、无残留旧判据、无自我递归、产物可跑。
```

**任何一条断言不过，脚本一个文件都不输出。** 这是有意的：宁可部署不出去，
不可把带 Key 的文件推上公网。真遇到失败，按提示人工核对 `index.html` 后再跑。

> **为什么多了「冒烟」这一行**（2026-08-09 补）：此前的出口断言全是**文本形态**检查，
> 只能看出产物「长什么样」，看不出它「跑不跑得起来」。实测撞到过一次：归一改写把
> `apiCredentialReady()` **定义处**的判据也替换掉了（全文唯一命中点恰好是它自己的函数体），
> 产物成了 `return CONFIG.useProxy || apiCredentialReady();` 这样的无条件自我递归。
> `http(s)` 下 `useProxy` 为真、`||` 短路，线上一切正常；而 `file://` 双击打开立刻
> `RangeError: Maximum call stack size exceeded`，初始化 IIFE 整段中断，
> 页头显示「内置 **0** 种药品」、卡片区空白。**形态断言对这类缺陷是瞎的。**
> 现在 `build.mjs` 会用 `node:vm` + `smoke-dom.mjs` 的 DOM 桩把产物真跑一遍
> （两条 protocol 都跑），初始化抛异常或 `DRUG_DB.length ≠ 703` 一律不落盘。
> 药库条数真变了，改 `build.mjs` 顶部的 `EXPECTED_DRUG_COUNT`，别绕开断言。

上传前再亲手确认一次（应输出 `0`）：

```bash
grep -c 'LOCAL_DEBUG_API_KEY = ""' deploy/dist/index.html   # 应为 1
grep -cE '[0-9a-f]{24,}\.[A-Za-z0-9]{12,}' deploy/dist/index.html   # 应为 0
```

> **前端为什么不用改代码就能走代理**：`index.html` 内置双链路——
> `file://` 打开时直连智谱（用本地调试 Key）；`http(s)://` 打开时
> `CONFIG.useProxy` 自动为真，请求转向同源 `/api/zhipu/*` 且**不带 Authorization**。
> 部署版只需把 Key 置空，链路切换是自动的。

---

## 2. 【U2】DNS：加一条 A 记录

在域名商（`klinik.ren` 所在的 DNS 控制台）添加：

| 字段 | 值 |
|---|---|
| 主机记录 | `2c` |
| 记录类型 | `A` |
| 记录值 | `<Lighthouse 实例的公网 IP>` |
| TTL | `600` |

公网 IP 在腾讯云 Lighthouse 控制台的实例详情页。生效后本地验证：

```bash
dig +short 2c.klinik.ren
# 或 Windows：nslookup 2c.klinik.ren
```

输出应正是那个公网 IP。**没解析出来就别往下走**——certbot 签发会失败。

同时【U3】确认 Lighthouse 防火墙已放行 `TCP 80` 与 `TCP 443`。

---

## 3. 服务器：建目录与专用用户

```bash
ssh <用户名>@<服务器IP>
```

```bash
# 站点目录
sudo install -d -m 755 -o www-data -g www-data /var/www/2c.klinik.ren

# 代理程序目录
sudo install -d -m 755 -o root -g root /opt/2c-proxy

# 代理专用系统用户（无登录 shell、无家目录）
sudo useradd --system --no-create-home --shell /usr/sbin/nologin 2cproxy || true

# 确认 node 存在且版本 ≥ 18（proxy.mjs 用了 ESM 与 node: 前缀导入）
node -v
which node        # 若不是 /usr/bin/node，需同步改 service 里的 ExecStart 路径
```

Node 若未装（Ubuntu）：

```bash
sudo apt update && sudo apt install -y nodejs
node -v           # 低于 18 请改用 NodeSource 源安装
```

---

## 4. 传文件

在**开发机**上执行（不是服务器上）：

```bash
cd <仓库根目录>/deploy

# 站点静态文件（注意是 dist/ 里的部署版，不是仓库根的 index.html）
scp dist/index.html dist/manual.html <用户名>@<服务器IP>:/tmp/

# 代理程序与配置
scp proxy.mjs nginx-2c.klinik.ren.conf systemd-2c-proxy.service DEPLOY.md \
    <用户名>@<服务器IP>:/tmp/
```

用 rsync 也可以（增量、适合反复改版）：

```bash
rsync -avz --chmod=F644 dist/ <用户名>@<服务器IP>:/tmp/2c-dist/
```

回到**服务器**上就位：

```bash
sudo install -m 644 -o www-data -g www-data /tmp/index.html  /var/www/2c.klinik.ren/index.html
sudo install -m 644 -o www-data -g www-data /tmp/manual.html /var/www/2c.klinik.ren/manual.html
sudo install -m 644 -o root -g root         /tmp/proxy.mjs   /opt/2c-proxy/proxy.mjs
sudo install -m 644 -o root -g root         /tmp/DEPLOY.md   /opt/2c-proxy/DEPLOY.md

# 传上来的临时副本清掉，别留在 /tmp
rm -f /tmp/index.html /tmp/manual.html /tmp/proxy.mjs /tmp/DEPLOY.md
```

---

## 5. 【U5】注入密钥（**你本人做**）

```bash
sudo install -d -m 750 -o root -g root /etc/2c-proxy
sudo install -m 600 -o root -g root /dev/null /etc/2c-proxy/env
sudo nano /etc/2c-proxy/env
```

在编辑器里写**一行**（等号两侧无空格，值不加引号）：

```
ZHIPU_API_KEY=<智谱控制台的 API Key>
BAILIAN_API_KEY=<阿里云百炼控制台的 API Key>
```

保存退出后自查权限：

```bash
sudo stat -c '%a %U:%G' /etc/2c-proxy/env      # 必须输出：600 root:root
```

> **为什么用编辑器而不是 `echo ... >`**：`echo` 会把 Key 原文留在
> `~/.bash_history` 里，也会短暂出现在 `ps` 的进程列表中。用编辑器两样都避开。
> 若你已经不慎用过 `echo`，立刻清理：
> `history -d <行号>` 然后 `history -w`，或直接 `shred -u ~/.bash_history`
> 后重开会话——并**去智谱控制台把那把 Key 轮换掉**（泄漏过的 Key 不要再用）。

---

## 6. 启动代理服务

```bash
sudo install -m 644 -o root -g root /tmp/systemd-2c-proxy.service \
     /etc/systemd/system/2c-proxy.service
rm -f /tmp/systemd-2c-proxy.service

sudo systemctl daemon-reload
sudo systemctl enable --now 2c-proxy
sudo systemctl status 2c-proxy --no-pager
```

期望看到 `active (running)`，日志首行形如：

```
[boot] 第二时钟 proxy 已启动 http://127.0.0.1:8791 routes=/api/zhipu/chat,/api/zhipu/search maxBody=12582912B rate=30/min global=600/h,2000/d origins=https://2c.klinik.ren trustForwardedHeaders=yes
[boot] 提醒：进程内配额重启即清零，唯一不可绕的最后闸是智谱控制台的账户消费上限。
```

> `trustForwardedHeaders=yes` 是**期望值**，它来自 `HOST=127.0.0.1`。
> 若这里显示 `no`，说明监听地址被改成了非回环 —— 频控会退化成只按 socket 地址计
> （nginx 反代下所有请求的 socket 地址都是 127.0.0.1，等于全站共用一个频控桶）。
> 见 `proxy.mjs` 里 minor-5 一节。

本机自测（还没配 nginx，先直接打代理端口）：

```bash
# 未知路径 → 404
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8791/api/nope
# GET 到合法路径 → 405
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8791/api/zhipu/chat
# 缺 Origin → 403（来源校验生效的正面证据，不是故障）
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8791/api/zhipu/search
# 真实联网查询 → 200，且返回 search_result
curl -s -X POST http://127.0.0.1:8791/api/zhipu/search \
  -H 'Origin: https://2c.klinik.ren' \
  -H 'Content-Type: application/json' \
  -d '{"search_engine":"search_std","search_query":"布洛芬混悬液 开封 有效期","count":3}' \
  | head -c 300; echo
```

> **`-H 'Origin: https://2c.klinik.ren'` 不能省。** 代理对无鉴权公网接口做了来源校验，
> 不带 Origin 一律 403。浏览器发 `POST + application/json` 时必带该头，所以真实前端
> 不受影响；只有 curl 这类手工调用需要自己补上。
> （这条校验拦不住伪造 Origin 的人 —— 它只挡"别的网页偷用你的额度"和无脑爬虫。
>  真正止血的是配额与智谱侧消费上限，见第 0.5 节。）

真实查询那条若返回 `401`/`invalid api key`，说明第 5 步的 Key 写错或未生效：
`sudo systemctl restart 2c-proxy` 后重试；仍不行请回到智谱控制台核对 Key。

若返回 **502 而日志里没有任何上游错误**，先怀疑 unit 的 `RestrictAddressFamilies`
被改窄了：少了 `AF_UNIX` / `AF_NETLINK` 时 DNS 解析会静默失败，症状正是"服务活着但恒 502"
（详见 `systemd-2c-proxy.service` 里该行的注释）。验证：

```bash
sudo -u 2cproxy getent hosts open.bigmodel.cn    # 解析不出来就是这个坑
```

---

## 7. 【U7】nginx 与证书

证书和 nginx 配置是个先有鸡还是先有蛋的问题：完整配置引用了还不存在的证书文件，
直接放上去 nginx 起不来。所以**先临时 HTTP 块 → 签证书 → 换完整配置**。

### 7.1 临时 HTTP 块（只为过 ACME 验证）

```bash
sudo tee /etc/nginx/sites-available/2c.klinik.ren.conf >/dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name 2c.klinik.ren;
    root /var/www/2c.klinik.ren;
    location / { try_files $uri $uri/ =404; }
}
EOF

sudo ln -sf /etc/nginx/sites-available/2c.klinik.ren.conf \
            /etc/nginx/sites-enabled/2c.klinik.ren.conf
sudo nginx -t && sudo systemctl reload nginx
```

验证 HTTP 已通（应返回 `200`）：

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://2c.klinik.ren/
```

### 7.2 签发证书

```bash
sudo apt install -y certbot          # 若未装

sudo certbot certonly --webroot -w /var/www/2c.klinik.ren \
     -d 2c.klinik.ren \
     --agree-tos -m <你的邮箱> --no-eff-email
```

成功后确认证书文件到位：

```bash
sudo ls -l /etc/letsencrypt/live/2c.klinik.ren/
```

certbot 首次安装会带上 `options-ssl-nginx.conf` 与 `ssl-dhparams.pem`；
若 `sudo ls /etc/letsencrypt/options-ssl-nginx.conf` 不存在，
就把正式配置里引用它们的那两行注释掉（不影响可用性，只是少了推荐的 TLS 参数模板）。

### 7.3 换上正式配置

```bash
sudo install -m 644 -o root -g root /tmp/nginx-2c.klinik.ren.conf \
     /etc/nginx/sites-available/2c.klinik.ren.conf
rm -f /tmp/nginx-2c.klinik.ren.conf

sudo nginx -t
```

`nginx -t` 是这一步唯一的合格判据，**必须先绿再 reload**：

```bash
sudo systemctl reload nginx
```

> 若 `nginx -t` 报 `gzip` 或 `map` 指令重复：说明 `/etc/nginx/nginx.conf` 的 http 块
> 里已经开了 gzip。把本配置文件顶部的 gzip 那一节删掉即可（map 那节要保留）。

### 7.4 确认自动续期

```bash
sudo certbot renew --dry-run
sudo systemctl list-timers | grep certbot
```

---

## 8. 验收

```bash
# 8.1 HTTP 跳 HTTPS（应为 301）
curl -s -o /dev/null -w '%{http_code}\n' http://2c.klinik.ren/

# 8.2 首页 200
curl -s -o /dev/null -w '%{http_code}\n' https://2c.klinik.ren/

# 8.3 说明书 200
curl -s -o /dev/null -w '%{http_code}\n' https://2c.klinik.ren/manual.html

# 8.4 【最重要】线上页面里不含任何密钥 —— 三条都必须输出 0
curl -s https://2c.klinik.ren/ | grep -cE '[0-9a-f]{24,}\.[A-Za-z0-9]{12,}'
curl -s https://2c.klinik.ren/ | grep -c 'Bearer'
curl -s https://2c.klinik.ren/ | grep -c 'open.bigmodel.cn/api'

# 8.5 部署版确实切到了代理链路（应输出 1）
curl -s https://2c.klinik.ren/ | grep -c 'proxyBase: "/api/zhipu"'
curl -s https://2c.klinik.ren/ | grep -c 'LOCAL_DEBUG_API_KEY = ""'

# 8.6 接口经 nginx 可达且真的通到智谱（应返回含 search_result 的 JSON）
#     Origin 头必须带，否则被来源校验挡成 403（见第 6 步的说明）
curl -s -X POST https://2c.klinik.ren/api/zhipu/search \
  -H 'Origin: https://2c.klinik.ren' \
  -H 'Content-Type: application/json' \
  -d '{"search_engine":"search_std","search_query":"阿莫西林胶囊 开封","count":3}' \
  | head -c 300; echo

# 8.7 未授权路径被挡（应为 404）
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://2c.klinik.ren/api/zhipu/anything

# 8.8 安全头与 gzip 就位
curl -sI https://2c.klinik.ren/ | grep -iE 'content-security-policy|strict-transport|x-frame|cache-control'
curl -sI -H 'Accept-Encoding: gzip' https://2c.klinik.ren/ | grep -i 'content-encoding'

# 8.9 来源校验生效（无 Origin 应为 403，错误 Origin 也应为 403）
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'Content-Type: application/json' -d '{}' \
  https://2c.klinik.ren/api/zhipu/search
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'Origin: https://evil.example' \
  -H 'Content-Type: application/json' -d '{}' \
  https://2c.klinik.ren/api/zhipu/search

# 8.10 频控生效（连打 35 次，尾部应出现 429）
#      注意：带上正确 Origin 才测得到频控，否则 35 条全是 403。
#      这些请求会真的打到智谱（{} 会被上游拒，但仍可能计费），量很小，跑一次即可。
for i in $(seq 1 35); do
  curl -s -o /dev/null -w '%{http_code} ' -X POST \
    -H 'Origin: https://2c.klinik.ren' \
    -H 'Content-Type: application/json' -d '{}' \
    https://2c.klinik.ren/api/zhipu/search
done; echo

# 8.11 单 IP 并发闸生效（10 条并发，应出现若干 429；来自 nginx limit_conn）
for i in $(seq 1 10); do
  curl -s -o /dev/null -w '%{http_code} ' -X POST \
    -H 'Origin: https://2c.klinik.ren' \
    -H 'Content-Type: application/json' -d '{}' \
    https://2c.klinik.ren/api/zhipu/search &
done; wait; echo
```

> **8.10 之后别忘了等一分钟**再做手机端实拍验收 —— 每 IP 的频控窗口是滑动 60 秒，
> 刚打满 35 次的那个出口 IP 会被挡一会儿。

**8.4 三条里只要有一条不是 0，立刻停下**：说明传上去的是带 Key 的源文件而不是
`dist/` 里的部署版。按第 10 步回滚，重跑第 1 步，并去智谱控制台**轮换 Key**
（已经公开过的 Key 必须作废，不能只是撤下文件）。

最后用手机浏览器打开 `https://2c.klinik.ren`，实拍一盒药走一遍
「拍照 → 识别 → 入库」，确认识别链路端到端可用。

---

## 9. 日常运维

```bash
# 看日志（只含 方法/路径/状态码/耗时/IP，不含请求体与 Key）
sudo journalctl -u 2c-proxy -f
sudo journalctl -u 2c-proxy --since '1 hour ago' --no-pager

# 重启代理（改了 /etc/2c-proxy/env 之后必做）
sudo systemctl restart 2c-proxy

# 改了 service 文件之后
sudo systemctl daemon-reload && sudo systemctl restart 2c-proxy

# 轮换 API Key
sudo nano /etc/2c-proxy/env && sudo systemctl restart 2c-proxy
```

### 更新前端（改版发布）

```bash
# 开发机
cd <仓库根目录>/deploy && node build.mjs
scp dist/index.html <用户名>@<服务器IP>:/tmp/index.html

# 服务器：先备份，再覆盖
sudo cp /var/www/2c.klinik.ren/index.html \
        /var/www/2c.klinik.ren/index.html.bak-$(date +%Y%m%d-%H%M%S)
sudo install -m 644 -o www-data -g www-data /tmp/index.html \
        /var/www/2c.klinik.ren/index.html
rm -f /tmp/index.html

# 覆盖后立刻重跑第 8.4 的三条密钥检查
```

HTML 的缓存策略是 `no-cache`（每次回源校验、靠 ETag 走 304），
所以改版**无需清 CDN、用户刷新即得新版**，也不会白白重传 379 KB
（`index.html` 未变时 304 只回响应头；真要重传，gzip 后约 85 KB）。

---

## 10. 回滚

按故障面分三种，各自独立：

**A. 前端页面出问题** —— 换回上一份备份：

```bash
ls -t /var/www/2c.klinik.ren/index.html.bak-* | head -5
sudo cp /var/www/2c.klinik.ren/index.html.bak-<时间戳> \
        /var/www/2c.klinik.ren/index.html
```

（静态文件即时生效，不用 reload nginx。）

**B. 接口出问题** —— 先看日志定位，再决定重启还是停服：

```bash
sudo journalctl -u 2c-proxy -n 100 --no-pager
sudo systemctl restart 2c-proxy

# 确认要停：停掉后页面仍可用（离线药品库照常工作），
# 只是"拍照识别"与"联网查询"会提示服务不可用
sudo systemctl stop 2c-proxy
sudo systemctl disable 2c-proxy
```

**C. nginx 配置出问题** —— `nginx -t` 不过时**绝不要 reload**，
先退回 7.1 的临时 HTTP 块，站点至少能出静态页：

```bash
sudo nginx -t                     # 先看错在哪一行
# 需要彻底摘掉本站（不影响服务器上其他站点）：
sudo rm -f /etc/nginx/sites-enabled/2c.klinik.ren.conf
sudo nginx -t && sudo systemctl reload nginx
```

**D. 密钥疑似泄漏** —— 顺序不能反：
① 智谱控制台**先吊销/轮换** Key → ② 改 `/etc/2c-proxy/env` → ③ `restart 2c-proxy`
→ ④ 排查泄漏路径（多半是上传了仓库根的 `index.html` 而非 `dist/` 里的）。
先换 Key 再排查，别反过来。

---

## 附：部署件清单

| 文件 | 去处 | 说明 |
|---|---|---|
| `build.mjs` | 只在开发机跑 | 产出无密钥的部署版到 `dist/` |
| `smoke-dom.mjs` | 只在开发机跑 | `build.mjs` 的出口冒烟测试（零依赖 DOM 桩），不单独部署 |
| `dist/index.html` | `/var/www/2c.klinik.ren/` | 主应用（无密钥），379 KB |
| `dist/manual.html` | `/var/www/2c.klinik.ren/` | 说明书，33 KB（与源 `manual.html` 逐字节相同） |
| `proxy.mjs` | `/opt/2c-proxy/` | 智谱 API 反代，零依赖 |
| `systemd-2c-proxy.service` | `/etc/systemd/system/2c-proxy.service` | 开机自启 |
| `nginx-2c.klinik.ren.conf` | `/etc/nginx/sites-available/` | 站点配置 |
| —（不在仓库） | `/etc/2c-proxy/env` | **仅此一处存放 API Key**，600 root:root |

端口占用：代理监听 `127.0.0.1:8791`，**不对外暴露**，只有本机 nginx 能连。
换端口需同步改三处：`systemd-2c-proxy.service` 的 `Environment=PORT`、
nginx 配置的 `proxy_pass`、以及第 6 步的自测命令。
