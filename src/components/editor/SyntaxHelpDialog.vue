<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { copyTextToClipboard } from '../../utils/clipboard'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()

const activeTab = ref<'syntax' | 'skill'>('syntax')
const isCopied = ref(false)
const isSkillPromptCopied = ref(false)

const SKILL_INSTALL_PROMPT = `请帮我安装小简（Max-MD2CV）的 md2cv Agent Skill，供当前 Agent 在之后的简历任务中使用。

官方仓库：https://github.com/max-doo/max-md2cv
Skill 目录：skills/md2cv

请将完整的 md2cv 目录（包括 SKILL.md、references、assets 和 agents）安装到当前 Agent 支持的用户级 Skill 目录，保留已有的其他 Skill。可以使用以下命令，并指定当前 Agent 对应的 --agent 参数完成安装：
npx skills add max-doo/max-md2cv --skill md2cv --global --copy
若无法使用该安装工具，请从官方仓库获取完整 Skill 目录后安装，不要只复制 SKILL.md；已有同名 Skill 时先检查并保留本地修改。

安装后确认格式参考、简历骨架和 CLI 安装文档均存在，告诉我安装位置和如何调用；如果需要开启新会话才能加载，请说明。
仅修改简历正文不需要 CLI。之后我要求导出 PDF、检查排版或使用智能一页时，请检查 md2cv 是否可用；未安装时按 Skill 中的 references/cli-installation.md 引导我安装。`

// 面向大模型优化的完整提示词（点击“复制提示词”时复制的内容）
const AI_PROMPT = `你是一位专业的简历排版与优化顾问。请将我提供的个人经历与简历草稿，整理并转换为严格符合以下规范的 Markdown 简历。

【排版规范与格式要求】：
1. 姓名与求职意向：
   - 顶部第一行使用一级标题：# 姓名
   - 下一行使用加粗求职意向：**求职意向：目标岗位**
2. 基础联系信息：
   - 紧随其后单行展示，各项之间使用竖线分隔：
     手机号码：xxx | 电子邮箱：xxx | 现居地：城市 | GitHub/作品集：https://...
3. 模块大分类：
   - 统一使用二级标题，推荐顺序：
     ## 个人优势
     ## 教育背景
     ## 工作/实习经历
     ## 项目经历
     ## 专业技能
4. 经历条目标题（核心排版规范）：
   - 每一段经历必须使用三级标题：
     ### 职位/身份 | 公司/学校/组织 [开始时间 - 结束时间]
   - 标题信息按书写顺序排布，也可以将日期放在最前面或中间，例如：
     ### [2024.09 - 2027.06] 硕士 - 新闻与传播 | 某综合类高校
   - 「 | 」用于分列，方括号日期自动识别为独立一列，日期旁的「 | 」可省略；排版后列间使用留白。
   - ⚠️ 关键要求：时间区间必须使用英文半角方括号包裹（例如 [2022.09 - 2026.06] 或 [2023.03 - 至今]）。
5. 经历描述（STAR法则 & 量化成果）：
   - 经历下方可写 1-2 句简述，详细职责与成果展开必须使用无序列表 \`- \`
   - 每条列表建议以加粗关键词开头，量化具体工作成果（数据、百分比、指标等）：
     - **业务攻坚：** 负责核心系统重构，支撑千万级流量稳定运行
     - **性能调优：** 优化首屏资源加载，页面加载速度提升 40%
6. 专业技能：
   - 建议按技术领域分组归纳，例如：
     **前端开发：** Vue 3, TypeScript, TailwindCSS
     **后端与运维：** Node.js, Docker, Linux
7. 输出要求：
   - 必须忠于事实，不得凭空捏造经历。
   - 请【仅直接输出】符合上述规范的纯 Markdown 正文，不要包裹任何多余开场白或寒暄。

---
【以下是我的原始经历/简历草稿】：
（请在此粘贴你的简历内容）`

// 面向用户直观展示的语法说明列表
const SYNTAX_RULES = [
  {
    title: '1. 姓名与求职意向',
    desc: '一级标题表示姓名，下方紧跟加粗的目标岗位',
    sample: '# 姓名\n**求职意向：目标岗位**',
  },
  {
    title: '2. 基础联系信息',
    desc: '单行展示，各项之间使用竖线管道符「 | 」分隔',
    sample: '手机号码：138-0000-0000 | 电子邮箱：example@email.com | 现居地：城市',
  },
  {
    title: '3. 模块大分类',
    desc: '二级标题划分各大核心板块，自带主题装饰样式',
    sample: '## 个人优势\n## 教育背景\n## 工作经历\n## 项目经历\n## 专业技能',
  },
  {
    title: '4. 经历条目与时间（核心对齐语法）',
    desc: '三级标题按书写顺序分列，三项分别居左、居中、居右；「 | 」用于分列，方括号日期旁可省略，排版后列间使用留白',
    sample: '### [2024.09 - 2027.06] 硕士 - 新闻与传播 | 某综合类高校\n### 岗位职称 | 公司名称 [2023.03 - 至今]',
  },
  {
    title: '5. 职责与量化成果',
    desc: '采用无序列表，加粗引导词并量化成果数据',
    sample: '- **业务攻坚：** 负责核心系统架构升级，承载千万级流量\n- **性能优化：** 实施资源分包优化，首屏加载速度提升 40%',
  },
  {
    title: '6. 专业技能与强调',
    desc: '技能分类归纳，关键指标使用加粗突出',
    sample: '**前端开发：** Vue 3, TypeScript, TailwindCSS\n**重点标注：** 支持使用 **加粗** 或 **【高亮重点】** 突出关键成就',
  },
  {
    title: '7. 手动分页符',
    desc: '单独成行输入 \\page，用于跨页强制分页',
    sample: '\\page',
  },
]

const handleCopyPrompt = async (kind: 'format' | 'skill') => {
  const copied = kind === 'skill' ? isSkillPromptCopied : isCopied
  const success = await copyTextToClipboard(kind === 'skill' ? SKILL_INSTALL_PROMPT : AI_PROMPT)
  if (success) {
    copied.value = true
    ElMessage.success(kind === 'skill' ? 'Skill 安装提示词已复制' : '格式提示词已复制')
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } else {
    ElMessage.error('复制失败，请重试')
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    width="720px"
    class="syntax-help-dialog"
    destroy-on-close
    append-to-body
    :show-close="true"
    @open="activeTab = 'syntax'"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div class="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <span class="material-symbols-outlined text-[20px]">help_outline</span>
        </div>
        <div>
          <h3 class="text-base font-bold text-on-surface leading-tight">简历使用指南</h3>
          <p class="mt-1 text-xs text-on-surface-variant">
            查看排版语法，或安装 Skill 与 Agent 协作修改简历
          </p>
        </div>
      </div>
    </template>

    <el-tabs v-model="activeTab" class="syntax-help-tabs">
      <el-tab-pane label="语法说明" name="syntax">
        <div class="custom-scrollbar h-[500px] max-h-[55vh] space-y-2.5 overflow-y-auto pr-1">
          <div
            v-for="(rule, idx) in SYNTAX_RULES"
            :key="idx"
            class="rounded-md bg-surface-container-low/70 p-3 transition-colors hover:bg-surface-container-low"
          >
            <div class="mb-1.5 flex items-baseline justify-between gap-3">
              <span class="text-sm font-bold text-on-surface flex items-center gap-1.5">
                <span class="inline-block h-1.5 w-1.5 rounded-full bg-primary/70"></span>
                {{ rule.title }}
              </span>
              <span class="text-xs text-on-surface-variant">{{ rule.desc }}</span>
            </div>
            <div class="rounded border border-outline-variant/15 bg-surface-container-lowest/95 px-3.5 py-2 font-mono text-[13.5px] text-primary">
              <pre class="whitespace-pre-wrap font-sans font-medium leading-relaxed">{{ rule.sample }}</pre>
            </div>
          </div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="Skill 安装说明" name="skill">
        <div class="custom-scrollbar h-[500px] max-h-[55vh] overflow-y-auto pr-1">
          <div class="rounded-md bg-primary/5 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 class="text-sm font-bold text-on-surface">让 Agent 按小简格式改简历</h4>
                <p class="mt-1 text-xs leading-relaxed text-on-surface-variant">
                  安装 md2cv Skill，复用格式参考与简历骨架，还可导出 PDF、检查分页和调用智能一页。
                </p>
              </div>
            </div>
            <p class="mt-3 text-xs leading-relaxed text-on-surface-variant">
              复制后发给支持 Skill 的 Agent，让它完成安装。之后可以说「用 md2cv 按小简格式修改我的简历」。
              只改正文无需 CLI；导出或智能一页时，Skill 会引导安装 CLI。
            </p>
            <div class="mt-3 text-xs text-on-surface-variant">
              <h5 class="font-semibold text-primary">安装提示词</h5>
              <pre class="mt-2 whitespace-pre-wrap break-words rounded-md bg-surface-container-lowest p-3 font-sans leading-relaxed text-on-surface">{{ SKILL_INSTALL_PROMPT }}</pre>
              <p class="mt-2 leading-relaxed">已安装 Node.js 与 Git 时，也可在终端运行以下命令，再选择当前使用的 Agent：</p>
              <pre class="mt-2 whitespace-pre-wrap break-words rounded-md bg-surface-container-lowest p-3 font-mono leading-relaxed text-primary">npx skills add max-doo/max-md2cv --skill md2cv --global --copy</pre>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 底部：使用指引与复制提示词按钮在同一行 -->
    <template #footer>
      <div class="flex items-center justify-between gap-3 pt-1">
        <!-- 左侧：使用指引 -->
        <div class="flex items-center gap-2 text-xs text-on-surface-variant">
          <span class="flex items-center gap-1 font-semibold text-primary">
            <span class="material-symbols-outlined text-[16px]">tips_and_updates</span>
            <span>使用指引：</span>
          </span>
          <span class="flex items-center gap-1 text-on-surface">
            <span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">1</span>
            复制提示词
          </span>
          <span class="text-outline-variant/60">➔</span>
          <span class="flex items-center gap-1 text-on-surface">
            <span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">2</span>
            {{ activeTab === 'syntax' ? '发给 AI 附带经历' : '发给 Agent 安装' }}
          </span>
          <span class="text-outline-variant/60">➔</span>
          <span class="flex items-center gap-1 text-on-surface">
            <span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">3</span>
            {{ activeTab === 'syntax' ? '粘回编辑器' : '用 Skill 改简历' }}
          </span>
        </div>

        <!-- 右侧：复制提示词按钮 -->
        <button
          type="button"
          class="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-on-primary shadow-xs transition-all hover:bg-primary/90 active:scale-95"
          @click="handleCopyPrompt(activeTab === 'syntax' ? 'format' : 'skill')"
        >
          <span class="material-symbols-outlined text-[16px]">
            {{ (activeTab === 'syntax' ? isCopied : isSkillPromptCopied) ? 'check' : 'content_copy' }}
          </span>
          <span>{{ (activeTab === 'syntax' ? isCopied : isSkillPromptCopied) ? '已复制' : activeTab === 'syntax' ? '复制格式提示词' : '复制安装提示词' }}</span>
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<style>
.syntax-help-dialog.el-dialog {
  border-radius: 0.5rem !important;
  background-color: var(--color-surface) !important;
  box-shadow: var(--shadow-ambient) !important;
  padding: 1.25rem 1.5rem !important;
}

.syntax-help-dialog .el-dialog__header {
  padding-bottom: 0.75rem !important;
  margin-right: 0 !important;
}

.syntax-help-dialog .el-dialog__body {
  padding-top: 0.25rem !important;
  padding-bottom: 0.5rem !important;
}

.syntax-help-dialog .el-dialog__footer {
  border-top: 1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent) !important;
  padding-top: 0.75rem !important;
}
.syntax-help-tabs .el-tabs__header {
  margin-bottom: 0.75rem;
}

.syntax-help-tabs .el-tabs__nav-wrap::after,
.syntax-help-tabs .el-tabs__active-bar {
  display: none;
}

.syntax-help-tabs .el-tabs__nav {
  gap: 0.25rem;
  padding: 0.25rem;
  border-radius: var(--radius-md);
  background: var(--color-surface-container-low);
}

.syntax-help-tabs .el-tabs__item {
  height: 2.25rem;
  padding: 0 1rem !important;
  border-radius: var(--radius-md);
  color: var(--color-on-surface-variant);
  font-size: 0.8125rem;
  font-weight: 600;
}

.syntax-help-tabs .el-tabs__item.is-active {
  background: var(--color-surface-container-lowest);
  color: var(--color-primary);
  box-shadow: var(--shadow-xs);
}

</style>
