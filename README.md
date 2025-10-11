## iPCheck – 基于 Shadcn UI 的 IP 信息查询工具

一个使用 Next.js、Tailwind CSS v4 与 Shadcn UI 构建的 IP 信息查询页面，支持查询任意 IP，并默认显示访问者当前公网 IP 的信息。页面按模块清晰分栏展示基础信息、网络信息、位置详情、安全信息与移动信息，适配移动与桌面设备。

---

### 主要功能
- 顶部搜索框查询 IP，初次加载自动显示当前公网 IP。
- 信息分栏展示，字段无数据显示 `-`。
- 本地时间随时区动态更新（每秒刷新）。
- 城市坐标可点击打开地图（Google Maps）。
- 响应式设计，兼容手机/平板/桌面。

### 环境要求与依赖
- Node.js `>= 18`
- 包管理器：`npm`（或 `pnpm`/`yarn`/`bun`，示例以 `npm` 为主）
- 关键依赖：
  - `next@15.x`、`react@19.x`、`react-dom@19.x`
  - `tailwindcss@^4`、`@tailwindcss/postcss`
  - `lucide-react`、`class-variance-authority`、`tailwind-merge`
- UI 与样式：Shadcn UI、Tailwind CSS v4（配置见 `postcss.config.mjs` 与 `app/globals.css`）

### 安装与使用
1) 克隆并安装依赖
```bash
git clone https://github.com/<your-username>/ipcheck.git
cd ipcheck
npm install
```

2) 开发运行
```bash
npm run dev
# 本地访问
# http://localhost:3000/
```

3) 构建与启动
```bash
npm run build
npm run start
```

4) 页面使用
- 进入首页，顶部输入框可直接搜索 IP，如 `8.8.8.8`。
- 首次加载自动显示你的公网 IP 信息。
- 点击“城市坐标”可打开地图查看位置。

### API 说明
- 路由：`GET /api/ip` 支持 `ip` 查询参数：`/api/ip?ip=8.8.8.8`
- 保留/私有地址处理：当来源 IP 为保留网段（如 `127.0.0.1`、`192.168.x.x`、`198.18.0.1`、`::1` 等），服务会自动改用公网 IP 进行查询。
- 响应示例：
```json
{
  "ip": "8.8.8.8",
  "data": {
    "ip_address": "8.8.8.8",
    "country": "United States",
    "region": "California",
    "city": "Mountain View",
    "coordinates": { "lat": 37.4056, "lon": -122.0775 },
    "isp": "Google LLC",
    "time_zone": "America/Los_Angeles",
    "local_time": "2025-10-11T08:12:34-07:00",
    "domain": "google.com",
    "zip_code": "94043",
    "address_type": "IPv4",
    "asn": "AS15169",
    "as_domain": "Google LLC",
    "net_speed": null,
    "idd_code": null,
    "usage_type": null,
    "as_cidr": null,
    "as_usage_type": null,
    "district": null,
    "elevation": null,
    "weather_station": null,
    "fraud_score": null,
    "is_proxy": false,
    "proxy_type": null,
    "proxy_asn": null,
    "proxy_last_seen": null,
    "proxy_provider": null,
    "mobile_carrier": null,
    "mobile_country_code": null,
    "mobile_network_code": null
  }
}
```

#### 前端示例（获取并展示数据）
```ts
const res = await fetch('/api/ip?ip=8.8.8.8');
const json = await res.json();
console.log(json.ip, json.data.country, json.data.city);
```

### 截图说明
- 将截图放置在 `public/screenshots/` 目录下，并在下方通过相对路径引用：
```md
![首页截图](public/screenshots/home.png)
```
> 小贴士：部署到 GitHub Pages 或 Vercel 后，确保图片路径可直接访问。

### 贡献指南
- 提交流程：
  - Fork 仓库并创建分支（例如：`feat/search-toast`、`fix/reserved-range-fallback`）。
  - 开发完成后提交 PR，并在描述中清晰说明变更点与测试范围。
- 代码规范：
  - 使用 TypeScript，保持类型明确；避免不必要的 `any`。
  - 保持组件与样式风格一致（Shadcn UI 与 Tailwind v4）。
  - 运行 `npm run lint` 确认通过。
- 提交信息建议：
  - `feat: xxx` / `fix: xxx` / `docs: xxx` / `refactor: xxx`

### 常见问题（FAQ）
- 为什么有些字段显示 `-`？
  - 数据源未提供或该 IP 不适用（如移动信息、网络速度等）。
- 为什么出现 “Reserved range”？
  - 当来源 IP 为保留/私有地址时，后端会自动使用公网 IP 重试并返回有效数据。
- 坐标地图打不开怎么办？
  - 如无法访问 Google Maps，可将链接替换为高德/百度地图：
  - 示例：`https://amap.com/place?query=<lat>,<lon>` 或 `https://api.map.baidu.com/marker?location=<lat>,<lon>`。
- 如何部署到 Vercel？
  - 直接导入仓库，使用默认配置即可；构建命令 `next build`，启动命令 `next start`。

### 联系方式与支持
- 问题反馈：请通过 GitHub Issues 提交（`https://github.com/<your-username>/ipcheck/issues`）。
- 也可在 PR 中附上复现截图与步骤，便于快速定位。

### 许可证（License）
- 本项目使用 MIT 协议，详见 `LICENSE` 文件。

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
