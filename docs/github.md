# GitHub 维护说明

## 已核对的仓库设置

2026-10-05 核对 [fishyu-yu/IPCheck](https://github.com/fishyu-yu/IPCheck) 的仓库元数据与设置页面：

| 项目                   | 当前值                                                 |
| ---------------------- | ------------------------------------------------------ |
| 可见性                 | Public                                                 |
| 默认分支               | `master`                                               |
| 现有分支               | `master`、`beta`                                       |
| About Website          | `https://ip.f1shyu.com`                                |
| About Description      | 空                                                     |
| Topics                 | 空                                                     |
| GitHub Pages           | 未启用；Source 为 Deploy from a branch，Branch 为 None |
| Issues / Pull requests | 已启用                                                 |
| Discussions            | 未启用                                                 |
| 许可证                 | AGPL-3.0                                               |

正式站与 Beta 站均可访问，分别展示正式版本与含纯净度入口的 Beta 版本。GitHub Pages 设置不是 Cloudflare 的域名绑定，也不是 Workers Builds 的配置入口。本项目需要边缘 API，单独启用 GitHub Pages 无法部署完整应用。参见 [GitHub Pages 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)。

## 仓库首页展示参考

保留现有 Website `https://ip.f1shyu.com`。About 可在仓库首页的编辑按钮中补充以下内容：

**Description**

> NetProbe：基于 Cloudflare Workers 的 IP、网络与浏览器隐私诊断工具，支持 IPv4/IPv6 查询、DNS、连通性检测与本地 IP 纯净度评估（Beta）。

**Topics**

```text
ip-checker ip-lookup network-diagnostics dns-lookup webrtc privacy
cloudflare-workers react typescript hono
```

以上为可用介绍文案；本次本地文件修改不代表云端 About 已保存。纯净度等新功能仍应标明 Beta，避免与默认分支的版本混淆。

## 协作配置

- `.github/ISSUE_TEMPLATE/` 提供问题反馈和功能建议表单；GitHub 从默认分支加载 Issue 模板，合入 `master` 后仓库入口才会使用它们。
- `.github/PULL_REQUEST_TEMPLATE.md` 提供变更、分支与验证说明。
- `CONTRIBUTING.md` 说明本地开发、分支选择与按改动范围进行验证。
- `.github/workflows/ci.yml` 在 `master` / `beta` 的 push、面向这两个分支的 pull_request 及手动运行时检查规范、单元/API 测试、正式与 Beta 构建。Node 版本读取 `.node-version`，pnpm 使用既有部署记录中的 `10.11.1`。

CI 使用只读仓库权限，不需要 Cloudflare 或供应商密钥，不执行发布。Actions 来源见 [checkout](https://github.com/actions/checkout)、[setup-node](https://github.com/actions/setup-node) 和 [pnpm/action-setup](https://github.com/pnpm/action-setup) 的官方仓库。

首次将工作流推送到 GitHub 后，应查看真实运行结果；本地命令通过只能验证任务内容，不能代替 GitHub 托管环境的实际运行。若之后将 CI 设置为分支必需检查，应使用实际生成的检查名称。

## 发布与分支

GitHub 默认分支保持 `master`。Beta 功能修改以 `beta` 为目标，正式发布通过审查后的变更进入 `master`。不要仅为更新默认首页说明就将 Beta 的全部功能合并到正式分支。

仓库中的 Cloudflare 配置和既有自动部署记录见 [README](../README.md#部署与自动更新) 与 [验证记录](verification.md)。推送这两个已连接分支可能触发对应 Worker 自动构建；核对 Cloudflare 构建日志的提交 SHA 与部署状态才能确认发布。

正式 Website 已使用 `ip.f1shyu.com`，但 `.env.production` / `wrangler.jsonc` 的站点地址仍是 Workers 默认域名。统一 SEO 规范链接时需要检查域名绑定，并同步修改 `VITE_SITE_URL` 和 `SITE_URL`；本次文档更新只记录该差异。
