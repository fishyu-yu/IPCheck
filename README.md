# IP CHECK

版本：`v0.2.0`  
最后修改日期：`2025-10-30`

## 项目概述

IP CHECK 是一个基于 Next.js 的轻量级 IP 信息查询与展示应用：
- 查询本机或指定 IP 的基础信息（国家/地区、城市、ISP、时区等）。
- 显示经纬度并在页面内渲染交互式地图（React-Leaflet + Leaflet）。
- 提供两类 API：归一化结构的 `/api/ip` 与 ipinfo 兼容结构的 `/api/ipinfo`。
- 统一浅色主题，已移除日/夜（Dark/Light）模式切换及相关逻辑。

主要特性：
- 顶部搜索框查询 IP，首次加载自动显示当前公网 IP。
- 模块化展示：基础信息、网络信息、位置详情、安全信息与移动信息。
- 本地时间随所处时区动态刷新（每秒）。
- 有坐标时在页面中呈现交互式地图；无坐标则显示提示。

## 技术栈
- Next.js 15（Turbopack）、React 19、TypeScript 5
- Tailwind CSS v4、shadcn 风格组件（`button`/`card`/`input`）
- React-Leaflet + Leaflet（地图渲染）、Lucide 图标库

## 安装指南

环境要求：
- Node.js `>= 18`（推荐 `>= 18.18`）
- npm `>= 10`

安装步骤：
```bash
git clone <repo-url>
cd iPCheck
npm install
```

## 使用说明

开发与构建：
- 开发模式：
  ```bash
  npm run dev
  # 访问 http://localhost:3000/
  ```
- 生产构建与启动：
  ```bash
  npm run build
  npm start
  # 默认端口 3000
  ```
- 代码检查：
  ```bash
  npm run lint
  ```

配置选项：
- 端口：生产启动时可通过环境变量或参数修改端口
  - Linux/macOS（bash）：
    ```bash
    PORT=4000 npm start
    ```
  - Windows（PowerShell）：
    ```powershell
    $env:PORT=4000; npm start
    ```
  - 或使用 CLI 参数（Next.js）：`next start -p 4000`
- 地图瓦片源：如遇网络/代理限制导致 OSM 瓦片加载失败，可在 `components/ui/ip-map-inner.tsx` 中替换 `TileLayer.url`，并遵守相应使用条款与速率限制。

API 说明：
- `GET /api/ip`
  - 返回归一化 IP 信息对象（`NormalizedIpInfo`，定义见 `lib/types.ts`）。
  - 示例：
    ```bash
    curl "http://localhost:3000/api/ip?ip=8.8.8.8"
    ```
- `GET /api/ipinfo`
  - 返回与 ipinfo.io 风格一致的精简 JSON（字段包含 `ip`、`city`、`region`、`country`、`loc`、`org`、`postal`、`timezone` 等）。
  - 示例：
    ```bash
    curl "http://localhost:3000/api/ipinfo?ip=8.8.8.8"
    ```

行为与细节：
- 保留/私有地址（如 `127.0.0.1`、`192.168.x.x`、`198.18.0.1`、`::1` 等）会优先尝试解析真实公网 IP；无法确定时返回提示。
- 中间件：当 `curl /` 访问根路径时，会重写到 `/api/ipinfo?omit_readme=true&pretty=true`，方便命令行查看。

## 贡献指南

欢迎参与贡献！建议流程如下：
- Fork 仓库并创建特性分支（示例：`feat/map-fallback`、`refactor/types-unify`）。
- 保持编码与样式风格一致（TypeScript、Tailwind v4、shadcn 组件）。
- 提交前请运行：
  ```bash
  npm run lint
  npm run build
  ```
- 通过 Pull Request 提交变更，清晰描述动机、方案与影响；必要时附上截图或日志。

## 许可证信息

本项目采用 AGPLv3（GNU Affero General Public License v3）许可证。这是一种强 Copyleft 许可证，尤其针对网络服务场景：
- 如果你修改并通过网络向用户提供本软件的运行服务（例如 Web 应用），你必须向这些用户提供你所运行版本的完整对应源代码。
- 任何衍生作品必须同样以 AGPLv3 许可发布。

详细条款见仓库根目录的 `LICENSE` 文件，官方说明：https://www.gnu.org/licenses/agpl-3.0.html

致谢：地图数据与瓦片由 OpenStreetMap 社区提供，使用前请阅读其使用条款与速率限制。

