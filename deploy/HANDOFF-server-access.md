# 交接:服务器登录方式与【U7】证书邮箱

> 2026-08-09 由 KliniK 主仓会话现场只读探测后落账(未改动服务器任何状态)。
> 本文件回答 DEPLOY.md 第 0 节表格里的 **U4(SSH 登录方式)** 与 **U7(证书邮箱)**,
> 并登记若干「手册里写了但实际已经不需要做」的步骤。
> **凭据纪律照旧**:本文件不含任何密码、密钥、Key;智谱 API Key 仍只走 U5 亲手写入。

---

## 1.【U4】服务器登录:用别名 `klinik`,不要去问 IP 和用户名

目标机**就是正在跑 `klinik.ren` 的那一台**(腾讯云,Ubuntu 24.04.4 LTS,主机名 `VM-0-11-ubuntu`)。
开发机的 `~/.ssh/config` 里**已经配好别名 `klinik`**,免密直登。

DEPLOY.md 全文中的 `<用户名>@<服务器IP>` 一律替换为 `klinik`:

```bash
# 第 3 步:登录
ssh klinik

# 第 4 步:传文件(在开发机上跑)
scp dist/index.html dist/manual.html klinik:/tmp/
scp proxy.mjs nginx-2c.klinik.ren.conf systemd-2c-proxy.service DEPLOY.md klinik:/tmp/
```

- 远端用户:`ubuntu`,家目录 `/home/ubuntu`。
- **sudo 免密(NOPASSWD)**:经 ssh 非交互执行 `sudo ...` 不会卡在密码提示上,
  手册里那些 `ssh klinik 'sudo ...'` 形式可以直接跑。
- scp 目标写相对路径时是相对家目录(如 `klinik:bin/x.sh` → `/home/ubuntu/bin/x.sh`)。

---

## 2.【U7】证书邮箱:**不需要邮箱,该项消解**

现场核对 `certbot show_account` 的结果:

```
Account URL:   https://acme-v02.api.letsencrypt.org/acme/acct/3498567996
Email contact: none
```

即 `klinik.ren` 当初就是**无邮箱注册**的 Let's Encrypt 账户。certbot 为新域名签发时
会**自动复用这个已有账户**,`-m` 对已注册账户不生效。

**DEPLOY.md 7.2 的命令改为**(删掉 `--agree-tos -m <你的邮箱> --no-eff-email`):

```bash
sudo certbot certonly --webroot -w /var/www/2c.klinik.ren -d 2c.klinik.ren
```

> **不要执行 `certbot update_account -m <邮箱>`**。那会改掉**整台机所有证书**的联系人,
> 包括生产站 klinik.ren 的——属用户裁决项,未获授权前不得动。
> (只有在用户明确要「到期提醒邮件」时才谈这件事。)

---

## 3. 已经满足、可以跳过的步骤

| DEPLOY.md 步骤 | 实测状态 | 处置 |
|---|---|---|
| U3 放行 TCP 80 / 443 | 已放行(klinik.ren 正在这台机上对外跑 HTTPS) | 跳过,核对即可 |
| 第 3 步 `apt install -y nodejs` | 已装 **node v22.23.1**(≥18) | 跳过安装;但 `which node` 仍要跑,拿实际路径对齐 `systemd-2c-proxy.service` 的 `ExecStart` |
| 7.1 `apt install -y certbot` | 已装,在 `/usr/bin/certbot` | 跳过 |
| 7.4 自动续期 | `certbot.timer` 已 **active**(下次触发 2026-08-09 11:21 CST) | 只需 `certbot renew --dry-run` 核对,不需配置 |

nginx 版本:`nginx/1.24.0 (Ubuntu)`。

---

## 4. 手册里没写、但必须当心的一点

服务器 `/etc/nginx/sites-enabled/` 里**目前只有 `klinik` 一个站**——
也就是说本次要动的 nginx,**和生产站 klinik.ren 是同一个 nginx 实例**。

因此:

1. **`nginx -t` 未绿,绝不 `systemctl reload nginx`**。配置写错再 reload,
   会把 klinik.ren 主站一起打下来。
2. 7.3 里那条「若报 `gzip` 或 `map` 指令重复」的提醒**要认真对待**:
   主站的 `/etc/nginx/nginx.conf` 很可能已经在 http 块里开了 gzip。
   按手册处置——删掉本站配置顶部的 gzip 那一节,**`map` 那节保留**。
3. 回滚路径(手册第 10 节 C 项)照旧:
   `sudo rm -f /etc/nginx/sites-enabled/2c.klinik.ren.conf && sudo nginx -t && sudo systemctl reload nginx`。

---

## 5. 本文件的取证来源

全部来自一次性只读 ssh 探针(`whoami` / `hostname` / `/etc/os-release` / `nginx -v` /
`command -v certbot` / `node -v` / `ls /etc/nginx/sites-enabled` /
`systemctl list-timers` / `certbot show_account` / `ls /etc/letsencrypt/live`),
**未做任何写入、未重启任何服务**。若与现场不符,以现场为准并回报。
