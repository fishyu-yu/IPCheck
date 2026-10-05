# 验证记录

最近验证日期：2026-10-05（Asia/Shanghai）。环境：Windows、Node.js 24.19.0、Chrome。

## 本次中文化与界面更新

| 检查                    | 结果                                           |
| ----------------------- | ---------------------------------------------- |
| `pnpm build:ci`         | 通过：ESLint、单元测试、严格类型检查与生产构建 |
| `pnpm test`             | 4 个测试文件，83 项全部通过                    |
| `pnpm test:e2e`         | 6 项全部通过                                   |
| `pnpm check:cloudflare` | 通过：Worker、静态资源和两个限流绑定已验证     |
| `git diff --check`      | 无空白错误                                     |

浏览器验证覆盖全部 19 个页面、中英文选择、中文错误提示、页面标题和无障碍标签。中文首选语言显示简体中文；日语首选语言正确回退英文。验证了明暗主题、390px 移动端导航和无页面横向溢出。

浏览器指纹生成 64 字符 SHA-256，原有测试确认计算过程没有额外网络请求；延迟工具执行 10 次真实本地请求。未配置的服务保持明确的不可用状态，所有页面无未捕获运行时异常。桌面明暗主题和移动端截图位于未跟踪的 `artifacts/`。

## 既有真实网络验证

2026-09-25 曾在本地 Cloudflare workerd 下执行网络冒烟验证：

- ipwho.is 对显式测试地址 `8.8.8.8` 返回地理与 Google / AS15169 信息。
- RIPEstat 对 AS13335 返回组织、ARIN 和实际公告前缀。
- DoH 返回 `example.com` 的 A 记录以及 `8.8.8.8` 的 PTR 记录。
- TCP 连接 `1.1.1.1:443` 成功，返回实际建连耗时。
- 固定 IP 的 HTTP HEAD 请求 `1.1.1.1:80` 返回真实 301，未跟随重定向。
- 本地开发适配器正确报告不支持 TCP，并执行了实际 HTTP HEAD。

这些是当时的观测，不是固定服务保证；本地耗时不代表生产边缘延迟。EdgeOne 专用构建也曾通过本地验证。

## 发布与外部服务边界

Cloudflare Worker 已发布到 [线上站点](https://netprobe.yangzhan-ms.workers.dev)，Git 自动部署已通过实际推送验证。部署预检、手动发布与自动构建分别验证，不能相互替代。

未提供付费风险数据源密钥、真实 ICMP / 路由追踪节点或权威 DNS 采集服务器。相关调用协议、数据校验与降级界面已实现，第三方归一化使用独立测试样例验证，不能将这些测试等同于真实服务验收。EdgeOne 适配器未在真实账号完成生产验证。

## 本次发布记录

2026-10-01 已将中文界面、UI 与文档提交 `324ab05` 同步到 GitHub `master`，远程 Git 对象 SHA 与本地一致。Cloudflare 手动发布成功，版本为 `f89c9fe1-7e0e-4b8b-92d7-6814673388cd`。

随后已在 Cloudflare 控制台连接 `fishyu-yu/IPCheck` 的 `master`，构建命令 `pnpm run build:ci`，部署命令 `npx wrangler deploy`，根目录 `/`，关闭非生产分支预览。

推送 `297ea7a` 后自动触发构建 `5a3427df-cc02-4f00-ae6e-eb627a89edca`，初始化、克隆、依赖安装、构建和部署均成功，总耗时 1 分 9 秒；构建环境为 Node.js 24.21.0 / pnpm 10.11.1。对应部署版本 `f3132915-c438-4167-b641-5d2a83989987` 已接收 100% 生产流量。成功截图保存在本地 `artifacts/cloudflare-auto-deploy.jpg`。可在 [GitHub 构建检查](https://github.com/fishyu-yu/IPCheck/runs/110077162087) 或 Cloudflare 控制台核对。

维护者的云端许可证提交 `bbb8961` 已合并保留；README 按当前 LICENSE 更新为 GNU AGPL v3，网站页脚提供源码入口。

## beta 分支部署配置

2026-10-01 新建独立 Worker `netprobe-beta`，绑定 [测试站点](https://ipbeta.f1shyu.com)。Cloudflare Workers Builds 已连接 `fishyu-yu/IPCheck`，该 Worker 的生产分支为 `beta`，根目录 `/`，构建命令 `pnpm run build:ci:beta`，部署命令 `npx wrangler deploy --config wrangler.beta.jsonc`，关闭非生产分支预览。

部署配置提交为 `405b949`。本地 beta CI 通过 ESLint、83 项测试、TypeScript 与生产构建；Wrangler beta 部署预检通过。首次手动发布版本为 `7354614f-0f37-4ce5-b6c6-bc94e50bcdc2`。自定义域名 HTTPS 主页和 `/api/health` 均返回 200，健康状态为 `operational`，主页规范链接指向测试域名。

后续推送由 Cloudflare 自动构建，验收时应核对构建记录中的 `beta` 提交 SHA 和成功部署状态。beta 前端及 SEO 使用 `.env.beta`，运行时与路由使用 `wrangler.beta.jsonc`，限流命名空间为 `2001` / `2002`。

## 2026-10-04 IP 纯净度

本地实现独立纯净度接口、五因素模型、常驻入口和 IPv4 / IPv6 降级结果；详情见 [模型说明](ip-purity.md)。验证结果：

- 全部 152 项单元/API 测试通过，包括评分单调性、强风险封顶、无配置兜底、网段匹配、陈旧情报拒绝、IPv6 覆盖、配置隔离、并发合并与缓存刷新保护。
- 浏览器套件共 21 项：首次 20 项通过，发现中文 IP 查询出现重复错误 alert 后修复；复跑本土化与纯净度相关 10 项全部通过。检查桌面与手机截图，320–1440 px 无横向溢出。
- 完整 ESLint、TypeScript、beta 前端构建、Worker / EdgeOne / OpenAPI 产物生成和 Cloudflare beta 部署预检通过；预检使用 `--dry-run`，没有发布。
- 真实网络调用已构建的 EdgeOne API：`8.8.8.8` 与 `2606:4700:4700::1111` 均返回 HTTP 200、有限分数、五项评分、覆盖度及明确限制。前者 60 分／覆盖 20%，后者 53 分／覆盖 6%，均为“证据不足”，没有把少量名单阴性判为高纯净度。
- Spamhaus IPv4 / IPv6 与 Tor 查询成功。Feodo 推荐列表返回 2026-06-30 的修改时间，程序拒绝其陈旧快照；IPv4 使用更新的 CINS 当前名单，准确计数 `/24` 中的其他地址。CINS / Tor 的 IPv6 不覆盖状态保持未知。

真实网络结果保存在本地 `artifacts/purity-live-smoke.jsonl`，桌面及手机截图为 `artifacts/purity-desktop.png` / `artifacts/purity-mobile.png`。这些是当时的观测，不能保证未来数据源可用；未使用真实付费密钥验收，也未执行上线发布。

## 2026-10-04 本地纯净度 v2

- 全部 228 项单元/API 测试通过，包括默认 IPQuery、可选 Proxycheck、完整/缺失/错误字段、IPv6 规范化、并发合并、供应商独立冷却、本地前缀快照完整性与时效、正向名单语义、邻居索引、证据强度、风险封顶和 API 生产协议。
- 全部 27 项浏览器测试通过，覆盖中文、查询切换、无 IP / pending / failure、逐项证据与冲突、有限结果每分钟刷新、完整结果每 15 分钟刷新、旧结果兼容以及 320–1440 px 布局。手工提交的纯净度查询也使用相同的 Query 缓存。
- TypeScript、全仓 ESLint、beta Vite 构建、Cloudflare / EdgeOne / OpenAPI 产物生成和 beta Wrangler `--dry-run` 全通过。Worker 包 925.80 KiB，gzip 170.86 KiB。
- 真实默认无密钥验收使用已构建的 EdgeOne API：`8.8.8.8` 返回 65 分 / 覆盖 40%，IPv6 `2606:4700:4700::1111` 返回 65 分 / 覆盖 36%，Google Cloud `35.190.0.1` 返回 62 分 / 覆盖 60%，VPN 前缀 `2.56.16.1` 返回 55 分 / 覆盖 50%。全部 HTTP 200、完整五因素、逐来源信号、区间和建议；冷查询约 3.9 秒，后续约 0.2–0.3 秒。结果是当时的观测，不是固定期望分数。
- IPQuery 双栈检测有效，供应商 `risk_score` 不参与计算；Feodo 陈旧快照被拒绝，IPv4 使用 CINS，IPv6 不覆盖保持明确未知。Google Cloud 官方前缀识别 Company hosting；VPN 名单仅提供推断线索，独立供应商结果均保留。
- VPN / Cloud 全量快照保留许可与哈希、预编译查询索引。独立重建原始 CIDR 区间，与预编译数据逐一一致；冷与实时刷新路径避免逐行解析上万条 IPv4 CIDR。

真实结果记录位于本地 `artifacts/purity-v2-live-smoke.jsonl`。可选付费密钥只通过模拟供应商契约验证，未创建账户或消耗付费额度。

## 2026-10-05 发布前严格验收

- 最终全套 254 项单元/API 测试、32 项浏览器测试全部通过；全仓 ESLint、TypeScript 和 `git diff --check` 通过。
- 独立审核发现并修复新增弱正向 VPN / proxy 或 abuse 信号反而提高分数的反例。新增 1,944 个布尔组合和 500 个固定种子的混合输入验证风险单调性、来源顺序无关性及有限分数范围；冲突阴性不再获得清洁加分。
- 整体评估缓存和浏览器刷新受最早有效来源的 `expiresAt` 限制；评分前检查期限，慢请求期间过期的分类、信号与邻居证据恢复未知，混合邻居的其他独立来源继续有效。API 回归覆盖毫秒边界、无效期限、过期重算和输入不变。
- 浏览器验证手工 IPv6 查询自动刷新、离开 pending 查询后迟到响应隔离、后台失败保留同 IP 结果并恢复、短来源期限刷新。过期证据刷新失败后固定一分钟重试，验证 30 秒内没有额外请求、一分钟后恢复，避免每秒重试触发限流。
- 离线快照测试独立检查 10,939 条 VPN 和 1,107 条 Google Cloud 原始 CIDR，全部 24,092 个首末端点正确匹配；损坏哈希、索引、来源、未来时间、准确过期边界与刷新失败回退均通过。
- beta 与 master 前端构建、Cloudflare / EdgeOne / OpenAPI 产物、各自 Wrangler `--dry-run` 均通过。Worker 为 928.36 KiB，gzip 171.40 KiB；各自域名、限流绑定和 `/risk` 的 IP Purity 标题及 canonical 链接正确。

本节记录推送前本地验收。自动部署与在线 API 需按对应 Git 提交核对 GitHub Cloudflare 构建检查；实际网络数据会随情报来源更新，不能使用固定分数代替在线协议验收。
