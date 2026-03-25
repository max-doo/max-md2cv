# 小简-MD2CV简历工作台

[![GitHub release downloads](https://img.shields.io/github/downloads/max-doo/max-md2cv/latest/total?label=%E6%9C%80%E6%96%B0%E7%89%88%E4%B8%8B%E8%BD%BD%E9%87%8F)](https://github.com/max-doo/max-md2cv/releases/latest)
[![GitHub all releases](https://img.shields.io/github/downloads/max-doo/max-md2cv/total?label=%E7%B4%AF%E8%AE%A1%E4%B8%8B%E8%BD%BD%E9%87%8F)](https://github.com/max-doo/max-md2cv/releases)

Max-MD2CV（小简）是依托现代前端架构、Rust 桌面环境打造的纯本地桌面工具，作为轻量化、极速且极具设计感的**基于Markdown的简历编辑+PDF导出+管理工作台**，为求职者提供无缝的「所见即所得」简历编辑与排版体验。产品全程仅需编辑 Markdown 纯文本，无需耗费精力处理复杂排版调整；解决求职海投场景下，内容微调引发布局错位、简历副本杂乱、版本管理混乱的痛点，彻底消除格式焦虑，让求职者回归核心 —— 专注打磨自身真实经历与能力，而非钻研排版软件的使用技巧。

## ✨ 核心特性

### 📝 大道至简，让注意力回归内容
摒弃了预设固定填写模板，通过极其简单的 Markdown 文本标记，全程仅需编辑Markdown纯文本，无需耗费精力处理复杂排版调整；同时精准解决求职海投场景下，内容微调引发布局错位、简历副本杂乱、版本管理混乱的痛点，彻底消除格式焦虑，让求职者回归核心——专注打磨自身真实经历与能力，而非钻研排版软件的使用技巧，更无需被固化模板束缚。

### 👁️ 双屏互联，实时预览与自由编辑
左侧是文本编辑区，右侧是实时渲染的 A4 纸面预览区，所见即所得，还可在模板的基础上对风格进行自定义，支持字体大小、行距和页边距的调整，精准实现页数控制，消除你的排版焦虑。

### 📂 本地工作空间，从容管理海投版本
专为高频投递场景设计了本地“工作空间”面板。在这里，你可以像管理项目文件一样管理你的简历库。基于一份基础简历模板，你可以轻松复制、一键重命名，快速衍生出针对不同公司、不同岗位的专属版本。一岗一历，井然有序。

### 📄 告别错位，稳定的 PDF 导出交付
拒绝“排版变形”带来的挫败感。小简的导出功能致力于做到“屏幕上看到什么，导出的文件就是什么”。它能忠实地输出高保真、文本可复制的 PDF 文件，确保 HR 或面试官在打开简历的那一刻，看到的就是你精心打磨的最终形态。

### 🎨 模板臻选，内置三款精心设计样式
*   **🏆 商务专业 (Business)**：稳重蓝调主题，采用 `Material Symbols` 圆环图标装饰标题，Header 支持左右双栏布局，专为正式商务与大厂求职打造。
*   **🖋️ 传统经典 (Classic)**：衬线体美学，内容平铺居中对齐，舍弃图标干扰，极致简约黑白，适配学术、法律及严肃传统行业投递。
*   **⚡ 现代简约 (Modern)**：默认模板，采用小简标志性的优雅的紫色主题，通过侧边色块强调标题，搭配轻量化图标，在屏幕阅读与 A4 打印间取得完美平衡。

## 设计哲学

本项目的设计语言被称为 ：**柔和极简美学 (Soft Minimalist)**：
- **"No-Line" Rule (无边框法则)**：彻底摒弃 Web 时代遗留的 1px 机械边框界线，利用 `surface`, `surface-container-low` 等细腻的背景色带层级和悬浮卡片来划分空间。
- **Ambient Shadows (环境阴影)**：为卡片或互动元素引入带有主色调 (`#4c49cc`) 漫反射的宽大而柔和的阴影，创造更真实的数字物理空间。
- **Modern Typography (现代版式)**：引入 `Manrope` 几何无衬线字体，字间距略宽，兼具专业性与可读性。

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
