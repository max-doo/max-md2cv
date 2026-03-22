# Max-MD2CV 智能简历 (The Digital Curator)

Max-MD2CV 是一款基于现代前端架构和 Rust 桌面环境打造的轻巧、极速且极具设计感的 **Markdown 到 PDF 简历转换器**。

本作致力于为具有品味的求职者或创作者提供无缝的「所见即所得」简历编辑与排版体验。它完全消除了复杂多变的排版调整成本，一切只需关注 Markdown 纯文本。

## ✨ 核心特性与设计哲学

本项目的设计语言被称为 **The Digital Curator（数字策展人）**，属于 **柔和极简美学 (Soft Minimalist)**：
- **"No-Line" Rule (无边框法则)**：彻底摒弃 Web 时代遗留的 1px 机械边框界线，利用 `surface`, `surface-container-low` 等细腻的背景色带层级和悬浮卡片来划分空间。
- **Ambient Shadows (环境阴影)**：为卡片或互动元素引入带有主色调 (`#4c49cc`) 漫反射的宽大而柔和的阴影，创造更真实的数字物理空间。
- **Modern Typography (现代版式)**：引入 `Manrope` 几何无衬线字体，字间距略宽，兼具专业性与可读性。
- **工作空间管理**：文件 I/O 完全迁移至 Rust 后端，支持本地文件夹作为工作空间，具备自动记录上次打开文件、新建/删除简历等完整生命周期管理。
- **极致渲染引擎**：应用内不使用不可靠的系统打印插件，而是通过 Paged.js 进行浏览器的真实 A4 DOM 离线断页排版，并最终调动无头浏览器 (Headless Chrome/Edge) 导出拥有完美保真度和可编辑文本的 PDF 文件。

## 🛠️ 技术栈

*   **框架**：[Tauri v2](https://v2.tauri.app/) (为底层构建注入原生性能与极小的体积)
*   **前端**：[Vue 3](https://vuejs.org/) + [Vite](https://vite.dev/) + TS + Vite Auto Import
*   **状态管理**：Pinia
*   **核心功能组件**：
    *   **代码编辑器**：[CodeMirror 6](https://codemirror.net/) (带 Markdown 语法高亮)
    *   **转换器**：marked
    *   **PDF 排版预览**：[Paged.js](https://pagedjs.org/) (W3C 打印/排版规范 Polyfill)
*   **UI 与样式**：[Tailwind CSS v4](https://tailwindcss.com/docs/v4-beta) + [Element Plus](https://element-plus.org/)
*   **系统调用 (Rust)**：使用 Tauri 多插件体系 (`fs`, `dialog`, `persisted-scope`, `opener`) 确保文件系统安全访问。后台打印调用 `tokio` 异步执行 `std::process::Command`。

## 📂 项目结构

```text
max-md2cv/
├── src-tauri/             # Rust 后端与 Tauri 配置层
│   ├── src/               # Rust 源文件 (包含无头浏览器导出命令: lib.rs)
│   ├── tauri.conf.json    # Tauri 本地权限与窗口配置
│   └── Cargo.toml         # Rust 包管理配置
├── src/                   # Vue 3 前端代码层
│   ├── assets/            # Tailwind v4 样式映射与模板 CSS (`templates/`)
│   ├── components/        # 核心交互组件
│   │   ├── EditorPane.vue # CodeMirror 6 Markdown 编辑器
│   │   ├── PreviewPane.vue# Paged.js A4 打印预览容器
│   │   ├── Sidebar.vue    # 工作空间与文件浏览器侧边栏
│   │   └── TopNavBar.vue  # 样式控制与导出面板
│   ├── stores/            # Pinia 全局状态 (含工作空间逻辑: resume.ts)
│   ├── App.vue            # 根布局与工作空间初始化交互
│   ├── main.ts            # Vue 应用入口与环境初始化
│   └── vite-env.d.ts      # TypeScript 类型声明补丁
├── index.html             # 承载 Google Fonts (Manrope) 及 Material Symbols
├── package.json           # Node 依赖清单与脚本
├── vite.config.ts         # Vite 与自动按需注册组件 (unplugin) 配置
├── task.md                # (Dev) 迭代进度追踪与任务拆解
└── README.md              # 项目文档说明
```

## 🚀 启动指引

请确保您的系统已安装：[Node.js (>= 18)](https://nodejs.org/) 和 [Rust](https://www.rust-lang.org/tools/install)。

### 1. 安装前端依赖
```bash
npm install
```

### 2. 启动开发模式 (Tauri Dev)
这将会同时启动 Vite 热更替服务器，并利用 Cargo 编译 Rust 壳。
```bash
npm run tauri dev
```

### 3. 构建生产包
当应用开发完毕后，可执行打包命令生成对应平台的独立安装包：
```bash
npm run tauri build
```
*(构建出的文件将位于 `src-tauri/target/release/bundle`)*

## 🤝 协作与修改建议

由于我们在本项目中混用了 Tailwind CSS v4 与 Element Plus，如果要进行二次开发：
- 建议遵循 `src/assets/tailwind.css` 中的色彩变量 (如 `.bg-surface`, `text-on-surface-variant`)。
- 只有在极为复杂的交互组件（如 Dialog、Notification 弹出层）才应去调用 Element Plus 及其专属变量，以防破坏全局的 The Digital Curator 设计美感。
