## iPCheck – 基于 Shadcn UI 的 IP 信息查询工具

一个使用 Next.js、Tailwind CSS v4 与 Shadcn UI 构建的 IP 信息查询页面，支持查询任意 IP，并默认显示访问者当前公网 IP 的信息。

### 功能特性
- 顶部搜索框查询 IP；初次加载自动显示当前公网 IP。
- 分栏展示：基础信息、网络信息、位置详情、安全信息、移动信息。
- 缺失字段显示 `-`，时间基于时区动态刷新，城市坐标可点击打开地图。
- 响应式设计，适配手机/平板/桌面。

### 开发运行
```bash
npm run dev
```
访问 `http://localhost:3000/`。

### 技术栈
- Next.js App Router
- Tailwind CSS v4（`@tailwindcss/postcss`）
- Shadcn UI（`button`、`input`、`card`）

### API
- 后端路由：`/api/ip` 支持 `GET /api/ip?ip={addr}`，当请求来源为保留/私有地址时，自动回退到公网 IP 查询。
- 数据源：`ipwho.is`，并对未提供字段统一返回 `null`（前端显示 `-`）。

### 许可证（License）
本项目使用 MIT 协议，详见 `LICENSE` 文件。

### 上传到 GitHub（示例）
```bash
# 初始化仓库
git init
git add -A
git commit -m "init: iPCheck with MIT license"

# 设置主分支并关联远程（替换为你的仓库地址）
git branch -M main
git remote add origin https://github.com/<your-username>/ipcheck.git
git push -u origin main
```
