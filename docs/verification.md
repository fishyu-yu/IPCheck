# 验证记录

最近验证日期：2026-10-01（Asia/Shanghai）。环境：Windows、Node.js 24.19.0、Chrome。

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
