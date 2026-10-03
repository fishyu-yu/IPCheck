# IPCheck · NetProbe 网络诊断

一个部署在边缘网络的 IP、网络连通性与浏览器隐私诊断平台。界面品牌为 **NetProbe**，代码保存在 **IPCheck** 仓库，保留原项目提交历史，许可证以仓库 LICENSE 为准。

[在线使用](https://netprobe.yangzhan-ms.workers.dev) · [GitHub 仓库](https://github.com/fishyu-yu/IPCheck) · [接口文档](https://netprobe.yangzhan-ms.workers.dev/developers)

## 项目特点

- **中文优先体验**：浏览器首选语言为中文时显示简体中文，其他语言自动使用英文。导航、工具说明、结果状态、错误提示、无障碍标签和页面标题均支持本土化。
- **简洁的响应式界面**：柔和绿色与暖白配色、深色主题、清晰的信息层次；主题首次跟随系统，手动切换后保存在本机。支持手机抽屉导航和键盘操作。
- **结果可追溯**：展示数据来源、缺失字段、风险证据与冲突，不把“未检测”当成“安全”，不生成虚假延迟或泄露结论。
- **边缘运行**：React 前端与 Hono API 共用一个 Cloudflare Worker；生产环境不依赖常驻 Node.js、数据库或服务器文件系统。
- **按需检测**：浏览器指纹在本地计算；WebRTC、延迟与主动探测由用户启动。

## 功能与边界

| 功能                     | 数据来源与实现                                 | 使用条件                                   |
| ------------------------ | ---------------------------------------------- | ------------------------------------------ |
| 当前公网 IP、边缘节点    | Cloudflare 可信请求头与请求元数据              | 正式部署可用；本地不能自动获得公网访客地址 |
| IPv4 / IPv6 查询         | 默认 ipwho.is，可选 IPinfo                     | 第三方数据可能不完整或受限流影响           |
| ASN 与网络前缀           | RIPEstat 的组织、RIR 与 BGP 数据               | 查询结果反映观测到的公告                   |
| 风险分析                 | 可选 IPQualityScore、AbuseIPDB，透明加权评分   | 未配置密钥时明确显示“未检测”               |
| DNS 与反向解析           | DNS-over-HTTPS，支持常见记录与 PTR             | 查询发送到配置的解析服务                   |
| 浏览器环境               | 浏览器提供的屏幕、语言、时区、硬件与网络信息   | 浏览器限制的字段显示“不支持”               |
| 浏览器指纹               | 可观察字段的本地 SHA-256                       | 点击后计算，不上传、不保存指纹             |
| WebRTC 检测              | 实际 ICE 候选与公共 STUN                       | 点击后联系 STUN；候选缺失不等于没有泄露    |
| HTTP 延迟                | 浏览器发起 10 次真实请求并统计往返时间         | 测量浏览器到当前服务的 HTTP 延迟           |
| HTTP / TCP 探测          | 校验公网地址后固定目标 IP；Workers 使用 socket | 受运行时和目标网络策略限制                 |
| ICMP、全球探测、路由追踪 | 后端保留远程探针调用协议；Beta 精简高级页面    | 需要另行部署并配置真实探针                 |
| DNS 泄露检测             | 后端保留权威 DNS 采集协议；Beta 移除检测页面   | 需要自建权威 DNS 采集服务                  |

15 个页面入口覆盖概览、查询、检测工具、接口文档与系统状态。网络地址、域名、组织名称、协议名称和 API 字段保持原始含义；第三方地名不会通过猜测强行翻译。中文浏览器包括 `zh-CN`、`zh-TW`、`zh-HK` 等语言标识，当前统一呈现简体中文。

## Beta 界面

顶部横向导航常驻概览、IP 查询、DNS 查询和延迟测试；配置风险数据源后显示风险分析。ASN、可用的 HTTP / TCP 连通性、浏览器环境、指纹和 WebRTC 收进“更多工具”。未配置或运行时不支持的入口和探测选项隐藏，实现与 API 保留；直接访问不可用工具会跳转到工具列表。

导航、卡片和控件采用柔和圆角，支持明暗主题与手机横向滚动。导航高亮平滑滑动，页面进入及“更多工具”展开收起均有轻量过渡；系统启用“减少动态效果”时关闭动画。切换页面回到顶部，导航本身不会因页面加载而消失。首页移除重复摘要和装饰，未测量时不显示空图表，风险面板只在数据源已配置时展示。

公网 IP 居中显示，使用本地 SVG 像素字形，支持 IPv4 和 IPv6。数字逐字出现，光标短暂闪烁后保持稳定；完整地址始终供辅助技术读取和文本选择，复制按钮位于卡片右上角。卡片保留圆角，并加入轻量扫描线和终端边角。

Beta 精简了全球节点检测、路由追踪和 DNS 泄露检测页面；反向 DNS 已合并为 DNS 查询中的 PTR 类型。旧页面地址跳转到对应核心工具，后端 API 保持兼容。页尾保留源码许可证及 whois.f1shyu.com 设计参考声明。

## 快速开始

使用 Node.js 24（仓库包含 `.node-version`）及 pnpm 10 或更新版本。依赖由 `pnpm-lock.yaml` 固定；Cloudflare 已实测 Node.js 24.21.0 / pnpm 10.11.1。

```bash
git clone https://github.com/fishyu-yu/IPCheck.git
cd IPCheck
pnpm install --frozen-lockfile
pnpm dev
```

打开 [本地开发页面](http://127.0.0.1:5173)。无需密钥即可启动基础功能。可复制 `.env.example` 为 `.env.local` 添加开发配置。

本地请求来自回环地址，首页会提示无法获取公网 IP。需要测试指定地址时，可设置 `DEV_PUBLIC_IP`；界面会明确标注这是开发配置。应用只显示当前连接所使用的 IPv4 或 IPv6，同时验证双栈需要另行配置独立的 IPv4-only / IPv6-only 域名。

| 命令                       | 用途                                    |
| -------------------------- | --------------------------------------- |
| `pnpm dev`                 | 启动 Vite 与本地 Hono API               |
| `pnpm lint`                | 检查代码规范                            |
| `pnpm typecheck`           | TypeScript 严格类型检查                 |
| `pnpm test`                | 单元、API、安全和语言测试               |
| `pnpm test:e2e`            | 浏览器测试，自动启动开发服务            |
| `pnpm build`               | 生成前端、边缘入口、OpenAPI 与 SEO 文件 |
| `pnpm build:ci`            | 依次执行规范检查、单元测试和生产构建    |
| `pnpm preview --port 8787` | 使用 Cloudflare workerd 在本地预览      |
| `pnpm check:cloudflare`    | 部署预检，不发布                        |
| `pnpm deploy:cloudflare`   | 构建并发布 Worker                       |
| `pnpm build:edgeone`       | 生成 EdgeOne 专用产物                   |

浏览器测试默认使用本机 Chrome。没有 Chrome 时可安装 Playwright Chromium，并调整 `playwright.config.ts` 的 `channel`。`pnpm dev` 不支持原始 TCP socket；验证 socket 使用 workerd 预览。本地测量不能代表生产边缘节点时延。

## Cloudflare 部署与 GitHub 自动更新

当前 Worker 名称为 `netprobe`，已通过 Cloudflare Workers Builds 连接 `fishyu-yu/IPCheck`，生产分支为 `master`。向该分支推送会自动检查、构建并部署。其他账号复用本项目时，仍需在自己的 Cloudflare 控制台建立 Git 连接。

当前已保存并验证的配置如下；迁移到其他账号时，在 **Workers 和 Pages → Worker → 设置 → 构建** 中连接仓库并设置：

| 设置           | 值                              |
| -------------- | ------------------------------- |
| GitHub 仓库    | `fishyu-yu/IPCheck`             |
| 生产分支       | `master`                        |
| 根目录         | 仓库根目录 `/`                  |
| 构建命令       | `pnpm run build:ci`             |
| 部署命令       | `npx wrangler deploy`           |
| 非生产分支预览 | 已关闭；生产部署只跟踪 `master` |

连接成功后，向 `master` 推送提交会触发 Cloudflare 拉取代码、安装依赖、检查、构建与部署。构建失败时不会执行部署命令。构建记录中的提交 SHA 应与 GitHub 最新提交一致；出现失败时查看该次构建日志。配置依据见 [Cloudflare Workers Builds 官方文档](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)。

### beta 分支与测试域名

`beta` 使用独立 Worker `netprobe-beta`，测试地址为 [ipbeta.f1shyu.com](https://ipbeta.f1shyu.com)。在该 Worker 的 **设置 → 构建** 中连接同一仓库，配置如下：

| 设置                       | 值                                                 |
| -------------------------- | -------------------------------------------------- |
| GitHub 仓库                | `fishyu-yu/IPCheck`                                |
| 生产分支（该 beta Worker） | `beta`                                             |
| 根目录                     | `/`                                                |
| 构建命令                   | `pnpm run build:ci:beta`                           |
| 部署命令                   | `npx wrangler deploy --config wrangler.beta.jsonc` |
| 非生产分支预览             | 关闭                                               |

向 `beta` 推送会自动检查、构建并更新测试站点。`.env.beta` 提供前端、OpenAPI、规范链接与站点地图的测试域名；`wrangler.beta.jsonc` 保存独立 Worker、域名路由、运行时地址与限流绑定。`master` 继续使用原生产配置。beta 所需的可选服务密钥在 `netprobe-beta` 中单独配置。

首次手动部署或故障排查可执行 `pnpm deploy:cloudflare:beta`。检查自动更新时，对照该 Worker 的最新构建提交 SHA 与 GitHub `beta` 提交。

首次手动部署或故障排查：

```bash
pnpm exec wrangler login
pnpm build:ci
pnpm check:cloudflare
pnpm exec wrangler deploy
```

生产地址同时配置于 `.env.production` 的 `VITE_SITE_URL` 和 `wrangler.jsonc` 的 `SITE_URL`。更换域名时同步修改并重新构建。Worker 名称须与 Cloudflare 项目匹配，避免发布到另一个 Worker。域名在 Cloudflare 的域与路由设置中绑定。

可选服务密钥通过 Worker Secret 配置，例如：

```bash
pnpm exec wrangler secret put IPINFO_TOKEN
pnpm exec wrangler secret put IPQS_KEY
pnpm exec wrangler secret put ABUSEIPDB_KEY
```

只配置实际使用的服务。**密钥不可使用 `VITE_` 前缀**，否则可能进入前端产物。构建环境变量与 Worker 运行时变量是两个不同的配置位置。

### 其他部署方式

**Cloudflare Pages**：`pnpm build` 生成 `dist/_worker.js`，可执行 `pnpm exec wrangler pages deploy dist --project-name YOUR_PROJECT`。Pages 的环境变量、密钥和限流需要单独配置，不能假定它继承 Worker 的绑定。

**Tencent EdgeOne**：运行 `pnpm build:edgeone`，静态输出目录为 `dist-edgeone`，API 入口生成到 `edge-functions/api/[[path]].js`。导入仓库后设置同一构建命令，并配置服务端变量和 `/api/*` 限流。适配器已实现，但未完成真实 EdgeOne 账号的生产验收；当前不实现原生 TCP socket，相关能力需要远程探针。

## 配置参考

| 变量                                         | 用途                                   | 默认 / 必要性                |
| -------------------------------------------- | -------------------------------------- | ---------------------------- |
| `IPINFO_TOKEN`                               | IPinfo 地理与网络数据，需匹配 API 套餐 | 可选                         |
| `IPQS_KEY`                                   | IPQualityScore 风险证据                | 可选                         |
| `ABUSEIPDB_KEY`                              | AbuseIPDB 滥用证据                     | 可选                         |
| `GEO_FREE_PROVIDER`                          | 是否使用 ipwho.is 免费数据源           | `on`；`off` 关闭             |
| `DOH_URLS`                                   | 逗号分隔的 HTTPS JSON DoH 地址         | 未配置时使用内置来源         |
| `ACTIVE_PROBES`                              | 是否允许主动探测                       | `on`；`off` 关闭             |
| `ALLOWED_PORTS`                              | TCP 端口允许列表                       | 默认列表见下文               |
| `PROBE_URL` / `PROBE_SECRET`                 | 远程探针协调服务及认证密钥             | ICMP、全球探测、路由追踪需要 |
| `DNS_COLLECTOR_URL` / `DNS_COLLECTOR_SECRET` | 权威 DNS 采集服务与认证密钥            | DNS 泄露检测需要             |
| `DNS_TEST_DOMAIN`                            | 已委派的 DNS 测试域名，不含协议        | DNS 泄露检测需要             |
| `SITE_URL`                                   | 运行时生产站点地址                     | 已配置当前线上地址           |
| `VITE_SITE_URL`                              | 构建时 SEO、站点地图与规范链接地址     | 已配置当前线上地址           |
| `DEV_PUBLIC_IP`                              | 显式开发测试 IP                        | 仅用于本地开发               |

`.env`、`.env.local` 与 `.dev.vars` 不纳入版本控制；`.env.example` 为示例，`.env.production` 仅保存公开的站点地址。第三方服务有各自的配额及条款，失败时界面会显示降级或缺失状态。

## 检测结果如何理解

风险模型位于 `src/config/risk.config.ts`：VPN 20、代理 20、Tor 35、数据中心 10、机器人 15、滥用 30、垃圾邮件 15、黑名单 25、匿名网络 10；托管网络权重为 0，避免重复计分。

- 布尔真值贡献完整权重，假值贡献 0；数值证据先归一化到 0–1。
- 同一信号多来源取最大严重程度，保留并展示冲突，不重复累加。
- 总分最高 100：低于 25 为低风险，低于 60 为中风险，其余为高风险。
- 完全没有证据时不生成分数；只有部分证据时展示覆盖情况。低分不代表绝对安全。
- 服务商未提供置信度时显示“未知”。地理信息是估计位置，不是设备精确定位。
- 未明确判定住宅网络时不会因为 ASN 属于 ISP 就标记“住宅”。没有来源的字段保持未知。

HTTP 探测使用固定公网 IP 的 `HEAD /`，不跟随重定向、不转发正文、不携带访客凭证。收到合法 4xx / 5xx 响应也代表目标返回了 HTTP 响应，状态码另行显示。没有可用数据时不编造 DNS、连接或首字节分阶段耗时。

原生边缘实现无法同时可靠固定目标 IP 并为 HTTPS 域名保留 TLS servername 时，会显示不支持；这类请求需要具备相应能力的远程探针。运行时仍可能拒绝平台自身 IP、特定端口或目标网络。

## 隐私与安全

默认不把访问者 IP、查询历史、浏览器指纹或 WebRTC 候选写入应用日志或数据库；没有跟踪脚本。指纹在点击后本地计算，主题是唯一保存在 localStorage 的偏好。

IP 查询会按功能需要发送到已配置的地理或风险服务；DNS 查询会发送到 DoH 服务；主动 WebRTC 检测会联系公共 STUN。服务商与托管平台可能有自己的日志策略。

服务结果使用有界缓存：地理信息与 ASN 最多 24 小时，风险结果最多 1 小时，DNS 根据最小 TTL 缓存且最多 1 小时。缓存中可含被查询的 IP，不应称为匿名数据。访客响应、主动探测与浏览器信息不缓存。

目标验证拒绝内网、回环、链路本地、特殊用途与云元数据地址，校验全部 A / AAAA 结果，并固定连接到已校验 IP，以减少 SSRF 与 DNS 重绑定风险。请求体、响应体、并发与超时均有限制。

普通查询每 IP 每分钟 60 次，主动探测每分钟 10 次；默认 TCP 端口为 `80,443,22,25,53,110,143,465,587,993,995,3306,5432,6379`。Cloudflare Rate Limit 绑定是边缘节点范围的近似限流，不是全球强一致配额；其他适配器的内存计数也仅作用于单个实例。大流量部署应增加 WAF、全局额度与预算控制。

远程探针和 DNS 采集服务的认证、目标校验与过期规则见 [部署协议](probe/README.md)。启用 DNS 测试域名后须允许相应 HTTPS 子域名访问：Worker 自动设置 CSP；EdgeOne 需同步修改 `edgeone.json` 后重建。

## 开发与维护

```text
src/                  React 页面、共享组件、主题与浏览器检测
  config/i18n.ts      语言选择与显示层翻译
  config/zh.ts        中文字典；英文源文案保留作回退
  config/site.ts      品牌、导航与站点配置
  config/risk.config.ts 风险权重
api/                  Hono 路由及 IP / ASN / DNS / 风险服务
edge/core/            平台协议、安全、缓存和限流
edge/cloudflare/      Workers / Pages 入口与 TCP socket
edge/edgeone/         EdgeOne 适配器
edge/local/           本地开发适配器
probe/                远程探针与 DNS 采集服务协议
scripts/              构建、SEO、OpenAPI 和网络冒烟脚本
tests/                单元、接口、安全与浏览器测试
docs/verification.md  实际验证记录
```

新增界面文案时保留英文源文案，在 `src/config/zh.ts` 添加中文，在渲染边界调用 `localize`。不要翻译表单值、API 键、网络协议字段或指纹输入；避免改变检测语义。语言读取浏览器首选项，调整浏览器首选语言后刷新即可验证。

技术栈：React 19、TypeScript、Vite、Tailwind 4、Hono、Zod、TanStack Query、Recharts、Lucide、Vitest 与 Playwright。构建生成 15 个页面入口、规范链接、OpenGraph、站点地图与 `/openapi.json`；页面主体为客户端渲染，未实现内容级服务端渲染。

API 统一返回 `success/data/meta` 或 `success/error`。能力不可用可能返回 `data.supported=false`；输入错误、拒绝、限流、上游失败分别使用相应 HTTP 状态码。界面的中文翻译不改变 API 协议。使用示例见 `/developers`。

## 常见问题

**为何有些工具显示未配置或不支持？** 这些功能依赖付费数据源、远程探针或权威 DNS 服务。仓库实现了调用端和明确的降级状态，不包含伪造的探测服务。

**为何中文界面还出现英文组织名、域名或代码？** 品牌、组织数据、IP、主机名及协议字段保留原始内容，避免错误翻译。所有应用自有说明和操作文案按浏览器语言显示。

**推送后网站没有变化怎么办？** 检查是否推到 `master`、Cloudflare 是否已连接正确仓库、最新构建是否成功，以及部署记录的提交 SHA 是否匹配。只修改本地文件不会触发部署。

**如何验证生产功能？** 查看 `/api/health` 与系统状态页，再测试 IP / DNS 查询。主动测试只对你有权测试的公网目标执行。真实网络冒烟可在 workerd 启动后运行 `pnpm test:smoke`。

## 许可证

项目当前采用 [GNU AGPL v3 许可证](LICENSE)，已同步仓库维护者在云端提交的许可证更新。许可证正文保留英文原文，具体条款以该文件为准；README 中不再沿用旧 MIT 说明。网站页脚提供公开源码入口。

## 验证状态

2026-10-01 已通过 83 项单元测试、6 项浏览器测试、生产构建与 Cloudflare 部署预检。Git 推送触发的自动构建及生产发布也已成功验证，记录见 [验证文档](docs/verification.md)。测试覆盖 19 个页面、中文与英文回退、移动端、主题、输入错误、浏览器指纹及真实延迟请求。

本次 Beta 界面更新通过 87 项单元测试、9 项浏览器测试、规范与类型检查，以及 beta 生产构建。新增验证涵盖横向菜单、能力过滤、保留的功能在配置后可用、导航与页面过渡、减少动态效果、320–1440 px 布局、旧页面跳转及合并后的 PTR 查询；构建保留 15 个页面入口。

2026-10-04 的居中像素 IP 更新通过 10 项浏览器测试、规范与类型检查和 beta 构建；新增验证涵盖地址居中、完整文本、IPv6、减少动态效果及 320–1440 px 布局。预览截图中的地址明确标注为示例数据，正式界面继续使用现有 API 返回值。
