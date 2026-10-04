# md2cv CLI 安装与检查

只在需要导出、智能一页或版式验证，且 CLI 不可用或版本不支持所需选项时阅读。仅修改 Markdown 正文不需要安装。

## 前提与检查

需要 Node.js 20+、npm，以及系统中的 Edge、Chrome 或 Chromium。源码安装还需要 Git；不需要安装 Tauri、Rust 或桌面版小简。

```sh
node --version
npm --version
md2cv --version
```

缺少 Node.js 时引导用户从 [Node.js 官网](https://nodejs.org/) 安装满足要求的版本，再开启新终端。系统软件安装遵循当前 Agent 的权限和用户授权。

## 从源码安装

当前可通过仓库源码构建安装。在用户选定的目录克隆；已有仓库时直接使用该仓库，不重复克隆。

```sh
git clone https://github.com/max-doo/max-md2cv.git
cd max-md2cv
npm install
npm run build:cli
npm install --global ./apps/cli
md2cv --version
md2cv doctor --json
md2cv render --help
```

`--help` 应包含 `--one-page`。安装 CLI 与安装 Skill 是两个独立步骤；安装桌面版不会自动提供 `md2cv` 命令。npm 包发布后，也可使用 `npm install --global @max-md2cv/cli`；若官方源返回 `E404`，使用上述源码流程，不反复重试不存在的包。

已有源码安装需要更新时，在干净的仓库中获取最新源码，再重新执行构建和全局安装。有本地修改时先保留修改，不重置用户仓库。npm 安装的版本可重新安装包更新，并检查帮助中的选项。

## 安装后验证

```sh
md2cv doctor --json
md2cv templates list --json
md2cv render ./resume.md --one-page --output-dir ./output --json
```

最后一条仅在用户要求渲染且输入存在时执行。`doctor` 可检查浏览器、运行资源和目录写入能力；需要实际验证浏览器渲染时运行 `md2cv doctor --render-smoke --json`。

找不到浏览器时安装 Edge、Chrome 或 Chromium，或使用 `--browser-path` / `MD2CV_BROWSER_PATH` 指定已安装的可执行文件。Windows 提示脚本执行受限时可先尝试 `npm.cmd`、`npx.cmd`、`md2cv.cmd`，不要求修改系统执行策略。命令安装后仍找不到时，重新开启终端并检查 npm 全局可执行目录是否已加入 PATH。

无法安装时说明具体缺失项和下一步，继续交付可用的 Markdown；不要声称已生成或验证 PDF。
