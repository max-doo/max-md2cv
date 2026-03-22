---
trigger: always_on
---

- 始终用中文和用户沟通
- 当遇到重大更新、代码文件的增加与删除时，必须更新README
- 使用element plus组件，避免重复造轮子

### 前端开发规范 (Frontend Guidelines)
1. **Tailwind 优先原则**：布局与通用UI严格使用 Tailwind 原子类，禁止在 Vue `<style>` 中滥用零散样式。
2. **全局样式收敛**：跨业务全局抽象（如 `.btn-primary`、`.card-soft`）及 Element Plus 覆盖，必须集中配置在 `src/assets/tailwind.css` 中。
3. **捍卫柔和极简美学 (Soft Minimalist)**：贯彻“The Digital Curator”理念。**严禁使用 1px 硬边框**分割空间；须以 `surface` 背景阶层反差与定制环境阴影 (`shadow-ambient`) 营造深度。
4. **Vue 3 语法栈**：必须使用 `<script setup lang="ts">`，强制推行 TypeScript 类型校验。
5. **状态提权**：复杂业务逻辑与跨层级共享数据需沉淀至 Pinia Store (`src/stores`)，保持 Vue SFC 视图层轻量、纯净。