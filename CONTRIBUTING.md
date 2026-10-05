# 参与 IPCheck / NetProbe

欢迎提交问题、功能建议和 Pull Request。反馈前请搜索已有 Issue，并写明站点、复现步骤和运行环境。

## 分支与本地开发

`master` 是 GitHub 默认分支和正式站点发布分支；`beta` 用于测试站点与新功能验证。新功能和一般修复建议从 `beta` 创建工作分支，PR 目标选择 `beta`。针对正式版的修复请在 PR 中说明原因，并选择相应目标分支。合并到发布分支会触发已有的 Cloudflare 自动部署。

使用 Node.js 24（见 [.node-version](.node-version)）与 pnpm 10：

```bash
git clone https://github.com/fishyu-yu/IPCheck.git
cd IPCheck
git switch beta
git switch -c your-change
pnpm install --frozen-lockfile
pnpm dev
```

本地地址为 `http://127.0.0.1:5173`。配置示例见 [.env.example](.env.example)；本地无法从回环请求获得访客公网 IP，可设置 `DEV_PUBLIC_IP` 使用明确标注的测试地址。

## 修改约定

- 界面品牌为 NetProbe，仓库名为 IPCheck。新增自有文案保留英文源文案，在 `src/config/zh.ts` 添加中文，并在显示边界使用现有本土化方法；API 字段、协议与用户输入保持原始含义。
- 检测结果保留数据来源、时效、未知项和冲突。缺失数据不当作安全结论，测试样例不用于声称真实服务可用。
- API 沿用 `success/data/meta` 或 `success/error` 返回结构。输入与能力变化同步更新校验、OpenAPI 和相关测试。
- 纯净度模型与数据源请先读 [docs/ip-purity.md](docs/ip-purity.md)；修改评分、缓存或前缀匹配时覆盖缺失、过期、冲突及 IPv4 / IPv6 场景。更新快照使用 `pnpm purity:update-data`，保留 [来源与许可](api/purity/data/ATTRIBUTION.md)。
- 地球定位请先读 [docs/globe.md](docs/globe.md) 和 [地图数据说明](src/data/README.md)。数据更新使用 `node scripts/build-globe-map.mjs`；保留坐标校验、WebGL 降级、资源释放和移动端布局。
- 只提交与当前修改有关的文件。日志、截图和示例请遮盖密钥及真实个人 IP；服务端密钥不使用 `VITE_` 前缀，也不写入仓库。

## 提交前验证

代码修改按目标分支运行现有检查：

```bash
pnpm build:ci:beta
# PR 目标为 master 时使用 pnpm build:ci
git diff --check
```

这会检查 ESLint、单元 / API 测试、TypeScript 和对应前端与边缘产物构建。需要单独定位问题时可运行 `pnpm lint`、`pnpm typecheck` 或 `pnpm test`。

根据修改范围补充验证：

| 修改范围                    | 验证方式                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 页面、交互或布局            | `pnpm test:e2e`，检查相关页面的桌面 / 手机、明暗主题和中英文；动态效果变更同时检查减少动态效果                   |
| Worker 入口或 beta 部署配置 | 构建后执行 `pnpm exec wrangler deploy --config wrangler.beta.jsonc --dry-run --outdir artifacts/cloudflare-beta` |
| 正式 Worker 部署配置        | 构建后执行 `pnpm check:cloudflare`                                                                               |
| 纯净度真实来源              | 构建后执行 `node scripts/purity-smoke.mjs`，注明观测时间和来源状态                                               |
| 其他真实网络调用            | 在 workerd 预览运行后执行 `pnpm test:smoke`，注明服务地址与运行环境                                              |
| 仅文档或 Issue / PR 模板    | 核对链接、配置与命令，并检查格式；无需运行应用测试                                                               |

浏览器测试默认使用本机 Chrome，并自动启动开发服务，详见 [playwright.config.ts](playwright.config.ts)。本地 Vite 适配器不支持原始 TCP socket；相关验证使用 workerd。部署预检使用 `--dry-run`，不会发布站点。

真实网络结果会随时间、来源与运行环境变化。在 PR 中报告实际执行的命令、结果和未覆盖项；需要保存详细记录时更新 [docs/verification.md](docs/verification.md)，不要把历史测试数量写成固定验收要求。

## 提交 Pull Request

说明问题、修改后的行为和验证结果；涉及配置、API 或数据源时写明影响与许可。界面修改附相关截图，样例位置或 IP 标注为示例数据。项目采用 [GNU AGPL v3](LICENSE)，提交的代码与资料应具备相容的使用许可。
