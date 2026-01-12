# IPCheck Modernization Design Spec

## 1. 概览
本项目经过全面重构，旨在提供现代化、响应式且高性能的 IP 查询体验。

## 2. 架构设计

### 2.1 模块化组件 (Atomic/Modular Design)
我们将 UI 拆分为独立的、可复用的模块，位于 `components/modules/`：
- **IpSearch**: 处理搜索输入和交互。
- **IpOverview**: 展示最核心的信息（国家、ISP 等），使用卡片式布局。
- **IpDetails**: 详细的信息列表，支持响应式网格布局。
- **IpNetwork**: 网络特定的技术参数（ASN、CIDR 等）。
- **IpLocationMap**: 地图可视化组件，懒加载以提升性能。

### 2.2 逻辑与视图分离 (Separation of Concerns)
- **Hooks**: 所有业务逻辑（数据获取、状态管理、时钟更新）被抽离至 `lib/hooks/use-ip-info.ts`。
- **View**: `app/page.tsx` 仅负责组装组件，不包含复杂逻辑。

## 3. UI/UX 设计系统

### 3.1 色彩体系 (OKLCH)
采用了现代的 OKLCH 色彩空间，支持更广的色域和更好的感知均匀性。
- **Primary**: Indigo/Violet 色系，传达科技感。
- **Background**: 即使在亮色模式下也使用了极淡的 Zinc 色系而非纯白，降低眼部疲劳。
- **Dark Mode**: 完整的暗黑模式支持，自动适配系统设置。

### 3.2 动效 (Framer Motion)
引入 `framer-motion` 实现平滑的微交互：
- **Entry**: 组件加载时带有交错的淡入上浮效果。
- **Feedback**: 按钮和卡片具有 hover 状态反馈。

### 3.3 响应式布局
- **Mobile First**: 默认针对移动端优化，单栏布局。
- **Desktop**: 在宽屏下自动切换为双栏或多栏网格布局。

## 4. 性能优化

### 4.1 代码分割
- 利用 Next.js App Router 的自动代码分割特性。
- 地图组件 (`IpMap`) 保持动态导入 (Dynamic Import)，避免阻塞首屏渲染。

### 4.2 渲染优化
- 使用 `useMemo` 缓存昂贵的计算（如坐标格式化）。
- 时钟更新逻辑独立在 Hook 中，避免导致整个页面组件树的不必要重渲染（仅更新相关状态）。

## 5. 兼容性
- **Browser**: 支持所有现代浏览器 (Chrome, Edge, Firefox, Safari)。
- **Device**: 适配 Mobile, Tablet, Desktop。

## 6. 后续迭代建议
- 添加 E2E 测试 (Playwright)。
- 集成更多 IP 数据库源。
