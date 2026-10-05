# IPCheck · NetProbe

[![License](https://img.shields.io/github/license/fishyu-yu/IPCheck)](LICENSE)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-5FA04E?logo=nodedotjs&logoColor=white)](.node-version)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/)

IP、网络连通性与浏览器隐私诊断工具。界面品牌为 **NetProbe**，源码仓库为 **IPCheck**；React 前端与 Hono API 在边缘运行，检测结果展示来源、覆盖度和限制。

**[在线使用](https://ip.f1shyu.com) · [Beta 测试站](https://ipbeta.f1shyu.com) · [API 文档](https://ip.f1shyu.com/developers) · [反馈问题](https://github.com/fishyu-yu/IPCheck/issues)**

## 站点与分支

| 环境   | 地址                                           | 分支                        | Cloudflare Worker |
| ------ | ---------------------------------------------- | --------------------------- | ----------------- |
| 正式站 | [ip.f1shyu.com](https://ip.f1shyu.com)         | `master`（GitHub 默认分支） | `netprobe`        |
| 测试站 | [ipbeta.f1shyu.com](https://ipbeta.f1shyu.com) | `beta`                      | `netprobe-beta`   |

下文功能说明以当前仓库代码为准。正式站与测试站可能展示不同的部署版本；分支源码与线上发布不一定同步，应核对对应 Worker 的构建提交 SHA。

GitHub 仓库 About 中的 Website 已设置为正式站地址。**GitHub Pages 当前未启用**；网站由 Cloudflare Workers 承载。GitHub Pages 提供静态托管，无法单独运行本项目的 Hono API。设置核对与首页介绍参考见 [GitHub 维护说明](docs/github.md)。

## 功能

- **IP 与网络信息**：查看当前连接的公网 IP、地理估算、ASN、组织和公告前缀，支持查询指定 IPv4 / IPv6。
- **本地 IP 纯净度模型**：结合无密钥检测来源、公共威胁情报与网络前缀，展示五项评分、逐来源证据、未知项、冲突和时效。可选密钥用于补强数据。
- **网络诊断**：DNS / PTR 查询、真实 HTTP 延迟与按运行时能力提供的 HTTP / TCP 连通性检测。
- **浏览器隐私工具**：查看浏览器环境，按需计算本地指纹或采集 WebRTC ICE 候选。
- **中文与响应式界面**：中文浏览器显示简体中文，其余语言回退英文；支持明暗主题、移动端、键盘操作和减少动态效果。
- **IP 位置地球**：居中像素地址可选择、复制；本地 Three.js 点阵地球支持拖动、旋转和重新居中，无 WebGL 时使用 SVG 回退。位置来自 IP 数据，属于估算位置。

### 数据来源与使用边界

| 功能                     | 实现与来源                                                                | 条件或限制                                                           |
| ------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 当前公网 IP              | Cloudflare 可信请求头与请求元数据                                         | 显示当前连接所用的一种地址族；本地回环请求无法自动获取公网 IP        |
| IP 查询                  | 默认 ipwho.is，可选 IPinfo                                                | 第三方数据可能缺失、过期或被限流                                     |
| ASN 查询                 | RIPEstat 的组织、RIR 与 BGP 数据                                          | 公告前缀反映来源观测                                                 |
| IP 纯净度                | 本地模型、IPQuery、VPN / Google Cloud 前缀、Tor / Spamhaus / Feodo / CINS | 默认无需密钥；证据不足、过期和未覆盖均明确标注                       |
| 外部风险分析             | 可选 IPQualityScore、AbuseIPDB                                            | 配置服务端密钥后显示；与纯净度分数分开                               |
| DNS / PTR                | DNS-over-HTTPS；PTR 合并在 DNS 查询页面                                   | 查询会发送给配置的解析服务                                           |
| HTTP 延迟                | 浏览器执行 10 次真实请求                                                  | 测量浏览器到当前服务的往返时间                                       |
| HTTP / TCP 探测          | 校验公网目标并固定 IP；Workers 原生 socket                                | 本地 Vite 与 EdgeOne 不提供原生 TCP socket；HTTPS 部分场景需远程探针 |
| 浏览器指纹               | 可观察字段的本地 SHA-256                                                  | 点击后计算，不上传、不持久保存指纹                                   |
| WebRTC                   | 实际 ICE 候选与公共 STUN                                                  | 点击后联系 STUN；未发现候选不等于没有泄露                            |
| ICMP、全球节点、路由追踪 | 保留远程探针 API 协议                                                     | 需要自建真实探针；高级独立页面已精简                                 |
| DNS 泄露                 | 保留权威 DNS 采集 API 协议                                                | 需要自建采集服务和委派测试域名；独立页面已移除                       |

可用工具根据 `/api/health` 返回的能力显示。组织名称、IP、域名及 API 字段保留原始含义；缺失信息保持未知。地球使用随代码提供的地图数据，不调用外部地图服务，详细实现见 [地球说明](docs/globe.md)。

## 本地开发

需要 **Node.js 24** 和 **pnpm 10**。Node 版本见 [.node-version](.node-version)，依赖由 `pnpm-lock.yaml` 固定。

```bash
git clone --branch beta https://github.com/fishyu-yu/IPCheck.git
cd IPCheck
pnpm install --frozen-lockfile
pnpm dev
```

打开 [127.0.0.1:5173](http://127.0.0.1:5173)。开发正式分支时，将克隆命令中的 `beta` 改为 `master`。无需密钥即可启动基础功能；可复制 [.env.example](.env.example) 为 `.env.local` 添加配置。

本地请求来自回环地址，首页会提示无法获取公网 IP。测试指定地址可设置 `DEV_PUBLIC_IP`，界面会标明这是开发配置。自动检查 IPv4 与 IPv6 两条连接需要另外配置独立地址族域名。

| 命令                                   | 用途                                              |
| -------------------------------------- | ------------------------------------------------- |
| `pnpm dev`                             | 启动 Vite 与本地 Hono API                         |
| `pnpm lint` / `pnpm typecheck`         | 代码规范与 TypeScript 检查                        |
| `pnpm test`                            | 单元、API、安全与本土化测试                       |
| `pnpm test:e2e`                        | Playwright 浏览器测试，自动启动开发服务           |
| `pnpm build` / `pnpm build:beta`       | 生成对应环境的前端、边缘入口、OpenAPI 与 SEO 文件 |
| `pnpm build:ci` / `pnpm build:ci:beta` | 规范检查、单元测试与对应环境构建                  |
| `pnpm preview --port 8787`             | 使用 Cloudflare workerd 本地预览                  |
| `pnpm check:cloudflare`                | 正式 Worker 部署预检                              |
| `pnpm build:edgeone`                   | 生成 EdgeOne 专用产物                             |
| `pnpm purity:update-data`              | 刷新随代码携带的纯净度前缀快照                    |

浏览器测试默认使用本机 Chrome，配置见 [playwright.config.ts](playwright.config.ts)。验证原生 TCP socket 需要 workerd；本地测量不能代表生产边缘节点时延。

## 部署与自动更新

### Cloudflare Workers

项目保留两套独立配置，测试站和正式站各自使用 Worker、密钥与限流命名空间。

| 设置           | 正式环境                           | Beta 环境                                          |
| -------------- | ---------------------------------- | -------------------------------------------------- |
| 配置文件       | [wrangler.jsonc](wrangler.jsonc)   | [wrangler.beta.jsonc](wrangler.beta.jsonc)         |
| GitHub 分支    | `master`                           | `beta`                                             |
| 根目录         | `/`                                | `/`                                                |
| 构建命令       | `pnpm run build:ci`                | `pnpm run build:ci:beta`                           |
| 部署命令       | `npx wrangler deploy`              | `npx wrangler deploy --config wrangler.beta.jsonc` |
| 构建时站点配置 | [.env.production](.env.production) | [.env.beta](.env.beta)                             |

既有 [部署记录](docs/verification.md) 记载两套 Worker 已通过 **Cloudflare Workers Builds** 连接同一 GitHub 仓库，分别跟踪上述分支，并关闭非生产分支预览。当前云端配置和每次发布结果以 Cloudflare 控制台为准；迁移到自己的账号时，需要重新建立 Git 连接。设置方法见 [Workers Builds 文档](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)。

首次手动部署或排查正式环境：

```bash
pnpm exec wrangler login
pnpm build:ci
pnpm check:cloudflare
pnpm exec wrangler deploy
```

Beta 使用对应配置预检和发布：

```bash
pnpm build:ci:beta
pnpm exec wrangler deploy --config wrangler.beta.jsonc --dry-run
pnpm exec wrangler deploy --config wrangler.beta.jsonc
```

正式站公开入口为 `ip.f1shyu.com`；当前仓库中的正式 `VITE_SITE_URL` 与 `SITE_URL` 仍指向 `https://netprobe.yangzhan-ms.workers.dev`，访问域名和生成的规范链接存在差异。统一域名时，应同步修改构建与运行时地址，并检查 Cloudflare 域名绑定后重新构建。Beta 的两项配置均指向 `ipbeta.f1shyu.com`。

可选密钥使用 Worker Secret，Beta 需单独指定配置：

```bash
pnpm exec wrangler secret put IPINFO_TOKEN
pnpm exec wrangler secret put IPQS_KEY
pnpm exec wrangler secret put ABUSEIPDB_KEY
# Beta 示例
pnpm exec wrangler secret put IPAPI_KEY --config wrangler.beta.jsonc
```

密钥只保存在服务端，禁止使用 `VITE_` 前缀。构建变量与 Worker 运行时变量需分别配置。

### 其他平台

- **Cloudflare Pages**：`pnpm build` 生成 `dist/_worker.js`，可用 `pnpm exec wrangler pages deploy dist --project-name YOUR_PROJECT` 发布。环境变量、密钥和限流需另行配置。Cloudflare Pages 与 GitHub Pages 是不同的托管服务。
- **Tencent EdgeOne**：`pnpm build:edgeone` 输出 `dist-edgeone` 和 `edge-functions/api/[[path]].js`。需配置服务端变量与 `/api/*` 限流；适配器尚未在真实 EdgeOne 账号完成生产验收，原生 TCP 需远程探针。

## 配置参考

| 变量                                                             | 用途                                       | 默认 / 条件                  |
| ---------------------------------------------------------------- | ------------------------------------------ | ---------------------------- |
| `IPINFO_TOKEN`                                                   | IPinfo 地理与网络数据                      | 可选，需匹配服务套餐         |
| `IPQS_KEY` / `ABUSEIPDB_KEY`                                     | 外部风险与滥用证据                         | 可选                         |
| `IPAPI_KEY`                                                      | ASN / Company 类型、代理特征和网段滥用比例 | 可选                         |
| `PROXYCHECK_KEY`                                                 | 自有 Proxycheck v3 账户的检测特征          | 可选，本地模型计算分数       |
| `PURITY_IPQUERY`                                                 | 无需密钥的 IPQuery 检测特征                | 默认启用；`off` 关闭         |
| `PURITY_PUBLIC_FEEDS`                                            | Tor / Feodo / Spamhaus / CINS 公共情报     | 默认启用；`off` 关闭         |
| `GEO_FREE_PROVIDER`                                              | ipwho.is 免费地理来源                      | 默认 `on`；`off` 关闭        |
| `DOH_URLS`                                                       | 逗号分隔的 HTTPS JSON DoH 地址             | 未配置时使用内置来源         |
| `ACTIVE_PROBES`                                                  | 主动探测开关                               | 默认 `on`；`off` 关闭        |
| `ALLOWED_PORTS`                                                  | TCP 端口允许列表                           | 默认值见 `.env.example`      |
| `PROBE_URL` / `PROBE_SECRET`                                     | 远程探针协调服务与认证                     | ICMP、全球节点、路由追踪需要 |
| `DNS_COLLECTOR_URL` / `DNS_COLLECTOR_SECRET` / `DNS_TEST_DOMAIN` | 权威 DNS 采集服务、认证与测试域名          | DNS 泄露 API 需要            |
| `SITE_URL` / `VITE_SITE_URL`                                     | 运行时地址 / 构建时规范链接与站点地图地址  | 更换域名时同步配置           |
| `DEV_PUBLIC_IP`                                                  | 显式开发测试 IP                            | 仅本地开发                   |

`.env`、`.env.local`、`.dev.vars` 已加入忽略规则；提交的环境文件仅包含公开配置。第三方服务失败时返回缺失或降级状态，实际额度与使用条款以各服务为准。

## 如何理解检测结果

**IP 纯净度分数越高，表示已观测证据越干净。** 本地模型按 ASN 15%、Company 20%、匿名网络 30%、近期滥用 25%、邻居风险 10% 计算，不使用供应商总分替代计算。完全无证据时返回 50 分中性基线及“证据不足”；低覆盖度、推断和来源冲突会在页面标注，分数不代表安全保证或统计概率。模型与来源详见 [纯净度说明](docs/ip-purity.md)。

**外部风险分数方向相反，越高表示风险证据越强。** 权重见 [risk.config.ts](src/config/risk.config.ts)。同一信号取各来源最大严重程度，不重复累计；完全没有证据时不生成分数。

纯净度结果最多缓存 15 分钟，有限评估或来源失败时最多 1 分钟，并受已检查来源最早失效时间限制。评分前过期证据转为未知；浏览器按动态周期刷新，同一 IP 刷新失败时保留旧结果并在一分钟内重试。尚有效的随代码前缀快照可用于来源不可用时的降级，过期快照不参与判断。

HTTP 探测向固定公网 IP 发送 `HEAD /`，不跟随重定向。合法 4xx / 5xx 也表示目标返回了 HTTP 响应，状态码会单独展示；没有测得的数据不会生成分阶段耗时。需要固定目标 IP 且保留域名 TLS servername 的 HTTPS 场景受运行时能力限制。

## 隐私与安全

应用默认不将访客 IP、查询历史、浏览器指纹或 WebRTC 候选写入应用日志或数据库；没有跟踪脚本。指纹在本地计算，主题偏好存储于 localStorage。地图数据随代码提供，不向地图服务发送 IP 或坐标。

数据会按所选功能发送到对应服务：

- 默认 **IPQuery** 会收到查询 IP；ipwho.is，以及配置后的 IPinfo、ipapi.is、Proxycheck、IPQualityScore、AbuseIPDB 等服务也会按需收到目标地址。
- Tor / Spamhaus / Feodo / CINS 公共名单下载后在边缘匹配，不向名单源发送查询 IP。
- DNS 查询发送给 DoH 服务；主动 WebRTC 检测联系公共 STUN。服务商与托管平台有各自的日志策略。

地理与 ASN 结果最多缓存 24 小时，风险结果最多 1 小时，DNS 按最小 TTL 缓存且最多 1 小时。缓存可能包含查询 IP，属于有界服务缓存。访客 IP 响应和主动探测不缓存；各纯净度来源有独立时效规则。

主动探测拒绝内网、回环、链路本地、特殊用途及云元数据地址，校验全部 A / AAAA 结果并固定连接目标，以降低 SSRF 与 DNS 重绑定风险。请求大小、并发与超时有限制。当前 Worker 绑定普通查询每 IP 每分钟 60 次、主动探测 10 次；限流作用于边缘节点，不能视为全球强一致配额。

远程探针与 DNS 采集服务的认证、目标校验和过期规则见 [部署协议](probe/README.md)。

## 开发与 GitHub 协作

技术栈：React 19、TypeScript、Vite、Tailwind CSS 4、Hono、Zod、TanStack Query、Recharts、Three.js、Vitest、Playwright。

```text
src/                  页面、组件、主题、本土化与浏览器检测
api/                  IP / ASN / DNS / 风险 / 纯净度 API
edge/                 共享安全逻辑与 Cloudflare / EdgeOne / 本地适配器
probe/                远程探针与 DNS 采集协议
scripts/              构建、SEO、OpenAPI、数据刷新与网络冒烟
tests/                单元、接口、安全与浏览器测试
docs/                 模型、地图、验证记录与 GitHub 维护说明
.github/              Issue 表单、PR 模板与 CI 工作流
```

[贡献指南](CONTRIBUTING.md) 说明分支选择与验证要求。新增界面文案保留英文源文案，在 `src/config/zh.ts` 补充中文；不翻译表单值、API 字段或指纹输入。

[GitHub CI](.github/workflows/ci.yml) 在 `master` / `beta` 推送及面向这两个分支的 PR 上执行规范检查、单元测试和两种环境构建。它只提供检查结果；线上自动发布由现有 Cloudflare Workers Builds 负责，CI 成功不代表已经发布。Issue 模板提交到默认分支后会出现在仓库反馈入口。

API 返回 `success/data/meta` 或 `success/error`；能力不可用可返回 `data.supported=false`。在线协议见 [Beta API 文档](https://ipbeta.f1shyu.com/developers) 与 [OpenAPI](https://ipbeta.f1shyu.com/openapi.json)。

历史验证及真实网络观测保存在 [验证记录](docs/verification.md)。第三方实时分数和网络耗时会变化；部署预检、模拟测试与真实服务验收分别记录。

## 常见问题

**正式站与测试站为什么功能不同？** GitHub 默认分支为 `master`，Beta 由 `beta` 独立部署。即使两条分支代码相同，构建进度、发布状态及运行时配置仍可能不同；请核对对应 Worker 的部署记录。

**推送后站点没有更新？** 核对目标分支、对应 Worker 的构建结果和提交 SHA。修改本地文件、打开 PR 或仅通过 GitHub CI 都不会证明线上版本已更新。

**为什么有些工具不显示或返回不支持？** 导航根据实际能力过滤。远程探针、权威 DNS 服务及部分风险来源需要额外配置；协议实现不等于服务已经部署。

**如何验证部署？** 查看 `/api/health` 与系统状态页，再检查 IP / DNS 查询。需要真实网络验收时，workerd 启动后运行 `pnpm test:smoke`；构建后可运行 `node scripts/purity-smoke.mjs` 验收默认纯净度来源。

## 许可证与来源

项目采用 [GNU AGPL v3](LICENSE)，条款以许可证正文为准。网站页脚提供公开源码入口，并保留 [whois.f1shyu.com](https://whois.f1shyu.com) 界面设计参考声明。地球数据来源与许可见 [地图数据说明](src/data/README.md)，纯净度快照来源见 [数据归属说明](api/purity/data/ATTRIBUTION.md)。
