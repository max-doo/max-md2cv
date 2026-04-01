<script setup lang="ts">
import { computed, defineAsyncComponent, reactive, ref, watch, type CSSProperties } from 'vue'
import { useResumeStore } from '@resume-store'
import ResumeOutlinePanel from './sidebar/ResumeOutlinePanel.vue'

const props = withDefaults(defineProps<{
  mode?: 'full' | 'outline-only'
}>(), {
  mode: 'full',
})

const store = useResumeStore()
const ResumeLibraryPanel = defineAsyncComponent(() => import('./sidebar/ResumeLibraryPanel.vue'))

const newFileName = ref('')
const isCreating = ref(false)
const isOutlineOnly = computed(() => props.mode === 'outline-only')
const sidebarWidth = '20rem'
const sidebarInlineStyle = computed<CSSProperties>(() => {
  if (store.isSidebarOpen) {
    return {
      width: sidebarWidth,
      minWidth: sidebarWidth,
      flexBasis: sidebarWidth,
      opacity: '1',
      boxShadow: '4px 0 24px rgba(0, 0, 0, 0.03)',
      pointerEvents: 'auto',
    }
  }

  return {
    width: '0px',
    minWidth: '0px',
    flexBasis: '0px',
    opacity: '0',
    boxShadow: 'none',
    pointerEvents: 'none',
  }
})

const templateForm = reactive({
  name: '',
  company: '',
  position: '',
})

watch(() => store.isTemplateDialogVisible, (visible) => {
  if (!visible) {
    return
  }

  templateForm.name = ''
  templateForm.company = ''
  templateForm.position = ''
})

const handleCreateFromTemplate = async () => {
  if (!templateForm.name || !templateForm.company || !templateForm.position) {
    return
  }

  await store.createFromTemplate(
    templateForm.name,
    templateForm.company,
    templateForm.position,
  )
  store.isTemplateDialogVisible = false
}

const workspaceDisplayText = computed(() => store.workspacePath || '请选择工作文件夹')

const handleSelectWorkspace = async () => {
  await store.selectWorkspace()
}

const handleOpenWorkspaceDirectory = async () => {
  await store.openWorkspaceDirectory()
}

const openCreateFile = () => {
  isCreating.value = true
}

const closeCreateFile = () => {
  isCreating.value = false
  newFileName.value = ''
}

const handleCreateFile = async () => {
  const fileName = newFileName.value.trim()
  if (!fileName) {
    return
  }

  await store.createFile(fileName)
  closeCreateFile()
}
</script>

<template>
  <aside
    class="sidebar-shell relative z-20 flex h-full flex-shrink-0 flex-col overflow-hidden bg-surface-container-lowest transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
    :style="sidebarInlineStyle"
  >
    <div class="sidebar-frame absolute left-0 top-0 flex h-full w-80 flex-col font-['Manrope'] antialiased">
      <div class="sidebar-header flex shrink-0 items-center gap-3 bg-surface-container-lowest px-4 py-5 pb-4">
        <div class="min-w-0 flex-1">
          <div v-if="!isOutlineOnly" class="sidebar-segmented">
            <button
              type="button"
              class="sidebar-segment-button"
              :class="{ 'is-active': store.sidebarPrimaryView === 'library' }"
              @click="store.sidebarPrimaryView = 'library'"
            >
              我的简历
            </button>
            <button
              type="button"
              class="sidebar-segment-button"
              :class="{ 'is-active': store.sidebarPrimaryView === 'outline' }"
              @click="store.sidebarPrimaryView = 'outline'"
            >
              简历大纲
            </button>
          </div>

          <div
            v-else
            class="sidebar-outline-pill flex h-11 items-center rounded-[1.35rem] bg-surface-container px-4 text-sm font-semibold text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
          >
            简历大纲
          </div>
        </div>

        <button
          class="sidebar-close-button group flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-surface-variant"
          @click="store.isSidebarOpen = false"
        >
          <span class="material-symbols-outlined text-xl text-on-surface-variant group-hover:text-on-surface">close</span>
        </button>
      </div>

      <div class="min-h-0 flex-1 px-4 pb-6">
        <ResumeOutlinePanel v-if="isOutlineOnly || store.sidebarPrimaryView === 'outline'" />
        <ResumeLibraryPanel v-else />
      </div>

      <div
        v-if="!isOutlineOnly"
        class="flex shrink-0 flex-col gap-3 border-t border-black/5 bg-surface-container-lowest px-6 pb-5 pt-3"
      >
        <template v-if="!isCreating">
          <button
            v-if="store.workspacePath"
            type="button"
            class="flex min-h-[1.5rem] w-full cursor-pointer rounded-xl px-2 py-1 text-left text-xs leading-5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            :title="store.workspacePath"
            @click="handleOpenWorkspaceDirectory"
          >
            <span class="break-all">{{ workspaceDisplayText }}</span>
          </button>

          <div
            v-else
            class="min-h-[1.5rem] break-all px-1 text-xs leading-5 text-on-surface-variant"
          >
            {{ workspaceDisplayText }}
          </div>
        </template>

        <transition name="fade">
          <div v-if="isCreating" class="flex w-full flex-col gap-2">
            <div class="sidebar-accent-frame flex w-full items-center gap-2 rounded-xl border bg-surface-container px-3 py-2 shadow-sm">
              <input
                v-model="newFileName"
                autofocus
                placeholder="张三-腾讯-前端工程师"
                class="min-w-0 flex-1 border-none bg-transparent text-sm text-on-surface focus:outline-none"
                @keyup.enter="handleCreateFile"
                @keyup.esc="closeCreateFile"
              />
            </div>

            <div class="flex w-full items-center gap-2">
              <button
                class="flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-surface-container px-3 py-2.5 text-sm font-medium text-on-surface shadow-sm transition-all duration-200 hover:bg-surface-container-highest"
                @click="closeCreateFile"
              >
                <span class="truncate">取消</span>
              </button>
              <button
                class="flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-on-primary shadow-sm transition-all duration-200 hover:bg-primary/90"
                @click="handleCreateFile"
              >
                <span class="truncate">确认</span>
              </button>
            </div>
          </div>
        </transition>

        <div v-if="!isCreating" class="flex w-full items-center gap-2">
          <button
            class="flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-surface-container px-3 py-2.5 text-sm font-medium text-on-surface shadow-sm transition-all duration-200 hover:bg-surface-container-highest"
            @click="handleSelectWorkspace"
          >
            <span class="material-symbols-outlined shrink-0 text-lg">folder_open</span>
            <span class="truncate">更换文件夹</span>
          </button>

          <el-dropdown
            v-if="store.workspacePath"
            trigger="click"
            class="flex-1 min-w-0"
            placement="top"
          >
            <button
              class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-surface-container px-3 py-2.5 text-sm font-medium text-on-surface shadow-sm transition-all duration-200 hover:bg-surface-container-highest"
            >
              <span class="material-symbols-outlined shrink-0 text-lg">add</span>
              <span class="truncate">新建</span>
            </button>

            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="openCreateFile">
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-lg">draft</span>
                    <span>新建空白</span>
                  </div>
                </el-dropdown-item>
                <el-dropdown-item @click="store.openTemplateDialog">
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-lg">description</span>
                    <span>从演示模板新建</span>
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>
  </aside>

  <el-dialog
    v-if="!isOutlineOnly"
    v-model="store.isTemplateDialogVisible"
    title="从演示模板新建"
    width="400px"
    class="resume-dialog"
    destroy-on-close
  >
    <el-form :model="templateForm" label-width="60px" @submit.prevent>
      <el-form-item label="姓名">
        <el-input v-model="templateForm.name" placeholder="请输入姓名" />
      </el-form-item>
      <el-form-item label="公司">
        <el-input v-model="templateForm.company" placeholder="请输入公司" />
      </el-form-item>
      <el-form-item label="岗位">
        <el-input
          v-model="templateForm.position"
          placeholder="请输入岗位"
          @keyup.enter="handleCreateFromTemplate"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="flex justify-end gap-2">
        <el-button @click="store.isTemplateDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          @click="handleCreateFromTemplate"
          :disabled="!templateForm.name || !templateForm.company || !templateForm.position"
        >
          确定
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
