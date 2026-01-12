# IP CHECK

版本：`v1.0.0`  
最后修改日期：`2026-01-13`

## 1. 项目简介

IP CHECK 是一个现代化、响应式的 IP 信息查询与分析工具，旨在为用户提供快速、准确且美观的 IP 洞察体验。

基于 **Next.js 15** 和 **Tailwind CSS v4** 构建，本项目不仅提供基础的 IP 地理位置查询，还集成了高级的 **IP 纯净度评估**、**智能 CDN 穿透**以及**实时经纬度监测**功能。

### 核心功能

*   **现代化 UI 设计**：采用磨砂玻璃（Glassmorphism）效果，支持 **深色/浅色模式 (Dark/Light Mode)** 自动切换与持久化。
*   **智能 IP 识别**：
    *   自动识别并优先展示用户真实 IP，穿透 CDN（Cloudflare, Aliyun, Tencent 等）代理头。
    *   自动过滤内网与保留 IP，智能兜底公网 IP。
*   **IP 纯净度评估**：
    *   集成 Cloudflare IP Intelligence 算法（模拟），提供 IP 风险评分（0-100）与安全等级评定。
    *   可视化进度条展示风险指数，帮助识别潜在的恶意 IP。
*   **精准定位**：
    *   移除传统地图组件，改为轻量级的**实时经纬度显示**。
    *   支持经纬度自动刷新（30秒倒计时）与手动触发。
*   **全面信息展示**：
    *   基础信息：国家、城市、ISP、时区（含本地时间实时时钟）。
    *   网络详情：ASN、CIDR、网络速度、使用类型等。
*   **高性能架构**：
    *   内置内存缓存机制（TTL 60s），大幅减少重复 API 调用。
    *   组件懒加载与代码分割，确保秒级首屏加载。

## 2. 技术栈

*   **框架**: [Next.js 15 (App Router)](https://nextjs.org/) + Turbopack
*   **语言**: TypeScript 5
*   **样式**: [Tailwind CSS v4](https://tailwindcss.com/) + `tailwindcss-animate`
*   **组件库**: Shadcn UI (Radix UI primitives)
*   **动画**: Framer Motion
*   **主题**: `next-themes` (Dark Mode support)
*   **测试**: Vitest + React Testing Library

## 3. 安装和使用指南

### 环境要求

*   Node.js `>= 18.18`
*   npm `>= 10` 或 pnpm/yarn

### 安装步骤

1.  克隆仓库：
    ```bash
    git clone https://github.com/your-username/ipcheck.git
    cd ipcheck
    ```

2.  安装依赖：
    ```bash
    npm install
    ```

### 运行开发环境

```bash
npm run dev
# 访问 http://localhost:3000
```

### 生产构建

```bash
npm run build
npm start
```

## 4. API 文档

本项目提供两个核心 API 端点：

### `GET /api/ip`
查询指定 IP 或当前请求 IP 的详细归一化信息。

*   **参数**: `ip` (可选，不传则自动识别客户端 IP)
*   **示例**: `curl "http://localhost:3000/api/ip?ip=1.1.1.1"`

### `GET /api/risk`
查询 IP 的风险评分与纯净度。

*   **参数**: `ip` (必填)
*   **示例**: `curl "http://localhost:3000/api/risk?ip=1.1.1.1"`

## 5. 贡献指南

我们非常欢迎社区贡献！请遵循以下步骤：

1.  Fork 本仓库。
2.  创建您的特性分支 (`git checkout -b feature/AmazingFeature`)。
3.  提交您的更改 (`git commit -m 'Add some AmazingFeature'`)。
    *   请确保运行 `npm run lint` 和 `npm run build` 检查代码质量。
    *   如果是逻辑变更，请运行 `npx vitest run` 确保通过单元测试。
4.  推送到分支 (`git push origin feature/AmazingFeature`)。
5.  开启一个 Pull Request。

## 6. 许可证声明

本项目基于 **MIT 许可证** 开源。详细信息请参阅 [LICENSE](LICENSE) 文件。

```text
MIT License
Copyright (c) 2026 FishYu
```

## 7. 维护者

*   **FishYu** - *Initial work & Maintenance*

---
*Built with ❤️ by FishYu*
