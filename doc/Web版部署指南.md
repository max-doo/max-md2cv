# Web 版部署指南

> 目标：把 `apps/web`（Web Playground）完整部署到公网，可通过 URL 直接访问。
> 适用版本：v0.1.4 · 最后更新：2026-10-07

---

## 一、结论速览

| 项目 | 结论 |
| --- | --- |
| 部署形态 | **纯静态站点（Static SPA）**，无需服务端 |
| 构建命令 | `npm run build:web`（仓库根目录执行） |
| 产物目录 | `apps/web/dist` |
| 环境变量 | **无**（当前版本零环境变量依赖） |
| 推荐托管 | 静态托管（Vercel / WorkBuddy 发布 / Nginx 静态目录） |
| 运行时要求 | Node ≥ 18（本地构建用）；线上托管侧无 Node 要求 |
| 公网地址（当前已验证） | https://md2cv-resume.app.workbuddy.host/ |
| 历史地址（Vercel，已不再登记于 README） | https://max-md2cv.vercel.app/ |

**为什么是纯静态**：Web 版只做三件事——Markdown 编辑、浏览器内分页预览、调用 `window.print()` 导出 PDF。
草稿存在 `localStorage`，头像以 base64 存内存与 `localStorage`，模板资源随打包产物一起下发。
没有 API 请求、没有数据库、没有文件上传后端，因此**不需要服务器运行进程，也不需要任何环境变量**。

---

## 二、构建配置与依赖核查

### 2.1 关键配置

- **工作区**：根 `package.json` 声明 `workspaces: ["apps/*", "packages/*"]`，Web 包名为 `@max-md2cv/web`。
- **构建脚本链**：
  - 根目录 `npm run build:web` → `npm run build --workspace @max-md2cv/web`
  - `apps/web/package.json` 的 `build` → `vue-tsc --noEmit && vite build`
  - **注意**：构建包含 TypeScript 类型检查，类型报错会直接中断构建（这是有意的质量门禁）。
- **Vite 配置**（`apps/web/vite.config.ts`）：
  - 别名 `@web` / `@desktop`（跨包复用桌面端组件）/ `@resume-core` / `@resume-store`
  - `server.port = 4173`、`strictPort: true`
  - `server.fs.allow` 放开到仓库根——因为要引用 `../../src` 与 `../../packages`，**构建必须在 monorepo 根目录的依赖环境下进行**，不能单独安装 `apps/web`。
- **产物引用方式**：`index.html` 内资源为绝对路径 `/assets/...`，`<link rel="icon" href="/favicon.png">`。
  → **必须部署在域名根路径**；若挂到子目录（如 `/resume/`），需要额外设置 `base`，当前配置不支持。

### 2.2 本地验证（已实测通过）

```bash
# 1. 安装依赖（仓库根目录，只需一次）
npm install

# 2. 生产构建
npm run build:web
# 预期输出：✓ 2008 modules transformed. / ✓ built in ~13s
# 产物：apps/web/dist/{index.html, favicon.png, assets/*}

# 3. 本地预览生产产物
npm run preview:web
# → http://localhost:4173/
```

实测结果（2026-10-07）：

```
首页      HTTP 200  485 B
assets/index-*.js    HTTP 200  1,726,966 B
assets/index-*.css   HTTP 200    186,750 B
```

### 2.3 构建产物清单说明

| 文件 | 大小 | 说明 |
| --- | --- | --- |
| `index.html` | 0.5 KB | 入口 |
| `assets/index-*.js` | 1.73 MB（gzip 511 KB） | 主应用（含 marked / codemirror / pagedjs / element-plus） |
| `assets/index-*.css` | 187 KB（gzip 26 KB） | 样式 |
| `assets/PingFangSC-Regular-*.woff2` | 5.24 MB | 中文字体，**首屏最大体积来源** |
| `assets/material-symbols-outlined-*.woff2` | 3.89 MB | 图标字体 |
| `assets/manrope-*.woff2` | 40 KB | 西文字体 |
| `assets/ResumeLibraryPanel-*.js` | 70 KB | 懒加载分包 |

> ⚠️ 首屏总下载约 **11 MB**。功能正常，但 4G 网络下首次打开偏慢。
> 后续优化方向：中文字体按需子集化（`fontmin`/`subfont`）、图标字体改 subset、`manualChunks` 拆分再配合 `import()` 懒加载。

---

## 三、环境变量

当前版本**不需要任何环境变量**。已核查：

```bash
grep -rn "import.meta.env" apps/web/src packages/ src/ --include=*.ts --include=*.vue
# 无匹配
```

因此：

- 无需 `.env` / `.env.production`；
- 托管平台的环境变量面板可以留空；
- 若后续引入后端 API，再按 `VITE_` 前缀约定新增（**只有 `VITE_` 前缀的变量会被注入前端**，且会被打进产物，不可放密钥）。
  新增时**必须在托管平台配置后重新构建**，只改平台变量不重新构建不会生效。

---

## 四、托管方式选择：静态托管（推荐）vs 服务端运行

| 维度 | 静态托管 ✅ | 服务端运行（Node/Nginx 进程） |
| --- | --- | --- |
| 是否需要进程常驻 | 不需要 | 需要，需守护与重启策略 |
| 冷启动 / 可用性 | 平台 CDN 直接返回文件 | 依赖进程存活 |
| 成本 | 免费额度通常够用 | 需服务器 + 运维 |
| 是否支持本项目 | 完全支持（无 API） | 也能跑，但纯属多余 |
| 发布回滚 | 平台自带版本回滚 | 需自行管理产物目录 |

**结论：选静态托管。** 理由是 Web 版没有任何服务端逻辑，服务端运行只会增加故障面（端口占用、进程崩溃、重启后未拉起），
而 PDF 导出走的是浏览器打印流程，同样不需要服务端介入。

三种落地方案：

| 方案 | 适用场景 | 本次状态 |
| --- | --- | --- |
| **A. WorkBuddy 一键发布** | 想立刻拿到可分享链接，零配置 | ✅ **已完成并验证** |
| **B. Vercel** | 团队协作、CI 自动部署（仓库已有 `vercel.json`） | 仓库已配置，README 登记的地址在线 |
| **C. 自有服务器 + Nginx** | 需要自有域名 / 内网合规要求 | 可随时启用 |

---

## 五、部署步骤（标注执行位置）

### 方案 A：WorkBuddy 一键发布 —— 已执行

| 步骤 | 执行位置 | 操作 |
| --- | --- | --- |
| 1 | **本地** | `npm install` |
| 2 | **本地** | `npm run build:web`，确认 `apps/web/dist` 产物完整 |
| 3 | **托管平台** | 以 `apps/web/dist` 为发布目录执行发布（静态托管，自动分配域名并做 HTTPS） |
| 4 | — | 得到公网地址：`https://md2cv-resume.app.workbuddy.host/` |

> 关键点：发布目录必须指向**构建产物目录**（`apps/web/dist`），不要指向 `apps/web` 源码目录——
> 源码目录的 `index.html` 引用的是 `/src/main.ts`，静态托管无法编译 TS，页面会白屏。

**重新发布（内容更新）**：本地重新执行步骤 2，再对同一目录发布一次即可覆盖，链接保持不变。

---

### 方案 B：Vercel

仓库根目录已有 `vercel.json`，无需改配置：

```json
{
  "buildCommand": "npm run build:web",
  "outputDirectory": "apps/web/dist",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
  ]
}
```

| 步骤 | 执行位置 | 操作 |
| --- | --- | --- |
| 1 | **本地** | 确认改动已提交并推送到 `origin/main` |
| 2 | **本地** | `git push origin main`（仓库：`https://github.com/max-doo/max-md2cv.git`） |
| 3 | **托管平台** | Vercel 导入仓库 → 识别 `vercel.json` → 自动构建 |
| 4 | **托管平台** | 环境变量留空；Node 版本选 18/20/22 |
| 5 | — | 访问 `https://<project>.vercel.app/` |

也可用 CLI：`npx vercel --prod`（在仓库根执行，需先 `npx vercel login`）。

**要点**：Vercel 的 `installCommand` 是 `npm install` 而非 `npm ci`——因为 monorepo 的 workspace 联动，
用 `npm ci` 需要 lockfile 完全同步；当前配置更稳。

---

### 方案 C：自有服务器 + Nginx

| 步骤 | 执行位置 | 操作 |
| --- | --- | --- |
| 1 | **本地** | `npm run build:web` |
| 2 | **本地** | `tar -czf web-dist.tar.gz -C apps/web/dist .` |
| 3 | **本地** | `scp web-dist.tar.gz user@<服务器IP>:/tmp/` |
| 4 | **服务器** | `sudo mkdir -p /var/www/md2cv-web && sudo tar -xzf /tmp/web-dist.tar.gz -C /var/www/md2cv-web` |
| 5 | **服务器** | 写入 Nginx 配置（见下）并 `sudo nginx -t && sudo systemctl reload nginx` |
| 6 | **服务器** | 若用 HTTPS：`sudo certbot --nginx -d your.domain.com` |

```nginx
server {
    listen 80;
    server_name your.domain.com;          # 或服务器公网 IP
    root /var/www/md2cv-web;
    index index.html;

    # 长缓存：带内容指纹的静态资源
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 入口不缓存，避免发布后拿到旧 HTML
    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    # SPA 回退：任何未知路径回退到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

> 云服务器安全组 / 防火墙需放行 `80`（及 `443`）端口，否则外网访问不通。

---

## 六、部署后验证方法

### 6.1 命令行验证（最快）

```bash
BASE=https://md2cv-resume.app.workbuddy.host

# 1) 首页可达
curl -sI $BASE/                     # 期望 HTTP/2 200

# 2) 入口 HTML 引用的资源真实存在（把实际文件名替换进来）
curl -s $BASE/ | grep -o '/assets/[^"]*'
curl -sI $BASE/assets/index-DaIetIEa.js    # 期望 200

# 3) 关键静态文件
curl -sI $BASE/favicon.png          # 期望 200
```

### 6.2 浏览器验证清单

1. 打开公网 URL，页面出现**左侧 Markdown 编辑区 + 右侧 A4 简历预览**，说明 JS 与样式加载成功。
2. 在编辑区改一行内容，右侧预览应即时刷新（验证 reactivity 与字体加载）。
3. 切换模板（五款），预览与配色应随之变化。
4. 点击「导出 PDF」→ 弹出新窗口并唤起打印对话框。**导出依赖浏览器弹窗权限**，若被拦截会提示「浏览器拦截了打印窗口」。
5. 刷新页面，草稿应保留（`localStorage` 生效）。
6. 打开 DevTools → Network，筛选 `404` / `Failed`，应无红项；Console 无报错。

### 6.3 已完成的实测记录

```
GET /                          → 200  text/html      485 B   1.22s
GET /assets/index-*.js         → 200              1,726,966 B
GET /assets/index-*.css        → 200                186,750 B
GET /favicon.png               → 200                 52,028 B
```

---

## 七、常见问题排查

### 7.1 页面白屏 / 只有空白 div

| 现象 | 原因 | 排查与修复 |
| --- | --- | --- |
| 白屏，Console 报 `Failed to load module script` 或 `Unexpected token '<'` | 误把源码目录发布上去了，或资源路径 404 | 确认发布目录是 `apps/web/dist`；查看 Network 中 `/assets/*` 是否 200 |
| 白屏，Console 报 `Failed to resolve module specifier "@desktop/..."` | 用未构建的源码跑 | 必须走 `vite build`，别名由 Vite 解析，浏览器不认识 |
| 页面正常 DOM 但无样式 | CSS 404 或路径错了 | 检查 `<link>` 指向的 CSS 是否 200 |
| 挂在子目录（如 `https://x.com/app/`）白屏 | 产物用绝对路径 `/assets/` | 改用根域名部署，或在 `apps/web/vite.config.ts` 设 `base: '/app/'` 后重新构建 |

### 7.2 路由刷新 404

> 本项目**未使用 vue-router**，只有一个页面，因此正常访问不会出现该问题。
> 但一旦后续引入路由，必须配置 SPA 回退，否则刷新 `/some/path` 会 404。

| 平台 | 配置 |
| --- | --- |
| Vercel | `vercel.json` 的 `rewrites` 把所有路径重写到 `/index.html`（**已配好**） |
| Nginx | `location / { try_files $uri $uri/ /index.html; }` |
| Python 简易静态服务 / 部分静态托管 | 无回退能力，需换成支持 rewrite 的托管或自建服务器 |
| WorkBuddy 发布 | 未提供自定义 rewrite；当前无路由，不受影响 |

### 7.3 端口问题

| 场景 | 说明 |
| --- | --- |
| 本地 dev 起不来 | `apps/web` 用 **4173** 且 `strictPort: true`，端口被占会直接失败。`netstat -ano \| findstr :4173` 找到 PID 后结束进程 |
| 桌面端 dev | 根目录 Vite 固定 **18080**，与 Web 版互不冲突 |
| 服务端运行（非静态方案） | 进程必须监听 `PORT` 环境变量并绑定 `0.0.0.0`，否则反向代理无法回源。静态托管方案不涉及此问题 |
| 服务器上外网打不开 | 云安全组 + 系统防火墙需同时放行 80/443 |

### 7.4 跨域（CORS）

- **当前部署不需要 CORS 配置**：前端不发起任何跨域请求，模板与字体均为同源静态资源。
- 若后续接入后端 API：在服务端设置 `Access-Control-Allow-Origin` 为你的前端域名（不要用 `*` 搭配 Cookie），
  并注意 `Access-Control-Allow-Credentials` 与预检请求 `OPTIONS` 的处理。
- 反向代理方案下，也可让前端走同源路径（如 `/api`），由 Nginx `proxy_pass` 转发，从根上规避 CORS。

### 7.5 环境变量未生效

| 原因 | 说明 |
| --- | --- |
| 变量名缺 `VITE_` 前缀 | Vite 只暴露 `VITE_` 开头的变量给前端代码 |
| 改了平台变量但没重新构建 | 环境变量是**构建期**注入，必须触发一次新构建 |
| 平台配置在错误的 scope | 区分 Production / Preview / Development 环境 |
| 代码里写的是 `process.env` | 浏览器侧要用 `import.meta.env.XXX` |
| monorepo 根目录变量 | 构建命令在仓库根执行，变量需配置在构建实际发生的作用域 |

### 7.6 发布后仍是旧版本

| 原因 | 处理 |
| --- | --- |
| HTML 被缓存 | 入口 HTML 应设为 `no-cache`（Nginx 示例已包含）；Vercel 默认不缓存 HTML |
| 平台 CDN 未刷新 | 等待分钟级生效，或手动 purge / 重新部署 |
| 浏览器缓存 | 硬刷新 `Ctrl+Shift+R` |
| 只跑了 build 没重新发布 | 构建与发布是两个动作，静态托管需重新上传产物 |

> 产物带内容指纹（`index-DaIetIEa.js`），只要 HTML 更新，资源路径必然变化，不会出现旧 JS 与新 HTML 混用。

### 7.7 首次加载慢

主因是中文字体（5.24 MB）与图标字体（3.89 MB）。属于性能问题而非故障。
优化路径见 §2.3 的提示。临时缓解：开启 gzip/brotli（Vercel 默认开启），确认服务器对 `woff2` 不做二次压缩（woff2 本身已压缩）。

---

## 八、发布检查清单

- [ ] `npm install` 在仓库根目录执行成功
- [ ] `npm run build:web` 无类型错误、无构建报错
- [ ] `apps/web/dist/index.html` 与 `assets/` 均存在
- [ ] 发布目录指向 `apps/web/dist`（不是 `apps/web`）
- [ ] 环境变量面板留空（当前无需）
- [ ] 公网 URL 首页 200，Console 无报错，预览区正常渲染
- [ ] 导出 PDF 可唤起打印窗口
- [ ] 刷新页面草稿保留
- [ ] 记录本次发布的链接，便于后续覆盖更新
