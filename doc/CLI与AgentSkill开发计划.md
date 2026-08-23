# Max-MD2CV CLI 与 Agent Skill 开发计划

## 1. 文档目的

本文档用于直接指导 Agent 在现有 Max-MD2CV 仓库中开发一个可独立安装、开箱可用的 Markdown 简历渲染 CLI，并同步交付一个配套 Agent Skill。

交付目标：

- 用户可以在终端中将 Markdown 简历导出为 PDF 和逐页 PNG。
- 用户可以选择模板，并调整字体、主题色、字号、行高、段间距、标题间距和页边距等模板参数。
- 默认将产物输出到命令执行时的当前工作目录，也可以分别指定 PDF 文件路径和图片目录。
- CLI 可以通过稳定的 JSON 输出被 Agent、脚本和 CI 调用。
- Agent Skill 能指导 Agent 完成“查询模板 -> 渲染 -> 查看所有页面截图 -> 调整参数 -> 再次渲染 -> 交付 PDF”的闭环。
- CLI 安装后不依赖 Tauri 桌面应用运行，不要求用户先启动桌面界面。
- CLI 与桌面端复用同一套 Markdown、模板、样式和 Paged.js 分页逻辑，不维护第二套简历排版实现。

本文档不是概念提案。除非实施过程中发现与仓库现状冲突的事实，否则 Agent 应按本文档定义的阶段、接口、测试和验收门槛推进。

## 2. 已确认的技术决策

### 2.1 产品形态

首期只开发 CLI 和 Agent Skill，不开发 MCP Server。

CLI 是能力实现和机器接口，Skill 是 Agent 使用工作流。Skill 不得替代 CLI 的 `--help`、运行时校验、模板 schema 和 JSON 输出。

### 2.2 CLI 技术栈

- CLI 使用 TypeScript 和 Node.js 实现。
- CLI npm 包名使用 `@max-md2cv/cli`。
- CLI 可执行命令使用 `md2cv`。
- 使用 npm workspaces 接入现有 monorepo。
- 使用 `playwright-core` 控制用户机器上的 Edge、Chrome 或 Chromium。
- 不默认下载或捆绑额外浏览器。
- Windows 首选 Microsoft Edge，随后尝试 Google Chrome 和 Chromium。
- 允许用户通过参数或环境变量指定浏览器可执行文件。
- PDF 继续由 Chromium 打印能力生成；Playwright 只负责浏览器控制、等待分页完成、输出 PDF 和逐页截图，不引入新的排版引擎。

选择 `playwright-core` 的原因：

- CLI 没有 Tauri WebView，需要一个浏览器环境运行 Paged.js。
- 必须可靠等待字体、图片和 Paged.js 异步分页完成。
- 必须对每一个 `.pagedjs_page` 单独截图。
- 必须获得浏览器 console、页面错误和资源加载失败信息。
- 直接使用 `chrome --print-to-pdf` 无法可靠表达“等待 Paged.js 完成后再打印”的条件。

Playwright 不得进入共享领域层。浏览器控制必须封装在 CLI 的 automation 层，使未来替换为直接 CDP 时不影响 CLI 命令和配置契约。

### 2.3 浏览器支持范围

首个正式版本的发布硬门槛是 Windows 10/11，原因是系统通常自带 Edge，能够满足“安装 CLI 后直接使用”的目标。

macOS 和 Linux 同时实现浏览器发现逻辑并进入 CI smoke test，但允许要求用户预先安装 Chrome、Edge 或 Chromium。如果未找到浏览器，CLI 必须给出可操作的诊断信息，不得只返回底层 spawn 错误。

浏览器选择优先级：

1. `--browser-path <path>`。
2. `MD2CV_BROWSER_PATH` 环境变量。
3. `--browser edge|chrome|chromium` 指定的 channel。
4. `auto` 模式下依次发现 Edge、Chrome、Chromium。

不得复用、覆盖或修改通用系统环境变量。

### 2.4 输出默认值

假设当前命令为：

```powershell
cd D:\Job\Application
md2cv render .\resume.md
```

默认输出：

```text
D:\Job\Application\resume.pdf
D:\Job\Application\resume.page-1.png
D:\Job\Application\resume.page-2.png
```

所有命令行相对路径都相对于 `process.cwd()` 解析。

默认同时生成 PDF 和逐页 PNG。用户可以通过 `--no-pdf` 或 `--no-images` 关闭其中一种输出，但不能同时关闭两者。

### 2.5 预览、PDF 和图片的一致性

一次 `render` 调用只能执行一次 Paged.js 分页。PDF、逐页 PNG 和布局报告必须基于同一份分页 DOM 产生，禁止为了不同产物分别渲染 Markdown。

首期 PNG 直接截取分页完成后的 `.pagedjs_page`，并强制使用 print media、白色页面背景、无阴影和固定 device scale factor。

首期不要求把 PDF 再反向栅格化为 PNG。后续如果需要像素级验证，可以增加 `imageSource: "pdf"`，但不得阻塞首个 CLI 版本交付。

## 3. 非目标

首期不做以下内容：

- MCP Server。
- 远程渲染服务或云端 API。
- 图形化 CLI 配置界面。
- 自动改写或润色简历内容。
- 自动把任意简历强行压缩到一页。
- PDF 转图片的第二套栅格化链路。
- 在线模板市场。
- 任意模板脚本执行。
- Safari、Firefox 或 WebKit PDF 导出。
- 将 Tauri 文件系统命令复用为 CLI 文件系统层。

## 4. 当前代码基线

当前桌面导出链路如下：

```text
Markdown
  -> marked
  -> resumeParser 语义增强
  -> PreviewPane.vue 中的 Paged.js Previewer
  -> .pagedjs_pages
  -> buildPagedExportDocumentHtml
  -> Tauri export_pdf_command
  -> Edge/Chrome --print-to-pdf
```

关键现状：

- `src/components/PreviewPane.vue` 同时承担预览 UI、渲染请求组装、语义 DOM 生成、布局 hook、字体等待和 Paged.js 调用，不能被 Node CLI 直接复用。
- `src/utils/pagedExport.ts` 从已经完成的桌面预览 DOM 克隆分页页面，因此它不能直接从 Markdown 开始工作。
- `src-tauri/src/export.rs` 只负责发现浏览器和打印已经准备好的 HTML，不负责 Markdown 或 Paged.js 分页。
- `packages/resume-core` 已经包含模板、schema、Markdown 和样式归一化能力，是 CLI 复用的基础。
- `src/utils/markdownRender.ts` 与 `packages/resume-core/src/utils/markdownRender.ts`、`src/utils/resumeParser.ts` 与共享包版本存在重复，应在本项目中逐步收口。
- 内置模板位于 `packages/resume-core/src/assets/templates`，CLI 打包时必须把模板目录作为运行时资产带入 npm 包。

## 5. 目标架构

### 5.1 目录结构

计划完成后的核心目录：

```text
max-md2cv/
  apps/
    web/
    cli/
      package.json
      tsconfig.json
      vite.renderer.config.ts
      src/
        cli.ts
        commands/
          render.ts
          validate.ts
          templates.ts
          doctor.ts
        config/
          schema.ts
          load-config.ts
          merge-options.ts
        node/
          browser.ts
          browser-discovery.ts
          template-loader.ts
          output-paths.ts
          artifact-writer.ts
          render-service.ts
          errors.ts
          json-output.ts
        renderer-host/
          index.html
          main.ts
          globals.d.ts
      scripts/
        copy-runtime-assets.mjs
      tests/
        unit/
        integration/
        e2e/
        fixtures/
        golden/
  packages/
    resume-core/
      src/
        domain.ts
        index.ts
    resume-renderer/
      package.json
      src/
        index.ts
        types.ts
        render-resume.ts
        layout-hooks.ts
        asset-resolution.ts
        diagnostics.ts
        print-styles.ts
  skills/
    md2cv/
      SKILL.md
      agents/
        openai.yaml
      references/
        layout-tuning.md
        troubleshooting.md
```

目录名允许在实施时小幅调整，但职责边界不得改变。

### 5.2 分层职责

#### `packages/resume-core`

负责：

- 模板类型和模板参数 schema。
- 模板值归一化和范围校验。
- Markdown 转 HTML。
- 手动分页标记。
- 简历语义结构增强。
- 内置模板领域模型。

不得负责：

- Node 文件系统。
- CLI 参数。
- 浏览器启动。
- 输出路径。
- PDF 和 PNG 写入。

新增 `src/domain.ts`，只导出 Node 和浏览器都能安全使用的纯领域能力。它不得导出带有 Vite `?raw` 资源导入的模板 loader，也不得在模块加载时访问 `window` 或 `document`。

#### `packages/resume-renderer`

负责：

- 接收已经加载完整的 `ResumeTemplate` 和标准化后的 values。
- 生成 `.resume-document`。
- 应用照片、header layout 和 section title 等稳定布局 hook。
- 等待字体和图片加载。
- 调用 Paged.js 生成 `.pagedjs_pages`。
- 收集页数、overflow、空白页、字体和资源警告。
- 暴露稳定的浏览器端 `renderResume()` API。

该包运行在真实浏览器 DOM 中，不要求在纯 Node 环境执行。

#### `apps/cli/src/renderer-host`

负责提供一个没有 Vue UI 的最小 HTML 页面：

- 页面只包含分页渲染挂载点。
- 页面通过 Vite 打包 `resume-renderer` 和 Paged.js。
- 页面向 `window` 暴露单一 API，例如 `window.md2cvRenderer.render(request)`。
- 页面不得读取 CLI 参数、文件路径或 Node 环境变量。
- 页面不得包含桌面编辑器、Pinia、Element Plus 或 Tauri 依赖。

#### `apps/cli/src/node`

负责：

- 解析和验证输入路径。
- 加载配置和模板包。
- 解析模板参数覆盖。
- 启动 renderer host 和系统 Chromium 浏览器。
- 将请求传入 renderer host。
- 等待 renderer 返回完成状态。
- 输出 PDF、逐页 PNG 和 JSON 结果。
- 清理临时目录、浏览器和本地服务。

#### `apps/cli/src/commands`

负责 CLI 用户接口，不得直接写浏览器或 Paged.js 逻辑。

### 5.3 核心调用流程

```text
CLI 参数
  -> 路径解析
  -> 配置文件读取
  -> 模板加载与 schema 校验
  -> 生成 RenderRequest
  -> 启动 browser + renderer host
  -> renderResume()
  -> Paged.js 完成一次分页
  -> 收集 RenderDiagnostics
  -> page.pdf()
  -> locator('.pagedjs_page').screenshot()
  -> 写入产物
  -> 输出 RenderCommandResult JSON
```

## 6. 数据契约

所有公开配置和 JSON 输出都必须有 TypeScript 类型、运行时 schema 和契约测试。禁止仅依赖 TypeScript 编译期类型。

### 6.1 配置文件

建议配置文件名：

```text
resume.render.json
```

配置版本 1：

```ts
interface Md2cvConfigV1 {
  version: 1
  template: string
  values?: Record<string, string | number | boolean>
  photoPath?: string
  outputs?: {
    pdf?: boolean
    images?: boolean
    imageScale?: number
  }
  render?: {
    maxPages?: number
    strictFonts?: boolean
    allowNetwork?: boolean
    timeoutMs?: number
  }
}
```

示例：

```json
{
  "version": 1,
  "template": "modern",
  "values": {
    "themeColor": "#2563eb",
    "fontSize": 13,
    "lineHeight": 1.4,
    "paragraphSpacing": 6,
    "h2MarginTop": 10,
    "h2MarginBottom": 5,
    "marginV": 9,
    "marginH": 12
  },
  "outputs": {
    "pdf": true,
    "images": true,
    "imageScale": 2
  },
  "render": {
    "maxPages": 2,
    "strictFonts": false,
    "allowNetwork": false,
    "timeoutMs": 30000
  }
}
```

配置规则：

- `version` 必填，首期只接受 `1`。
- `template` 必填，除非命令行提供 `--template`。
- `values` 必须经过当前模板的 `editorSchema` 校验和 clamp。
- 未知 value key 默认报错，不能静默丢弃拼写错误；只有显式 `--allow-unknown-values` 才可降级为 warning，首期可以不提供该选项。
- `photoPath` 相对于配置文件所在目录解析。
- 配置文件不保存 PDF 和图片的具体输出路径；具体路径由 CLI 参数决定，避免相对路径基准混乱。
- CLI 参数优先于配置文件，配置文件优先于模板默认值。
- 多个 `--set key=value` 按命令行出现顺序覆盖。

### 6.2 浏览器渲染请求

```ts
interface RenderRequest {
  markdown: string
  documentTitle: string
  template: ResumeTemplate
  values: TemplateValues
  photoDataUrl: string | null
  sourceDirectory: string | null
  options: {
    maxPages?: number
    strictFonts: boolean
    allowNetwork: boolean
  }
}
```

必须传递完整模板对象和已经标准化的 values。浏览器端不得自行访问应用数据目录或猜测模板来源。

### 6.3 浏览器渲染结果

```ts
interface RenderResult {
  pageCount: number
  effectiveValues: TemplateValues
  pages: Array<{
    page: number
    widthPx: number
    heightPx: number
    contentWidthPx: number
    contentHeightPx: number
  }>
  warnings: RenderWarning[]
  fontReport: Array<{
    requested: string
    loaded: boolean
  }>
}
```

首期至少实现以下 warning code：

- `FONT_NOT_LOADED`
- `RESOURCE_LOAD_FAILED`
- `PAGE_OVERFLOW`
- `EMPTY_PAGE`
- `PAGE_COUNT_EXCEEDED`

后续可增加 `HEADING_ORPHAN` 和 `LIST_ITEM_SPLIT`，但不得以此阻塞首期。

### 6.4 CLI JSON 成功输出

```json
{
  "ok": true,
  "cliVersion": "0.1.0",
  "input": "D:\\Job\\resume.md",
  "cwd": "D:\\Job",
  "template": {
    "id": "modern",
    "name": "现代简约",
    "version": "1.0.0"
  },
  "pageCount": 2,
  "effectiveValues": {},
  "artifacts": {
    "pdf": {
      "path": "D:\\Job\\resume.pdf",
      "bytes": 125000,
      "sha256": "..."
    },
    "images": [
      {
        "page": 1,
        "path": "D:\\Job\\resume.page-1.png",
        "width": 1588,
        "height": 2246,
        "bytes": 220000,
        "sha256": "..."
      }
    ]
  },
  "warnings": [],
  "timingsMs": {
    "total": 1800,
    "browserStart": 350,
    "render": 900,
    "pdf": 250,
    "images": 300
  },
  "runtime": {
    "browser": "Microsoft Edge",
    "browserVersion": "...",
    "platform": "win32"
  }
}
```

规则：

- JSON 中所有文件路径必须是绝对路径。
- 不得返回 Markdown 正文，避免意外把隐私内容写入日志。
- `artifacts.pdf` 在 `--no-pdf` 时为 `null`。
- `artifacts.images` 在 `--no-images` 时为空数组。
- JSON 模式 stdout 只能输出一个 JSON 对象；日志、进度和调试信息全部写入 stderr。

### 6.5 CLI JSON 错误输出

```json
{
  "ok": false,
  "error": {
    "code": "BROWSER_NOT_FOUND",
    "message": "未找到可用的 Edge、Chrome 或 Chromium。",
    "details": {
      "attempted": ["msedge", "chrome", "chromium"]
    },
    "suggestions": [
      "运行 md2cv doctor --json 查看环境诊断。",
      "使用 --browser-path 指定浏览器可执行文件。"
    ]
  }
}
```

稳定错误码：

- `INVALID_ARGUMENT`
- `INPUT_NOT_FOUND`
- `INPUT_READ_FAILED`
- `INVALID_CONFIG`
- `TEMPLATE_NOT_FOUND`
- `TEMPLATE_VALUE_INVALID`
- `PHOTO_NOT_FOUND`
- `OUTPUT_EXISTS`
- `OUTPUT_NOT_WRITABLE`
- `BROWSER_NOT_FOUND`
- `BROWSER_LAUNCH_FAILED`
- `RENDER_TIMEOUT`
- `RENDER_FAILED`
- `PDF_EXPORT_FAILED`
- `SCREENSHOT_EXPORT_FAILED`
- `INTERNAL_ERROR`

退出码：

- `0`：成功。
- `2`：命令或参数错误。
- `3`：输入、配置或模板校验失败。
- `4`：环境或浏览器不可用。
- `5`：渲染、PDF 或截图失败。
- `6`：文件系统和输出失败。
- `1`：未分类内部错误；正式版应尽量避免落入该类别。

## 7. CLI 功能设计

### 7.1 `md2cv render`

命令：

```powershell
md2cv render <input.md> [options]
```

或：

```powershell
Get-Content .\resume.md -Raw | md2cv render --stdin --name resume
```

必须支持：

- Markdown 文件输入。
- stdin 输入。
- 内置模板选择。
- JSON 配置文件。
- 多个 `--set key=value` 覆盖。
- 照片文件。
- 默认输出 PDF 和逐页 PNG。
- 指定统一输出目录。
- 分别指定 PDF 路径和图片目录。
- 关闭 PDF 或图片。
- 设置图片缩放比例。
- 设置期望最大页数。
- 指定浏览器 channel 或可执行路径。
- JSON 结果输出。
- 覆盖保护和 `--force`。

建议 options：

```text
--stdin
--name <name>
--template <id>
--config <path>
--set <key=value>              可重复
--photo <path>
--output-dir <dir>
--pdf <path>
--images-dir <dir>
--no-pdf
--no-images
--image-scale <number>         默认 2，范围 1-3
--max-pages <number>
--strict-fonts
--allow-network
--browser <auto|edge|chrome|chromium>
--browser-path <path>
--timeout <ms>
--force
--json
```

路径规则：

- 未指定 `--output-dir`、`--pdf` 和 `--images-dir` 时，所有产物输出到 cwd。
- 指定 `--output-dir` 后，未单独指定的 PDF 和图片都进入该目录。
- `--pdf` 必须是文件路径；扩展名不是 `.pdf` 时直接报错。
- `--images-dir` 必须是目录路径。
- `--pdf` 和 `--images-dir` 分别覆盖 `--output-dir` 对应产物的位置。
- 输入文件名 `resume.md` 默认产生 `resume.pdf` 和 `resume.page-N.png`。
- stdin 必须提供 `--name`，或者使用默认名 `resume`；建议要求显式 `--name` 以避免批处理覆盖。
- 文件名必须清理 Windows 非法字符，但不得改变用户显式给出的合法 Unicode 文件名。
- PDF 和任一 PNG 已存在时，默认整体失败，避免产生一半新一半旧的产物。
- `--force` 时先完成全部临时产物，再以原子替换方式覆盖目标，避免失败后破坏旧文件。

参数解析：

- 使用成熟 CLI 参数库，例如 `commander`。
- 使用运行时 schema 库，例如 `zod`，统一验证 config、命令行合并结果和 JSON 契约。
- `--set` 必须根据目标模板字段类型解析：number 转数字，boolean 只接受 `true|false`，select/color/text 保留字符串。
- 不允许 `Number("abc")` 产生 `NaN` 后继续执行。

### 7.2 `md2cv validate`

```powershell
md2cv validate .\resume.md --template modern --config .\resume.render.json --json
```

职责：

- 验证输入文件、编码、配置版本、模板、values、照片路径和输出选项。
- 不启动浏览器，不生成文件。
- 返回标准化后的模板 ID、effective values 和 warnings。
- 发现字体是否实际可用属于浏览器环境检查，不放在纯 validate 中。

### 7.3 `md2cv templates list`

```powershell
md2cv templates list
md2cv templates list --json
```

文本模式显示 ID、名称、版本和描述。JSON 模式返回完整但精简的模板元信息，不返回大段 CSS。

### 7.4 `md2cv templates schema`

```powershell
md2cv templates schema modern --json
```

返回：

- 模板元信息。
- 模板默认值。
- 完整 editor schema。
- 字段类型、范围、步长、单位和 select options。
- features 和 layout。

Skill 和 Agent 必须以此命令的结果为参数事实来源。

### 7.5 `md2cv doctor`

```powershell
md2cv doctor
md2cv doctor --json
```

检查：

- Node.js 版本是否满足最低要求。
- CLI 版本和包资产是否完整。
- renderer host 是否存在。
- 内置模板目录和三个默认模板是否存在。
- 浏览器发现结果、可执行路径和版本。
- 临时目录是否可写。
- cwd 是否可写。
- 可选执行一次最小 smoke render；默认不执行，使用 `--render-smoke` 开启。

doctor 不得修改用户简历或输出目录。smoke render 使用独立临时目录并在结束后清理。

### 7.6 帮助和版本

必须支持：

```powershell
md2cv --help
md2cv render --help
md2cv --version
```

帮助文本必须覆盖默认输出位置、覆盖策略、JSON stdout 约束和浏览器要求。

## 8. 渲染实现方案

### 8.1 抽取 `renderResume()`

从 `src/components/PreviewPane.vue` 抽取以下逻辑：

- Markdown 渲染。
- `enhanceResumeHtml()`。
- 照片 DOM。
- `applyResumeDocumentLayoutHooks()`。
- runtime style 构建。
- Paged.js `Previewer.preview()`。
- H2 section class 修复。
- page count。

抽取后的浏览器 API：

```ts
export async function renderResume(
  request: RenderRequest,
  target: HTMLElement,
): Promise<RenderResult>
```

要求：

- API 不读取 Pinia store。
- API 不显示消息框或通知。
- API 不操作预览缩放和滚动位置。
- 所有输入通过 `RenderRequest` 传入。
- 渲染失败抛出带稳定 code 的 renderer error。
- 每次调用清理上一次 Paged.js 插入的 style 和 DOM，支持同一页面连续渲染。
- 桌面端短期可以保留现有调用包装，但最终必须调用同一 `renderResume()`，防止 CLI 与桌面端漂移。

### 8.2 字体等待

分页前必须：

1. 注入模板 CSS、runtime CSS 和内置字体 CSS。
2. 调用现有 `ensurePreviewFontsReady()` 或抽取后的共享等价实现。
3. 等待 `document.fonts.ready`。
4. 对请求字体执行 `document.fonts.check()`。
5. strict 模式下字体失败直接终止；默认模式记录 `FONT_NOT_LOADED` warning。

测试中必须覆盖至少一个存在字体和一个不存在字体。

### 8.3 图片和本地资源

分页前必须等待所有 `.resume-document img`：

- `img.complete && img.naturalWidth > 0` 视为成功。
- 未完成时调用 `img.decode()`，并设置整体超时。
- 加载失败记录 `RESOURCE_LOAD_FAILED`。

本地资源策略：

- `--photo` 由 Node 读取并转换为 data URL 后传入浏览器。
- 模板资产从打包后的只读模板目录加载或内联。
- Markdown 相对图片路径只允许解析到输入 Markdown 所在目录及其子目录。
- 路径穿越到输入目录外默认拒绝。
- HTTP/HTTPS 资源默认禁止，使用 `--allow-network` 才允许。
- 远程资源必须受到同一个 render timeout 限制。
- 不执行 Markdown 中的 script、iframe 或 object 内容。

如果实现相对 Markdown 图片支持会显著扩大首期工作量，可以在首个开发里程碑明确只支持 `--photo` 和模板资产，但正式 0.1.0 发布前必须至少做到：不受支持的图片给出 warning，不能静默产生空白图片。

### 8.4 Paged.js 完成条件

不得使用固定 sleep 判断渲染完成。

完成条件：

- `Previewer.preview()` Promise 已 resolve。
- 目标容器存在至少一个 `.pagedjs_page`。
- 连续两个 animation frame 中 page count 和每页尺寸不再变化。
- 字体和图片等待已完成。

默认整体 timeout 为 30 秒，允许通过配置或参数调整，范围建议为 5-120 秒。

### 8.5 PDF

使用 Chromium `page.pdf()`：

```ts
await page.pdf({
  path: temporaryPdfPath,
  preferCSSPageSize: true,
  printBackground: true,
  displayHeaderFooter: false,
})
```

renderer host 的打印样式必须保证：

- `@page { size: A4; margin: 0 }`。
- Paged.js sheet 自己承载模板页边距。
- 每个 `.pagedjs_page` 恰好对应一个 PDF page。
- 页面阴影和外部预览背景不进入 PDF。
- 最后一页不产生额外空白页。

写入最终路径前验证：

- 文件以 `%PDF-` 开头。
- 文件字节数大于合理下限，例如 1 KB。
- PDF page count 与 `RenderResult.pageCount` 一致。
- PDF 可以被测试解析器读取。

### 8.6 逐页 PNG

对 `.pagedjs_page` 按 DOM 顺序截图：

```ts
await page.locator('.pagedjs_page').nth(index).screenshot({
  path: temporaryImagePath,
  animations: 'disabled',
  type: 'png',
})
```

要求：

- browser context 的 `deviceScaleFactor` 使用 `imageScale`。
- 截图前注入专用样式移除阴影、页间距和 UI 背景。
- PNG 必须是不透明白底。
- 图片数量必须等于 PDF/page result 页数。
- 图片必须能被 PNG 解析器读取。
- 所有图片宽高必须一致，除非未来明确支持非 A4 页面。
- 图片不得是全白或近似全白；空白页应触发 `EMPTY_PAGE`。

### 8.7 布局诊断

首期诊断算法：

- 对每页 `.pagedjs_page_content` 获取 bounding box。
- 检查横向 scrollWidth 是否超过 clientWidth 容差。
- 检查关键容器是否超出 page content box。
- 检查页面是否没有可见文本、图片或绘制元素。
- 检查 page count 是否超过 `maxPages`。

诊断必须是 warning，不得默认阻止产物生成；`strictFonts` 例外。

## 9. 模板加载与打包

### 9.1 Node 安全入口

在 `packages/resume-core/src/domain.ts` 中只导出：

- types。
- template manifest/schema normalization。
- template values resolve/clamp。
- 与 DOM 无关的样式和配置工具。

不得从该入口导出使用 `?raw` 的 `templates/loader.ts`。

### 9.2 CLI 模板加载器

CLI 使用文件系统读取打包后的模板目录：

```text
<cli-package>/dist/runtime/templates/
  modern/template.json
  modern/style.css
  business/template.json
  business/style.css
  classic/template.json
  classic/style.css
```

构建时由 `scripts/copy-runtime-assets.mjs` 从共享模板源复制，禁止在 CLI 目录维护第二份模板。

构建脚本必须：

- 删除并重建 CLI 自己的 `dist/runtime`，目标路径必须经过绝对路径校验。
- 复制全部模板目录和 assets。
- 校验每个 `template.json` 的 entryCss 存在。
- 校验三个内置模板都被复制。
- 生成模板文件 hash 清单，供 doctor 和测试验证。

不得修改或删除共享模板源。

### 9.3 用户模板

首期可以只正式支持内置模板。若实现用户模板，必须通过显式 `--template-dir` 加载，不自动扫描 Tauri AppData，避免 CLI 输出受桌面应用隐式状态影响。

用户模板不应阻塞 0.1.0。

## 10. 构建、安装和发布

### 10.1 `apps/cli/package.json`

CLI 首版运行时基线使用 Node.js 20 及以上，并在 package 中声明：

```json
{
  "engines": {
    "node": ">=20"
  }
}
```

`doctor`、CI 和临时安装测试必须验证该下限。根桌面应用如仍兼容 Node 18，可以保留自己的基线；不得为了 CLI 无依据地改变整个 monorepo 的 Node 要求。

建议脚本：

```json
{
  "scripts": {
    "dev": "...",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "build:node": "tsup ...",
    "build:renderer": "vite build --config vite.renderer.config.ts",
    "build:assets": "node scripts/copy-runtime-assets.mjs",
    "build": "npm run typecheck && npm run build:node && npm run build:renderer && npm run build:assets",
    "test": "vitest run",
    "test:e2e": "vitest run --config ...",
    "pack:check": "..."
  },
  "bin": {
    "md2cv": "dist/node/cli.js"
  }
}
```

具体脚本语法在实施时按工具版本调整，但必须保持职责拆分。

### 10.2 打包要求

npm tarball 必须包含：

- Node CLI bundle。
- renderer host 静态 bundle。
- 三个内置模板及资产。
- 必需字体资产。
- package metadata、LICENSE 和面向人的最小 CLI 使用文档。
- `skills/md2cv` 或可定位到该 skill 的发布资产。

不得依赖 npm 包外的仓库源码路径。

### 10.3 shebang 和 Windows shim

CLI 入口第一行必须是：

```text
#!/usr/bin/env node
```

通过 npm `bin` 生成 Windows `.cmd` shim。验收时必须在 PowerShell 中直接执行 `md2cv --version`，不能只测试 `node dist/node/cli.js`。

面向用户的首选安装和调用方式：

```powershell
npm install --global @max-md2cv/cli
md2cv --version
```

同时验证无需全局安装的调用方式：

```powershell
npx --yes @max-md2cv/cli --version
```

### 10.4 根目录脚本

根 `package.json` 增加：

```text
dev:cli
build:cli
test:cli
test:cli:e2e
pack:cli
```

同时保留现有桌面和 Web 脚本，不改变其语义。

### 10.5 发布前临时安装测试

每次发布必须执行：

1. 在仓库中构建 CLI。
2. 执行 `npm pack --workspace @max-md2cv/cli`。
3. 创建新的临时目录。
4. 在临时目录执行 `npm init -y`。
5. 安装刚生成的 `.tgz`。
6. 确认当前进程无法通过相对路径访问仓库源码。
7. 使用安装后的 `md2cv` 渲染 fixture。
8. 验证 PDF、PNG 和 JSON。
9. 删除临时目录。

只有 tarball 安装测试通过，才能声称 CLI “开箱可用”。仅在 monorepo 中直接运行源码不算交付验收。

## 11. Agent Skill 设计

### 11.1 Skill 定位

Skill 名称：

```text
md2cv
```

Skill 用于：

- 将 Markdown 简历导出为 PDF 或逐页图片。
- 使用 Max-MD2CV 模板调整简历视觉参数。
- 根据渲染截图检查分页、间距、溢出和空白。
- 通过 CLI JSON 结果进行迭代式排版。

Skill 不用于：

- 单纯撰写、润色或评价简历内容且不涉及渲染。
- 通用 Markdown 转 PDF。
- 未经用户授权自动改写简历内容。

### 11.2 Skill 文件结构

```text
skills/md2cv/
  SKILL.md
  agents/openai.yaml
  references/
    layout-tuning.md
    troubleshooting.md
```

首期不创建 `scripts/`，因为确定性执行逻辑已经由 CLI 提供。只有真实使用证明存在重复且 CLI 不适合承载的辅助动作时，才新增 skill script。

### 11.3 `SKILL.md` frontmatter

建议：

```yaml
---
name: md2cv
description: Render Markdown resumes to PDF and page images with the md2cv CLI, choose templates, tune layout values, and verify every rendered page. Use for Max-MD2CV resume export and layout-validation tasks; do not use for content-only resume writing.
---
```

description 必须保持精确，不能写成“处理所有简历任务”，避免 Skill 在纯内容润色请求中误触发。

保持默认允许隐式调用，除非未来用户明确要求只能通过 `$md2cv` 调用。

### 11.4 `SKILL.md` 正文

正文保持简短，只包含：

1. Skill 的目标。
2. CLI 可用性检查。
3. 标准渲染工作流。
4. 必须读取动态模板 schema 的规则。
5. 必须检查全部页面截图的规则。
6. 不得擅自修改 Markdown 内容的边界。
7. 失败时读取哪个 reference。
8. 调参时读取哪个 reference。
9. 最终交付内容。

建议核心工作流：

```text
1. 执行 md2cv --version；命令不可用时停止并报告安装问题。
2. 未明确模板时执行 md2cv templates list --json。
3. 调整模板参数前执行 md2cv templates schema <id> --json。
4. 按用户要求选择输出路径；未指定时保留 CLI 的 cwd 默认值。
5. 使用 md2cv render ... --json。
6. 解析 JSON，不从日志猜测产物路径。
7. 检查 images 数组中的每一张截图。
8. 根据 warnings 和截图决定是否调参；每轮只调整少量相关参数。
9. 每次重渲染后重新检查全部页面。
10. 最终返回 PDF 路径、图片路径、页数、模板和未解决 warnings。
```

必须包含的约束：

- 如果当前 Agent 环境不能查看图片，只能说明“图片已生成但未完成视觉验证”，不能声称排版正确。
- 如果用户只要求导出，不应擅自进行多轮视觉调优。
- 如果用户要求调到指定页数，最多自动尝试 3 轮参数调整；仍未满足时报告当前结果和建议，除非用户明确要求继续。
- 不默认使用 `--force`；只有目标文件不存在，或用户明确允许覆盖时使用。
- 不把模板字段范围硬编码到 Skill，始终读取 `templates schema`。
- CLI JSON 和错误码是事实来源，Skill 不解析不稳定的自然语言日志。

### 11.5 `references/layout-tuning.md`

只在用户要求调整版式，或首轮渲染存在页数、溢出、孤立标题、明显空白时读取。

内容包括：

- 少量超页时的参数调整优先级：段间距 -> 标题间距 -> 行高 -> 垂直页边距 -> 正文字号。
- 严重超页时先检查手动分页、异常图片、空段落和内容长度。
- 页面过空时如何增加行高、间距和页边距。
- 字体 fallback 对分页的影响。
- 每轮只调整 1-3 个相关参数的原则。
- 不牺牲可读性强行压页。
- 何时必须询问用户是否允许修改内容。

不得复制每个模板的全部字段定义。

### 11.6 `references/troubleshooting.md`

只在 CLI 失败或返回环境类错误时读取。

按稳定错误码组织：

- `BROWSER_NOT_FOUND`：运行 doctor，建议 `--browser-path`。
- `OUTPUT_EXISTS`：选择新路径，或取得覆盖授权后使用 `--force`。
- `TEMPLATE_VALUE_INVALID`：重新读取 schema。
- `RENDER_TIMEOUT`：检查远程资源、图片、字体和 timeout。
- `FONT_NOT_LOADED`：选择可用字体或使用 strictFonts 的处理方式。
- `PAGE_OVERFLOW`：读取 layout tuning。

reference 不得包含依赖开发机绝对路径的命令。

### 11.7 `agents/openai.yaml`

使用 skill-creator 提供的生成器创建 UI metadata，并确保：

- `display_name` 与 MD2CV 简历渲染含义一致。
- `short_description` 不宣称 Skill 能修改用户内容。
- `default_prompt` 是一个简短的 Markdown 简历导出示例。
- 不关闭隐式调用。

如果生成器创建了与实际 skill 不一致的占位内容，必须修改或删除占位内容后再验证。

### 11.8 Skill 与 CLI 版本关系

Skill 中声明最低兼容 CLI 版本，例如：

```text
Requires md2cv CLI >= 0.1.0.
```

只有公开命令或 JSON 契约发生不兼容变化时才提高最低版本。CLI 增加模板不需要修改 Skill，因为 Skill 动态读取 schema。

### 11.9 Skill 分发

- 仓库内以 `skills/md2cv` 为唯一源。
- npm tarball 和 GitHub Release 可以包含该目录的副本，但构建时必须从唯一源复制。
- 不在 CLI 包和仓库中手工维护两份 Skill。
- 文档说明如何将该目录安装到支持 Agent Skills 的环境。

## 12. 分阶段开发任务

每个阶段完成后必须运行该阶段测试。禁止把所有测试推迟到最后。

### 阶段 0：接口冻结与测试基线

目标：先冻结 CLI 外部契约和可比较的渲染样本。

任务：

- 新建 `apps/cli` workspace 骨架。
- 建立本文档定义的 config、result、warning 和 error 类型。
- 添加运行时 schema。
- 准备测试 fixtures：单页、两页、手动分页、照片、中文、英文、无效配置、异常图片。
- 使用当前桌面/Web 预览为三个内置模板生成基准页面截图和 page count 记录。
- 记录当前默认模板值和 schema 输出。

交付物：

- CLI package 骨架。
- 契约类型和 schema。
- fixtures 与 baseline metadata。

阶段验收：

- schema unit tests 全部通过。
- fixtures 不包含真实个人敏感信息。
- 三个内置模板都有基准样本。

### 阶段 1：共享 renderer 抽取

目标：得到不依赖 Vue、Pinia 和 Tauri 的浏览器渲染 API。

任务：

- 新增 `packages/resume-renderer`。
- 从 `PreviewPane.vue` 抽取 `renderResume()` 和布局 hook。
- 收口重复的 markdownRender/resumeParser 引用。
- 为 renderer 增加最小浏览器测试页面。
- 保持桌面预览行为不变；如暂时无法让桌面直接调用新 API，至少使用同一批纯函数，不复制逻辑。

阶段验收：

- renderer 输入固定请求后稳定返回 page count。
- 三个模板的 page count 与基线一致。
- renderer 可以在同一页面连续调用两次，不残留上一轮页面或 style。
- `npm run build` 和 `npm run build:web` 仍通过。

### 阶段 2：无界面 renderer host 与浏览器 automation

目标：CLI 可以在系统浏览器中完成一次无 UI 分页。

任务：

- 新建 renderer host Vite entry。
- Vite `base` 设置为适合离线本地加载的相对路径。
- 实现 browser discovery 和明确错误。
- 实现 render service 生命周期和 timeout。
- 实现字体、图片和稳定 layout 等待。
- 实现 console/pageerror/resource failure 捕获。

阶段验收：

- Windows Edge 环境可以从 fixture 得到 `.pagedjs_page`。
- 没有浏览器时返回 `BROWSER_NOT_FOUND`。
- Paged.js 永不完成时返回 `RENDER_TIMEOUT` 且浏览器进程被关闭。
- CLI 结束后不残留临时 renderer server、browser process 或用户数据目录。

### 阶段 3：PDF、PNG、路径与命令实现

目标：完成 CLI 功能闭环。

任务：

- 实现 `render`。
- 实现 `validate`。
- 实现 `templates list/schema`。
- 实现 `doctor`。
- 实现 config merge 和 `--set`。
- 实现输出路径和覆盖保护。
- 实现 PDF、逐页 PNG、hash 和 JSON 输出。
- 实现标准错误码和退出码。

阶段验收：

- 默认 cwd 输出正确。
- 指定 output-dir、pdf、images-dir 的组合全部正确。
- PDF page count、PNG 数量和 render page count 一致。
- JSON 模式 stdout 没有多余文本。
- Unicode 和包含空格的 Windows 路径可用。
- `--force` 和非覆盖行为符合定义。

### 阶段 4：打包与临时安装

目标：CLI 脱离 monorepo 源码也能工作。

任务：

- 配置 tsup/等价 Node bundle。
- 配置 renderer host build。
- 复制模板、字体和 renderer runtime。
- 配置 npm bin、files 和 publish metadata。
- 实现 `npm pack` 后临时目录安装测试。
- 为 Windows PowerShell 增加发布 smoke test。

阶段验收：

- `.tgz` 安装后 `md2cv --version` 成功。
- 临时安装目录中可以离线渲染所有内置模板。
- 删除仓库构建输出以外的源码访问后仍可渲染。
- npm tarball 不包含测试 golden、临时文件、用户简历或无关设计资产。

### 阶段 5：Skill 创建和验证

目标：交付能正确指导 Agent 使用 CLI 的 Skill。

任务：

- 使用 skill-creator initializer 创建 `skills/md2cv`。
- 编写精简 `SKILL.md`。
- 编写两个按需 reference。
- 生成并检查 `agents/openai.yaml`。
- 运行 quick validator。
- 用真实 CLI 完成独立行为测试。

阶段验收：

- Skill 名称和 frontmatter 合法。
- 正向请求能够触发 Skill，纯内容润色请求不应误触发。
- Agent 会查询模板 schema，而不是猜参数。
- Agent 会检查所有页面图片。
- 无图像查看能力时 Agent 不会声称完成视觉验证。
- Agent 不会未经授权使用 `--force` 或改写 Markdown。

### 阶段 6：回归、CI 与发布准备

目标：建立持续交付门槛。

任务：

- 接入 root scripts。
- 配置 CI unit/integration/e2e/package jobs。
- Windows 运行正式 release gate。
- macOS/Linux 运行 browser discovery 和 smoke render。
- 运行桌面、Web 和 Rust 回归。
- 补充 CLI 人类使用文档和发布说明。

阶段验收：

- 本文第 13、14 节所有 P0 测试通过。
- 所有发布硬门槛满足。
- 无未解释的 warning、残留临时文件或浏览器进程。

## 13. 测试方案

### 13.1 测试工具

建议：

- Vitest：unit、integration 和大部分契约测试。
- Playwright Core：产品浏览器控制。
- CI 中使用固定版本 Chromium：视觉回归和可重复 e2e。
- `pdfjs-dist` 或同等纯 Node 解析器：读取 PDF page count 和文本。
- `pngjs`：验证 PNG 尺寸、alpha 和像素内容。
- `pixelmatch`：受控环境下的视觉回归。

测试依赖不得进入最终运行时，除非 CLI 实际需要。

### 13.2 Unit tests

必须覆盖：

#### 配置

- 合法 config v1。
- 缺失 version。
- 未知 version。
- 非法 template value 类型。
- number min/max clamp 或报错行为与模板 schema 一致。
- select 非法值。
- boolean 字符串解析。
- CLI > config > template defaults 优先级。
- 多个 `--set` 顺序。

#### 路径

- 默认 cwd。
- output-dir。
- 独立 pdf 路径。
- images-dir。
- cwd 包含空格。
- Unicode 文件名。
- stdin name。
- Windows 非法字符。
- PDF 扩展名错误。
- 已存在文件且无 force。
- force 临时文件和原子替换。

#### 模板

- 三个内置模板全部加载。
- schemaPreset 展开为完整 schema。
- entryCss 缺失。
- template.json 非法。
- 重复模板 ID。

#### 错误和 JSON

- 每个稳定错误码映射到正确退出码。
- 成功 JSON 符合 schema。
- 错误 JSON 符合 schema。
- JSON 不包含 Markdown 正文。
- stdout 不混入日志。

### 13.3 Renderer integration tests

必须覆盖：

- modern、classic、business 各渲染一个单页 fixture。
- 中文和英文混排。
- 手动分页精确产生两页。
- 照片显示和隐藏。
- 主题色覆盖生效。
- 字号、行高、段间距、页边距变化影响实际布局。
- 缺失字体产生 warning；strictFonts 失败。
- 破损图片产生 warning。
- page overflow 被诊断。
- 连续渲染不污染。
- timeout 能终止。

### 13.4 CLI end-to-end tests

至少执行以下命令场景：

```powershell
md2cv render fixture.md --json
md2cv render fixture.md --template classic --output-dir out --json
md2cv render fixture.md --pdf custom.pdf --images-dir pages --json
md2cv render fixture.md --no-images --json
md2cv render fixture.md --no-pdf --json
md2cv render fixture.md --config fixture.render.json --set fontSize=13 --json
md2cv validate fixture.md --template modern --json
md2cv templates list --json
md2cv templates schema modern --json
md2cv doctor --json
```

每次 render 验证：

- 退出码。
- JSON schema。
- 文件是否存在。
- PDF header、大小、page count 和可解析性。
- PDF 至少包含 fixture 中的姓名或关键文本，保证不是纯图片空 PDF。
- PNG 数量、尺寸、非空白像素比例。
- JSON 中绝对路径与实际文件一致。
- 临时目录已清理。

### 13.5 视觉回归

视觉回归只在固定操作系统、固定 Chromium、固定字体下作为硬门槛，避免系统 Edge 自动升级导致无意义失败。

基准：

- 三个内置模板各一张单页 golden。
- 一个两页 fixture。
- 一个照片 fixture。

比较策略：

- 尺寸必须完全相同。
- pixel diff 允许极小抗锯齿阈值。
- diff 超阈值时保存 actual、expected、diff 三张图供审查。
- 更新 golden 必须说明原因，不能在测试失败时自动覆盖。

系统 Edge e2e 不进行严格 pixel match，只验证结构、页数、尺寸和非空白内容。

### 13.6 桌面和 Web 回归

CLI 开发可能修改共享渲染逻辑，因此每次阶段合并前必须执行：

```powershell
npm run build
npm run build:web
cargo check --manifest-path .\src-tauri\Cargo.toml
```

并手动或自动检查：

- 桌面预览仍可分页。
- Web Playground 仍可分页。
- 桌面 PDF 导出仍可用。
- 三个模板默认样式没有非预期变化。

### 13.7 打包安装测试

这是发布硬门槛，测试必须在临时目录执行安装后的 bin，而不是源码入口。

验证：

- npm tarball 内容清单正确。
- 安装无缺失文件错误。
- `md2cv --help`、`--version`、doctor 可运行。
- renderer host、字体和模板可以从 npm 包内部定位。
- cwd 默认输出生效。
- 无网络环境下内置模板渲染成功。

### 13.8 进程和清理测试

必须覆盖成功、参数错误、渲染失败和 Ctrl+C/中断路径：

- browser 被关闭。
- 临时 profile 被删除。
- 临时 PDF/PNG 被删除。
- 本地 renderer server 被关闭。
- 不删除用户输入和已有产物。

Windows 上的递归清理必须验证目标绝对路径位于 CLI 创建的临时目录内。

### 13.9 Skill 静态验证

使用 skill-creator 的 validator：

```text
python <skill-creator-dir>/scripts/quick_validate.py skills/md2cv
```

检查：

- frontmatter。
- skill 名称和目录名。
- 未完成占位符。
- references 可从 SKILL.md 被发现。
- openai.yaml 与 skill 含义一致。

### 13.10 Skill 行为验证

使用独立 Agent 会话和临时工作目录执行，不把预期命令序列直接告诉被测 Agent。

正向场景：

1. “把 `resume.md` 用 modern 模板导出为 PDF，并检查页面间距。”
2. “把这份简历改成蓝色主题，控制在两页内，输出到 `dist`。”
3. “只生成逐页图片，不要 PDF。”
4. “CLI 报浏览器不存在，帮我诊断。”

负向/边界场景：

1. “帮我润色这份简历的项目经历。”——不应仅因简历二字触发渲染流程。
2. “覆盖现有 resume.pdf。”——只有明确授权后才可使用 force。
3. Agent 无法查看图片——必须披露未视觉验证。
4. schema 中不存在用户要求的字段——不得猜测参数名。

行为验收：

- 使用 `--json`。
- 动态查询模板和 schema。
- 检查所有页面截图。
- 每轮调参幅度合理。
- 最多自动调参三轮后停止并报告。
- 最终给出真实绝对路径和 warnings。

## 14. 验收方案

### 14.1 P0 功能验收

以下全部满足才允许发布 0.1.0：

- `npm install` 后可构建 CLI。
- `npm pack` 产物可在独立临时目录安装。
- PowerShell 可直接执行 `md2cv`。
- `md2cv render resume.md` 默认在 cwd 产生 PDF 和全部页面 PNG。
- PDF 可打开、文本可选择、页数正确、无浏览器页眉页脚。
- PNG 数量与 PDF 页数一致，文字清晰，页面无预览阴影。
- modern、classic、business 均可导出。
- font、theme color、font size、line height、paragraph spacing、heading spacing、page margins 可通过 values 调整。
- 支持 config 和 `--set`，优先级正确。
- 支持 output-dir、pdf、images-dir、no-pdf、no-images。
- 默认不覆盖，force 行为正确。
- stdin 可用。
- JSON 输出稳定且 stdout 干净。
- browser missing、invalid template、invalid value、output exists、timeout 都有明确错误码和建议。
- Windows 路径包含空格和中文时可用。
- 失败后无残留浏览器进程和临时文件。
- 桌面和 Web 构建回归通过。
- Skill 静态和行为测试通过。

### 14.2 开箱可用验收脚本

发布候选版本必须由自动化脚本完成如下流程：

```text
build repo
  -> run unit tests
  -> run renderer integration tests
  -> npm pack CLI
  -> create isolated temp project
  -> install tarball
  -> md2cv doctor --json
  -> render one-page modern
  -> render two-page classic
  -> render business with config overrides
  -> parse PDFs
  -> inspect PNGs
  -> verify JSON and paths
  -> verify no temp/browser leak
  -> validate skill
```

脚本任一步失败，发布任务失败。

### 14.3 人工视觉验收

自动化通过后，由开发者至少检查：

- 三个模板各一份 PDF。
- 每份 PDF 对应的所有 PNG。
- 中文字体、英文、链接、项目符号、日期行和照片。
- 页面边缘、分页处、标题与正文连接处。
- 与桌面预览的可接受一致性。

人工验收记录应包含 CLI 版本、浏览器版本、模板版本和 fixture commit。

### 14.4 Skill 人工验收

用安装后的 CLI 发起一次真实 Agent 请求，确认 Agent：

- 自己发现模板和 schema。
- 正确使用 cwd 或用户指定路径。
- 读取 JSON 产物路径。
- 实际查看全部 PNG。
- 根据截图调整少量参数。
- 重新渲染并再次检查。
- 最终只交付确认存在的 PDF/PNG。

## 15. CI 建议

### 15.1 Jobs

```text
lint-and-typecheck
unit-tests
renderer-tests-pinned-chromium
cli-e2e-windows-edge
cli-smoke-macos
cli-smoke-linux
package-install-test
desktop-web-regression
skill-validation
```

### 15.2 平台策略

- Windows：正式 release gate，测试系统 Edge、空格路径和中文路径。
- Linux：固定 Chromium 做 renderer 和视觉回归。
- macOS：Chrome/Chromium discovery smoke；如果 CI 镜像没有浏览器，显式安装测试浏览器。

### 15.3 缓存

可以缓存 npm 和测试 Chromium，但 package-install-test 必须使用本次构建 tarball，不得引用 workspace link。

## 16. 风险与对策

### 风险 1：抽取 renderer 导致桌面预览回归

对策：

- 先建立三个模板 baseline。
- 抽纯函数，不一次性重写全部 PreviewPane。
- 每阶段执行桌面/Web 构建和 page count 回归。

### 风险 2：系统浏览器版本变化导致像素差异

对策：

- 产品支持 system browser。
- 视觉回归使用固定 Chromium。
- system browser 只做结构和 smoke 验证。
- JSON 记录浏览器版本。

### 风险 3：npm 包遗漏 renderer 或模板资产

对策：

- build asset manifest。
- doctor 校验 runtime assets。
- `npm pack` 后独立安装是发布硬门槛。

### 风险 4：CLI 与桌面模板 schema 漂移

对策：

- 共享模板目录是唯一源。
- CLI 构建时复制，不手工维护副本。
- schema contract test 比较共享源和包内产物。

### 风险 5：Skill 复制 CLI 文档后过期

对策：

- Skill 只规定工作流和边界。
- 参数范围通过 `templates schema` 动态读取。
- 故障处理按稳定错误码组织。

### 风险 6：异常退出残留浏览器和临时文件

对策：

- render service 使用 `try/finally`。
- 处理 SIGINT/SIGTERM。
- 临时路径全部由唯一 session root 管理。
- 清理前验证目标绝对路径位于 session root。

### 风险 7：外部资源造成隐私或不稳定

对策：

- 默认阻止网络。
- 照片和本地资产转换为 data URL 或受控本地资源。
- 网络必须显式 opt-in。
- 资源失败进入 warnings。

## 17. 代码质量要求

- 遵守仓库 `AGENTS.md`，保持 DRY。
- 不在 CLI 复制模板 schema 和渲染规则。
- 不把 Node API 引入桌面/Web 共享浏览器包。
- 不把 Playwright 引入 resume-core。
- 文件和函数保持单一职责。
- 错误使用 typed error，不依赖字符串匹配。
- 公共契约有运行时 schema 和测试。
- 所有临时资源使用 session root 管理。
- 不使用固定 sleep 等待渲染。
- 不在 stdout 打调试日志。
- 不在测试 fixture 中放真实简历或个人数据。

## 18. Definition of Done

本项目只有同时满足以下条件才算完成：

1. CLI 功能、JSON 契约和错误码按本文实现。
2. 三个内置模板均可从 Markdown 生成 PDF 和逐页 PNG。
3. CLI 默认输出和所有路径覆盖规则通过测试。
4. 字体、图片和 Paged.js 都有明确等待和 timeout。
5. `npm pack` 后独立安装测试通过。
6. Windows Edge 环境发布验收通过。
7. 固定 Chromium 视觉回归通过。
8. 桌面、Web 和 Rust 回归通过。
9. Skill 通过 quick validation。
10. Skill 通过至少四个正向和四个边界行为场景。
11. 发布包包含 CLI runtime、renderer、模板、字体和 Skill，且不依赖仓库源码。
12. README/CLI help 说明安装、浏览器要求、默认输出和示例。
13. 没有 P0/P1 未解决缺陷；已知非阻塞限制写入发布说明。

满足这些条件后，CLI 才能被描述为“可直接安装并开箱使用”，Skill 才能被描述为“能够可靠指导 Agent 完成简历渲染与排版验证”。
