# NetProbe

可直接运行的 Edge-first IP / 网络环境 / 风险证据 / 延迟 / 隐私检测平台。React 前端、Hono API 和两个部署适配器共享业务逻辑；生产环境不需要常驻 Node.js、数据库、文件系统或子进程。

**结果原则：不伪造 IP、延迟、风险或泄露结论。** 缺少服务、浏览器能力或可靠字段时显示 Unknown、Not checked、Unsupported 或 Partial data。

## 本地运行

需要 Node.js 22.12+（本项目验证环境为 Node.js 24）和 pnpm。依赖版本由 `pnpm-lock.yaml` 固定。

```bash
pnpm install
pnpm dev
```

打开 http://127.0.0.1:5173 。Vite 开发中间件执行与生产相同的 Hono API，仅开发服务器使用 Node.js。

可将 `.env.example` 复制为 `.env.local`。没有任何密钥也能运行：IP 地理信息使用 ipwho.is；ASN 使用 RIPEstat；DNS 使用可切换 DoH；风险分析显示未检测。

本地回环连接无法提供浏览器公网 IP。首页不会将 `127.0.0.1` 或服务器出口地址冒充访问者公网 IP。Cloudflare / EdgeOne 正式部署后自动读取平台提供的访问者地址。本地可显式设置 `DEV_PUBLIC_IP` 验证指定公网 IP，UI 会标记它是开发配置，不是真实自动检测。只显示当前请求使用的 IPv4 **或** IPv6；同时测量双栈需要独立的 IPv4-only / IPv6-only 域名，未伪造另一种地址。

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm preview --port 8787
```

`preview` 使用 Cloudflare workerd 模拟器，不是静态文件服务器。它支持验证实际 socket 代码；本地时延代表本地模拟器，不代表任何生产 POP。`pnpm dev` 无原始 socket，TCP 显示 Unsupported。

启动开发服务后可运行 `pnpm test:e2e`（使用本机 Chrome；如需 Playwright 自带 Chromium，安装浏览器并移除 `playwright.config.ts` 的 `channel`）。

## 功能与检测语义

| 功能                         | 实现 / 数据来源                                                                  | 结果类别                                      |
| ---------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------- |
| 当前公网 IP、边缘位置        | Cloudflare request.cf / CF-Connecting-IP；EdgeOne context.clientIp / context.geo | Real Detection；地理字段仍是平台估计          |
| IPv4 / IPv6 查询             | IPinfo Core 可选；ipwho.is 默认降级                                              | Provider Detection                            |
| ASN、RIR、IPv4 / IPv6 前缀   | RIPEstat AS overview / announced-prefixes / RIR                                  | Provider Detection                            |
| IP 类型                      | IPinfo 的 mobile / hosting / AS type；来源和未知置信度保留                       | Provider Detection                            |
| Risk                         | IPQualityScore、AbuseIPDB 可选；透明加权模型                                     | Provider Detection + 本站模型                 |
| Environment                  | 浏览器、屏幕、语言、时区、硬件、Network Information API                          | Browser-side Detection；UA / 网络字段注明估计 |
| Fingerprint                  | 可观察字段的本地 SHA-256                                                         | Browser-side Detection / Local Only           |
| WebRTC                       | 真实 ICE candidates，显式启动后联系公共 STUN                                     | Browser-side Detection                        |
| DNS lookup / Reverse DNS     | DoH A / AAAA / CNAME / MX / TXT / NS / CAA / PTR                                 | Provider Detection                            |
| Latency                      | 浏览器发起 10 次 no-store HTTP 请求，用 performance.now 测 RTT                   | Browser-side Detection                        |
| HTTP Ping                    | 固定公网 IP 的 HEAD `/`；Cloudflare 使用原始 socket                              | Real Detection                                |
| TCP Ping                     | Cloudflare 官方 connect()；连接已验证 IP，测 socket.opened                       | Real Detection；其他平台降级                  |
| ICMP / 全球探测 / Traceroute | 已实现认证 RemoteProbeProvider 协议；需部署 Agent                                | 未配置时 Estimated / Unsupported              |
| DNS Leak                     | 随机域名 + 权威 Collector 协议 / 轮询 UI                                         | 未配置时 Estimated / Unsupported              |

每项工具有独立路由，默认深色主题，可切换浅色；移动端抽屉导航、表格横向滚动、加载骨架、真实实时测试进度。用户界面为英文；语言字典入口为 `src/config/i18n.ts`，完整中文翻译是后续工作。

品牌显示名称集中在 `src/config/site.ts` 的 `site.name`；修改一次会更新 UI、页面标题和 OpenAPI。Wrangler 的资源名称及 package 名是部署标识，可独立修改。状态颜色在 `src/config/site.ts`；主题变量在 `src/styles/global.css`。

### 不会推断的字段

没有可靠来源时，住宅 / ISP 的区别、邮编、网络前缀、反向 DNS、Hosting Provider、ASN 国家和上游均保持 Unknown。**ISP ASN 不等于 Residential。** IP 类型接口支持 Residential / Datacenter / Mobile / Business / Education / Government / Unknown；目前 IPinfo 没有明确住宅判定时不标住宅。网络范围取 Provider 明确返回的 route；Reverse DNS 可通过独立工具查询。

GeoProvider 默认按顺序降级，记录实际采用的来源；RiskProvider 并行查询，保留每条证据、缺失值和冲突。不编造 confidence；未提供时为 null / Unknown。

## 目录与技术栈

```text
src/
  config/         品牌、权重、语言字典
  types/          IPInfo / RiskSignal / PingResult 等统一类型
  components/     小型可复用 UI、风险面板、Recharts 图表
  layouts/        响应式导航 / 主题
  pages/          独立工具页面
  services/       API 客户端 / 本地浏览器检测
  hooks/          TanStack Query、延迟状态
  lib/            评分与统计纯函数
  styles/         Tailwind + 主题 CSS
api/              Hono 路由、Geo / Risk / ASN / DNS / Probe 服务
edge/core/        PlatformAdapter / Provider 接口、安全、缓存、限流
edge/cloudflare/  Worker / Pages 入口、官方 TCP socket
edge/edgeone/     Web 标准入口；无 Cloudflare 依赖
edge/local/       本地开发适配器
probe/            认证协议、Agent / Collector 部署契约
scripts/          产物构建、SEO、OpenAPI、真实网络冒烟
tests/            单元 / API / Provider / Playwright 测试
dist/             前端 + Cloudflare Pages _worker.js
dist-edgeone/     EdgeOne 专用静态产物（不暴露 Worker 源码）
edge-functions/   构建生成的 EdgeOne API 入口
```

React 19、TypeScript strict、Vite、Tailwind 4、Lucide、TanStack Query、Recharts、Hono、Zod、ipaddr.js、Vitest、Playwright、ESLint、Prettier。地图采用轻量 SVG 节点示意图；无真实 Agent 时不画虚假连线，不额外引入 MapLibre。未引入庞大的 UI 组件套件，基础 UI 在项目内维护。

## Risk 模型

`src/config/risk.config.ts` 是唯一权重来源：VPN 20、Proxy 20、Tor 35、Datacenter 10、Bot 15、Abuse 30、Spam 15、Blacklist 25、Anonymous 10；Hosting 权重 0，避免和 Datacenter 重复计分。

- 布尔信号 true 贡献全权重，false 为 0；数值证据归一到 0–1 后乘权重。
- 同一信号有多来源时取最大严重程度，**保留并明确显示冲突**，不重复累加。
- 总分上限 100。小于 25 / 60 分别标 Low / Moderate，其余 High。
- 完全没有证据时 `score: null`；只有部分证据时显示覆盖率与 Partial data。
- AbuseIPDB 的 abuseConfidenceScore 是报告风险指标，**不是**本项目编造的统计置信度。
- 当前未配置黑名单、Spam 等独立来源时显示 Not checked，绝不显示 0/N 或 Safe。

## HTTP / TCP 的真实限制

原生 Edge fetch 通常不能同时自定义 DNS 解析、固定连接 IP、保留 HTTPS SNI 和证书域名校验。为避免 DNS rebinding：

1. A 和 AAAA 均解析成功后才继续；校验每个地址。
2. 连接选定的公网 IP 字面量，不再次解析用户域名。
3. Cloudflare HTTP 用 `connect()` 到固定 IP 的 80 端口，发送 HEAD 和已校验 Host。
4. EdgeOne / 开发适配器使用 IP URL 的 HEAD，Host 由运行时允许程度决定；有的平台拒绝直接 IP 请求时返回失败，不伪造数据。
5. 本地直连 HTTPS **域名**返回 Unsupported；要保留 SNI / 证书校验，请配置具备固定 IP + TLS servername 能力的远端 Agent。HTTPS IP 字面量仅在证书对该 IP 有效时成功。
6. 不跟随重定向、不携带客户端 Cookie / Authorization、不接收自定义路径 / 方法 / Header、不转发响应正文。

只展示真实可测的 HEAD elapsed time / HTTP status / Server / 固定 target IP。DNS、连接、TTFB 分阶段耗时没有运行时支持就显示不可用。`success:true` 表示收到了合法 HTTP 响应，即使是 4xx / 5xx；HTTP status 始终单独展示。

Cloudflare 可能拒绝某些目标、平台自身 IP、25 端口等，即使端口在应用允许列表中；最终以官方运行时结果为准。计时精度受运行时限制。

## 安全与限流

- Zod 验证 IPv4 / IPv6 / 域名 / ASN / 端口；拒绝 URL、用户信息、路径、控制字符、命令片段与非标准数字 IP。
- 拒绝 loopback、RFC1918、链路本地、CGNAT、组播、IPv4-mapped IPv6、NAT64、6to4、文档地址、特殊用途范围及已知 Metadata 地址。IPv6 仅允许当前全球单播 2000::/3 内的非特殊地址。
- `.local` / `.internal` / localhost 等拒绝；混合公网/内网 DNS 答案整体拒绝。
- TCP 端口集中允许列表；默认 80,443,22,25,53,110,143,465,587,993,995,3306,5432,6379。
- 网络操作超时 3–4.5 秒；上游 JSON 限 2 MB；请求体限 2 KB；HTTP socket 头限 16 KB。
- 每 IP 普通查询 60/min；主动探测和启动 DNS session 10/min；同一 isolate 中每 IP 最多一个进行中的探测请求。
- Continuous Ping：单并发、10 次上限、两次请求间至少 6.5 秒，可取消。全局一次探测最多六个固定节点，Coordinator 必须额外实施节点并发和额度控制。
- Cloudflare Worker 配置了官方 Rate Limit bindings。它是 POP 范围的近似限流，**不是全球强一致配额**。EdgeOne / Pages 无 binding 时启用有界内存计数器，它只在单 isolate 内有效；生产必须增加平台 WAF / rate-limit 规则。更强保障可实现外部原子 RateLimitStore / Durable Object。
- 部署无外围限流时可设置 `ACTIVE_PROBES=off` 保留只读工具。`/api/health` 明示限流模式。
- 默认同源，无 `Access-Control-Allow-Origin: *`。CLI 没有浏览器 Origin 也可访问，但限流与安全验证仍生效。
- CSP、nosniff、Referrer-Policy、Permissions-Policy；不使用 innerHTML，不运行用户命令。

## Privacy Architecture

1. 默认不写访问者 IP、查询历史、UA、Fingerprint、WebRTC 候选到日志或数据库；没有跟踪脚本、持久会话或用户身份表。
2. Fingerprint 只在用户点击后计算，不上传也不存 localStorage；localStorage 只保存主题。
3. 当前地址和查询目标在功能需要时会发送给配置的 Geo / Risk Provider。`GEO_FREE_PROVIDER=off` 可禁用默认免费源；当前地址仍可依赖平台 metadata。DNS 查询会发往配置的 DoH。
4. Provider 结果有界缓存：Geo 24h、ASN 24h、Risk 1h；DNS 取响应最小 TTL，最多 1h，TTL 0 / 空答案不缓存。失败结果不长期缓存。Cache API 可用时启用，否则使用最多 500 项的 isolate 内存。查询结果中仍包含被查询的 IP；这不同于访问日志，不应将缓存描述为匿名数据。
5. 当前访问者响应、Ping、浏览器信息都不缓存，HTTP API 返回 no-store。限流仅存短期派生 key；这些不等于不可逆匿名化，也不用于追踪。
6. WebRTC 由用户启动，公共 STUN 会看到网络地址；没有 TURN 服务时无法主动生成 relay 候选。mDNS / 候选缺失 / 双栈不可比较都不会被描述为 No Leak。
7. Collector 必须使用短期 session、不可猜 token、120 秒过期；权威 DNS 会看到递归解析器地址，结果不应长期存储。
8. Cloudflare observability 默认关闭。云平台、反向代理与第三方服务自身可能有日志，运营者需要分别配置保留策略。

## 环境变量

| 变量                                         | 用途                                           | 必须          |
| -------------------------------------------- | ---------------------------------------------- | ------------- |
| `IPINFO_TOKEN`                               | IPinfo Core `/lookup` 访问；需要匹配套餐       | 否            |
| `IPQS_KEY`                                   | IPQualityScore VPN / Proxy / Tor / Bot / Abuse | 否            |
| `ABUSEIPDB_KEY`                              | AbuseIPDB Abuse / Tor / Hosting 信号           | 否            |
| `GEO_FREE_PROVIDER`                          | `on` 默认，`off` 禁止 ipwho.is                 | 否            |
| `DOH_URLS`                                   | 逗号分隔的 HTTPS JSON DoH 端点，按序降级       | 否            |
| `ACTIVE_PROBES`                              | `on` 默认，`off` 关闭主动探测                  | 否            |
| `ALLOWED_PORTS`                              | TCP 端口允许列表                               | 否            |
| `PROBE_URL` / `PROBE_SECRET`                 | 固定 HTTPS Coordinator URL / Bearer secret     | 远端探测需要  |
| `DNS_COLLECTOR_URL` / `DNS_COLLECTOR_SECRET` | 固定 HTTPS Collector / Bearer secret           | DNS Leak 需要 |
| `DNS_TEST_DOMAIN`                            | 已委派的 DNS 测试域名，不带协议                | DNS Leak 需要 |
| `SITE_URL`                                   | 生产规范 origin，不带末尾斜线                  | 部署建议      |
| `VITE_SITE_URL`                              | 构建时 canonical / sitemap / OG 的生产 URL     | SEO 需要      |
| `DEV_PUBLIC_IP`                              | 仅 Vite 开发环境的显式测试地址                 | 否            |

**密钥不得以 VITE\_ 开头。** `.env*` 与 `.dev.vars` 被忽略；生产通过云平台 Secret / Environment 设置。服务 URL 只来自部署配置，不接受浏览器提交的 URL。免费服务有限额，正式商业使用前需核实所选 Provider 条款及套餐，失败会降级。

## Cloudflare Workers 部署（首选）

Wrangler 已作为 devDependency 安装。

```bash
pnpm install --frozen-lockfile
pnpm exec wrangler login
# 在构建环境配置 VITE_SITE_URL=https://your-domain.example
pnpm build
pnpm check:cloudflare
pnpm exec wrangler secret put IPINFO_TOKEN
pnpm exec wrangler secret put IPQS_KEY
pnpm exec wrangler secret put ABUSEIPDB_KEY
pnpm deploy:cloudflare
```

仅添加实际需要的 secrets。`wrangler.jsonc` 包含静态资源绑定、两个 rate-limit namespace、兼容日期和 Worker 入口；namespace ID 应在同一账户内为这个项目保持独立。自定义域名可在 Worker Settings → Domains & Routes 配置，或在 Wrangler 加 `routes` / custom_domain。普通非敏感配置放 `vars`；生产 `SITE_URL` 与构建的 `VITE_SITE_URL` 保持一致。

`pnpm check:cloudflare` 是 dry-run，不发布任何内容。实际部署需要登录你的 Cloudflare 账户，本项目创建过程没有执行公网发布。

### Cloudflare Pages

`pnpm build` 生成 `dist/_worker.js` Advanced Mode 入口与 `_routes.json`。在 Pages 创建项目后执行：

```bash
pnpm exec wrangler pages deploy dist --project-name YOUR_PROJECT
```

Pages 的密钥、环境变量、域名在项目设置中配置；不要假定 Worker 的 ratelimits 自动成为 Pages bindings，需要 Pages 支持的 binding 或 WAF 规则。所有路径经 `_worker.js` 执行安全头并交给 ASSETS。`.assetsignore` 只用于 Workers 静态资源上传时排除内部 worker 文件。

## Tencent EdgeOne Pages / Makers 部署

```bash
pnpm install --frozen-lockfile
pnpm build:edgeone
```

推荐在 EdgeOne 控制台导入包含本项目的 Git 仓库：

1. 根目录选项目根目录，安装命令 `pnpm install --frozen-lockfile`。
2. 构建命令 `pnpm build:edgeone`，静态输出 `dist-edgeone`。
3. 构建会将 API 打包为根目录 `edge-functions/api/[[path]].js`，里面不引用 Node.js 或 `cloudflare:sockets`。
4. 当前 EdgeOne Makers 文档采用 `edge-functions/`。旧版 EdgeOne Pages 控制台若要求 `functions/`，将该生成目录映射/复制为 `functions/api/[[path]].js`；**不要同时部署两套重复路由**。
5. 控制台添加 server-only 环境变量，再触发构建。`edgeone.json` 提供构建输出和安全响应头配置。
6. 在平台配置 `/api/*` 的 rate-limit / WAF 规则。API 接收可信 `context.clientIp` 和 `context.geo`，不猜测 CDN header。如果当前版本缺失 metadata，返回 Unknown。
7. 绑定自定义域名并验证 `/api/health`、`/api/ip`、`/openapi.json`。页面均生成独立 index.html，深链路径可直接打开；`/openapi.json` 是静态生成文档。

EdgeOne 未提供通用 TCP socket 适配实现，因此 TCP 显示 Unsupported；配置远端 Agent 后可转交它执行。HTTP 是否允许直接 IP 访问由实际运行时决定。未登录 EdgeOne 账户，无法把本地适配器测试当作生产部署验收。

### 启用 DNS Collector 时的 CSP

Cloudflare Worker / Pages 会根据 `DNS_TEST_DOMAIN` 为 HTML 加 `https://*.your-test-domain` 的 connect-src。EdgeOne 的静态安全头来自 `edgeone.json`，启用 Collector 时必须在该文件的 connect-src 添加同一个精确测试域名通配范围后重建，不要放开成 `https:` 或 `*`。Collector 的测试域名必须有可用的 wildcard TLS / HTTPS endpoint，否则请求可能无法触发预期的 DNS 查询。

## API / OpenAPI / SEO

`/developers` 有 curl、JavaScript、Python 示例；`/openapi.json` 在构建时生成，Cloudflare / 本地 API 也提供同源动态版本。响应统一 `success/data/meta` 或 `success/error`。对于能力不可用，成功响应中 `data.supported=false`；输入错误 400、拒绝 403、频控 429、上游失败 502/504。

每个工具都有独立 title、description、OpenGraph、canonical、静态入口、robots.txt 和 sitemap.xml。必须设置真实 `VITE_SITE_URL` 再构建，否则 SEO 使用明确的占位域名。页面内容仍是客户端渲染，不声称已完成内容级 SSR。

## 验证与后续工作

单元测试覆盖 IP / hostname / ASN / port、私网和特殊地址、全地址校验与 pinning、DNS-family 失败闭锁、重定向不跟随、风险模型和冲突、统计、WebRTC 双栈判定、Provider 降级、可信平台身份、并发释放、API 响应与频控。Playwright 覆盖工具路由、主题、移动导航、十次真实延迟与 fingerprint 零上传请求。真实网络冒烟：启动 `pnpm preview --port 8787` 后运行 `pnpm test:smoke`；也可传 `http://127.0.0.1:5173` 比较开发适配器。

已执行的结果见 `docs/verification.md`。后续需要运营配置而非伪造替代的部分：

- 部署 ICMP / Traceroute Agent、六地节点和真实权威 DNS Collector，协议见 `probe/README.md`。
- 配置付费风险 / IP 类型来源，扩展黑名单、Spam 与更多 GeoProvider。
- 根据生产流量增加跨 isolate 配额、WAF、防滥用认证和预算控制。
- 可选接入 MaxMind、自建 GeoIP、WHOIS、BGP peering、TLS 检测、完整中文翻译与内容 SSR。

## 官方参考

- [Cloudflare TCP sockets](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/)
- [Cloudflare Rate Limiting bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [EdgeOne Edge Functions](https://pages.edgeone.ai/document/edge-functions)
- [EdgeOne 配置](https://pages.edgeone.ai/document/edgeone-json)
- [IPinfo API 字段](https://ipinfo.io/developers/code-snippets)
- [ipwho.is 文档](https://ipwhois.io/documentation)
- [RIPEstat](https://stat.ripe.net/docs/data-api/api-endpoints/announced-prefixes)
