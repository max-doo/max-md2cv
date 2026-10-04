---
name: md2cv
description: Create and edit resumes in Xiaojian (Max-MD2CV) Markdown format, tailor content to a role, and use the md2cv CLI to export PDF and page PNGs, fit to one page, and verify layout. Use when the user requests Xiaojian/md2cv resume writing, revision, formatting, or export.
---

# 小简简历修改与渲染

帮助用户整理或修改符合小简格式的 Markdown 简历，并按需通过 CLI 生成 PDF 和逐页 PNG。只修改正文时无需安装 CLI；导出、智能一页和版式验证需要 CLI 与系统中的 Edge、Chrome 或 Chromium。

## 整理或修改简历

写作、修改或转换格式前，阅读 [小简 Markdown 格式参考](references/resume-format.md)，需要起稿时采用 [简历骨架](assets/resume-template.md)。这些文件随 Skill 安装，不依赖项目源码。

- 根据用户提供的经历、目标岗位和修改范围调整内容；保留真实事实、日期和数据，不编造量化成果。缺失的重要信息向用户确认，草稿中的待补充内容要明确标记。
- 姓名用 `#`，模块用 `##`，经历用 `###`，日期使用英文半角方括号；保留用户已有的章节顺序和标题列顺序，除非用户要求重组。
- 只修改指定段落时保持其他内容；只请求排版或导出时不改写正文。模板占位符仅用于起稿，交付时用已知事实替换，缺少资料的模块可省略。
- 纯正文任务交付可粘回小简的 Markdown；需要落盘时按用户指定路径保存。

## 导出、智能一页与版式验证

1. 运行 `md2cv --version`。不可用时读取 [CLI 安装指引](references/cli-installation.md)，引导安装；已有安装授权时完成安装和检查，没有授权时给出所需命令，同时继续可完成的正文任务。不要把 CLI 缺失当成简历修改的阻塞条件。
2. 用户未指定模板时运行 `md2cv templates list --json`。手动调整参数前运行 `md2cv templates schema <id> --json`，以实际 schema 为准。
3. 使用 `md2cv render resume.md --output-dir output --json`，沿用用户指定的输出路径。要求智能一页或尽量压到一页时增加 `--one-page`，例如 `md2cv render resume.md --one-page --output-dir output --json`。调用前通过 `md2cv render --help` 确认支持该选项；旧版本需按安装指引更新。`--max-pages 1` 只报告超页，不能代替智能一页。
4. 从 JSON 读取 `artifacts`、`pageCount`、`effectiveValues`、`warnings`，以及智能一页结果 `onePage.fitted`。单页失败仍会生成完整的多页版本；报告结果和精简建议，不宣称成功压成一页，不自动删减正文。
5. 查看 `artifacts.images` 中的每一页。Agent 无法查看图片或用户禁用 PNG 时，明确说明尚未完成视觉验证。确认文件存在后再交付路径。
6. 需要进一步调整页数或间距时读取 [排版微调](references/layout-tuning.md)；CLI 报错时读取 [故障处理](references/troubleshooting.md)。智能一页内部已执行有界搜索，不需要 Agent 模拟搜索；额外手动微调最多三轮，每轮检查全部页面，未达到目标时报告差距。

不使用 `--force` 覆盖已有产物，除非用户已授权覆盖。交付导出结果时说明文件路径、页数、所用模板、视觉检查情况和未解决的警告。
