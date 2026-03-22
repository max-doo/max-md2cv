<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { invoke } from '@tauri-apps/api/core'
import { useResumeStore } from '../stores/resume'
import type { FileItem } from '../stores/resume'

const store = useResumeStore()
const newFileName = ref('')
const isCreating = ref(false)

const editingFileStr = ref<string | null>(null)
const editingFileName = ref('')
const editInputRefs = ref<Record<string, HTMLInputElement | null>>({})
const activeTab = ref('resume')

const deleteDialogVisible = ref(false)
const fileToDelete = ref<FileItem | null>(null)

const currentPhotoName = computed(() => {
  const current = store.photoFileList.find((file) => file.path === store.currentPhotoPath)
  return current?.name ?? ''
})

const otherPhotoFiles = computed(() =>
  store.photoFileList.filter((file) => file.path !== store.currentPhotoPath)
)

const handleSelectWorkspace = async () => {
  await store.selectWorkspace()
}

const handleFileClick = async (path: string) => {
  await store.openFile(path)
}

const handlePdfClick = async (path: string) => {
  try {
    await invoke('open_pdf', { path })
  } catch (error) {
    console.error('Failed to open pdf:', error)
    ElMessage.error('打开 PDF 失败')
  }
}

const handlePhotoImport = async () => {
  await store.importIdPhoto()
}

const handlePhotoClick = async (path: string) => {
  await store.selectPhoto(path)
}

const handleCreateFile = async () => {
  if (!newFileName.value.trim()) {
    return
  }

  await store.createFile(newFileName.value.trim())
  newFileName.value = ''
  isCreating.value = false
}

const startRename = async (file: FileItem) => {
  editingFileStr.value = file.path
  editingFileName.value = file.name.replace(/\.md$/, '')
  await nextTick()

  const inputEl = editInputRefs.value[file.path]
  if (inputEl) {
    if (Array.isArray(inputEl)) {
      inputEl[0]?.focus()
    } else {
      inputEl.focus()
    }
  }
}

const finishRename = async () => {
  if (!editingFileStr.value) return

  const oldPath = editingFileStr.value
  const newName = editingFileName.value.trim()

  editingFileStr.value = null
  editingFileName.value = ''

  if (newName) {
    await store.renameFile(oldPath, newName)
  }
}

const cancelRename = () => {
  editingFileStr.value = null
  editingFileName.value = ''
}

const handleContextMenu = (command: { action: string; file: FileItem }) => {
  if (command.action === 'duplicate') {
    store.duplicateFile(command.file.path)
    return
  }

  if (command.action === 'rename') {
    startRename(command.file)
    return
  }

  fileToDelete.value = command.file
  nextTick(() => {
    deleteDialogVisible.value = true
  })
}

const confirmDelete = () => {
  if (fileToDelete.value) {
    store.deleteFile(fileToDelete.value.path)
  }

  deleteDialogVisible.value = false
  fileToDelete.value = null
}
</script>

<template>
  <aside
    class="h-full bg-surface-container-lowest flex flex-col transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden z-20 flex-shrink-0 relative"
    :class="store.isSidebarOpen ? 'w-80 shadow-[4px_0_24px_rgba(0,0,0,0.03)]' : 'w-0 opacity-0'"
    :style="{ '--sidebar-accent': store.resumeStyle.themeColor }"
  >
    <el-dialog
      v-model="deleteDialogVisible"
      title="提示"
      width="260"
      :show-close="false"
      :append-to-body="false"
      class="delete-confirm-dialog"
    >
      <span class="text-sm text-on-surface">
        确定要删除 "{{ fileToDelete?.name.replace(/\.md$/, '') }}" 吗？
      </span>
      <template #footer>
        <div class="flex gap-2 justify-end">
          <el-button size="small" @click="deleteDialogVisible = false">取消</el-button>
          <el-button size="small" type="danger" @click="confirmDelete">删除</el-button>
        </div>
      </template>
    </el-dialog>

    <div class="w-80 h-full flex flex-col font-['Manrope'] antialiased absolute top-0 left-0">
      <div class="px-6 py-5 pb-2 flex justify-between items-center bg-surface-container-lowest shrink-0">
        <h2 class="text-xl font-semibold text-on-surface tracking-wide">我的简历</h2>
        <button
          @click="store.isSidebarOpen = false"
          class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-variant transition-colors group cursor-pointer"
        >
          <span class="material-symbols-outlined text-on-surface-variant group-hover:text-on-surface text-xl">close</span>
        </button>
      </div>

      <div class="px-6 pt-4 pb-3 flex flex-col gap-3 shrink-0">
        <div class="flex items-center gap-2 w-full">
          <button
            class="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-surface-container hover:bg-surface-container-highest transition-all duration-200 cursor-pointer text-sm font-medium text-on-surface shadow-sm"
            @click="handleSelectWorkspace"
          >
            <span class="material-symbols-outlined text-lg shrink-0">folder_open</span>
            <span class="truncate">更换文件夹</span>
          </button>

          <button
            v-if="store.workspacePath && !isCreating"
            class="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl transition-all duration-200 cursor-pointer text-sm font-medium shadow-sm"
            :style="{
              backgroundColor: `color-mix(in srgb, ${store.resumeStyle.themeColor} 14%, white)`,
              color: store.resumeStyle.themeColor,
            }"
            @click="isCreating = true"
          >
            <span class="material-symbols-outlined text-lg shrink-0">add</span>
            <span class="truncate">新建</span>
          </button>
        </div>

        <div
          class="px-1 text-xs leading-5 text-on-surface-variant break-all min-h-[1.5rem]"
          :title="store.workspacePath || undefined"
        >
          {{ store.workspacePath || '尚未选择工作文件夹' }}
        </div>

        <transition name="fade">
          <div
            v-if="isCreating"
            class="flex items-center gap-2 w-full bg-surface-container px-3 py-2 rounded-xl border border-primary/20 shadow-sm"
          >
            <input
              v-model="newFileName"
              @keyup.enter="handleCreateFile"
              @keyup.esc="isCreating = false"
              placeholder="文件名..."
              class="flex-1 bg-transparent border-none focus:outline-none text-sm text-on-surface min-w-0"
              autofocus
            />
            <button
              @click="isCreating = false"
              class="w-6 h-6 flex items-center justify-center rounded-md hover:bg-surface-variant transition-colors cursor-pointer shrink-0"
            >
              <span class="material-symbols-outlined text-on-surface-variant text-sm">close</span>
            </button>
          </div>
        </transition>
      </div>

      <el-tabs v-model="activeTab" class="tabs-container min-h-0 flex-1">
        <el-tab-pane label="简历" name="resume">
          <div class="h-full px-4 pb-6 pt-3">
            <div
              v-if="!store.workspacePath"
              class="h-full flex flex-col items-center justify-center text-center text-on-surface-variant gap-4 opacity-70"
            >
              <div class="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
                <span class="material-symbols-outlined text-3xl">inbox</span>
              </div>
              <p class="text-sm font-medium">尚未选择工作空间</p>
            </div>

            <div
              v-else-if="store.fileList.length === 0"
              class="h-full flex flex-col items-center justify-center text-center text-on-surface-variant gap-4 opacity-70"
            >
              <div class="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
                <span class="material-symbols-outlined text-3xl">description</span>
              </div>
              <p class="text-sm font-medium">该目录下暂无 .md 文件</p>
            </div>

            <ul v-else class="h-full flex flex-col gap-1 overflow-y-auto custom-scrollbar pr-1">
              <li
                v-for="file in store.fileList"
                :key="file.path"
                class="group relative"
              >
                <el-dropdown trigger="contextmenu" @command="handleContextMenu" class="!block w-full overflow-hidden">
                  <div
                    class="flex items-center rounded-2xl px-4 py-3 cursor-pointer transition-all duration-200 overflow-hidden"
                    :class="store.activeFilePath === file.path ? 'font-medium' : 'hover:bg-surface-container-highest text-on-surface'"
                    :style="
                      store.activeFilePath === file.path
                        ? {
                            backgroundColor: `color-mix(in srgb, ${store.resumeStyle.themeColor} 12%, white)`,
                            color: store.resumeStyle.themeColor,
                          }
                        : undefined
                    "
                    @click="handleFileClick(file.path)"
                    @dblclick="startRename(file)"
                  >
                    <div class="flex-1 min-w-0 overflow-hidden mr-2">
                      <input
                        v-if="editingFileStr === file.path"
                        :ref="(el) => { if (el) editInputRefs[file.path] = el as HTMLInputElement }"
                        v-model="editingFileName"
                        @keyup.enter="finishRename"
                        @keyup.esc="cancelRename"
                        @blur="finishRename"
                        @click.stop
                        class="bg-surface-container-highest border border-primary/30 rounded-lg px-2 py-1 focus:outline-none text-sm text-on-surface w-full"
                      />
                      <span v-else class="text-sm truncate font-medium leading-none select-none block">
                        {{ file.name.replace(/\.md$/, '') }}
                      </span>
                    </div>

                    <el-popconfirm
                      :title="`确定删除 ${file.name.replace(/\.md$/, '')} 吗？`"
                      confirm-button-text="删除"
                      cancel-button-text="取消"
                      confirm-button-type="danger"
                      @confirm="store.deleteFile(file.path)"
                    >
                      <template #reference>
                        <button
                          class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error/10 hover:text-error transition-all duration-200 shrink-0 transform scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 text-on-surface-variant"
                          @click.stop
                        >
                          <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </template>
                    </el-popconfirm>
                  </div>

                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item :command="{ action: 'duplicate', file }">
                        <span class="flex items-center gap-2">
                          <span class="material-symbols-outlined text-[18px]">content_copy</span>
                          创建副本
                        </span>
                      </el-dropdown-item>
                      <el-dropdown-item :command="{ action: 'rename', file }">
                        <span class="flex items-center gap-2">
                          <span class="material-symbols-outlined text-[18px]">edit</span>
                          重命名
                        </span>
                      </el-dropdown-item>
                      <el-dropdown-item :command="{ action: 'delete', file }" class="!text-error">
                        <span class="flex items-center gap-2">
                          <span class="material-symbols-outlined text-[18px]">delete</span>
                          删除
                        </span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </li>
            </ul>
          </div>
        </el-tab-pane>

        <el-tab-pane label="PDF" name="pdf">
          <div class="h-full px-4 pb-6 pt-3">
            <div
              v-if="!store.workspacePath"
              class="h-full flex flex-col items-center justify-center text-center text-on-surface-variant gap-4 opacity-70"
            >
              <div class="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
                <span class="material-symbols-outlined text-3xl">picture_as_pdf</span>
              </div>
              <p class="text-sm font-medium">选择工作文件夹后显示 PDF 文件</p>
            </div>

            <div
              v-else-if="store.pdfFileList.length === 0"
              class="h-full flex flex-col items-center justify-center text-center text-on-surface-variant gap-4 opacity-70"
            >
              <div class="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
                <span class="material-symbols-outlined text-3xl">picture_as_pdf</span>
              </div>
              <p class="text-sm font-medium">当前文件夹暂无 PDF 文件</p>
            </div>

            <ul v-else class="h-full flex flex-col gap-1 overflow-y-auto custom-scrollbar pr-1">
              <li
                v-for="file in store.pdfFileList"
                :key="file.path"
                class="group relative"
              >
                <div
                  class="flex items-center gap-3 rounded-2xl px-4 py-3 text-on-surface transition-colors duration-200 hover:bg-surface-container-highest/60"
                  :title="file.path"
                >
                  <button
                    class="min-w-0 flex-1 flex items-center gap-3 text-left cursor-pointer hover:text-primary transition-colors duration-200"
                    @click="handlePdfClick(file.path)"
                  >
                    <span class="material-symbols-outlined text-[20px] shrink-0 text-[#dc2626]">
                      picture_as_pdf
                    </span>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium truncate">{{ file.name }}</p>
                    </div>
                  </button>

                  <el-popconfirm
                    :title="`确定删除 ${file.name} 吗？`"
                    confirm-button-text="删除"
                    cancel-button-text="取消"
                    confirm-button-type="danger"
                    @confirm="store.deletePdf(file.path)"
                  >
                    <template #reference>
                      <button
                        class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error/10 hover:text-error transition-all duration-200 shrink-0 transform scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 text-on-surface-variant"
                        @click.stop
                      >
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </template>
                  </el-popconfirm>
                </div>
              </li>
            </ul>
          </div>
        </el-tab-pane>

        <el-tab-pane label="证件照" name="photo">
          <div class="h-full px-4 pb-6 pt-3 flex items-center justify-center text-center text-on-surface-variant">
            <div class="max-w-[220px] space-y-3 opacity-80">
              <div class="w-16 h-16 mx-auto rounded-full bg-surface-container flex items-center justify-center">
                <span class="material-symbols-outlined text-3xl">add_a_photo</span>
              </div>
              <p class="text-sm font-medium">证件照功能开发中...</p>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </aside>
</template>

<style scoped>
.tabs-container {
  display: flex;
  flex-direction: column;
}

.tabs-container :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 1rem;
  flex-shrink: 0;
}

.tabs-container :deep(.el-tabs__nav-wrap) {
  padding: 0 0.25rem;
}

.tabs-container :deep(.el-tabs__nav-wrap::after) {
  background-color: color-mix(in srgb, var(--sidebar-accent) 18%, var(--color-surface-variant));
}

.tabs-container :deep(.el-tabs__nav-scroll) {
  overflow: visible;
}

.tabs-container :deep(.el-tabs__nav) {
  display: flex;
  width: 100%;
}

.tabs-container :deep(.el-tabs__item) {
  flex: 1 1 0;
  min-width: 0;
  justify-content: center;
  padding: 0 0.5rem 0.85rem;
  height: auto;
  font-size: 0.95rem;
  color: var(--color-on-surface-variant);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tabs-container :deep(.el-tabs__item:hover),
.tabs-container :deep(.el-tabs__item.is-active) {
  color: var(--sidebar-accent);
}

.tabs-container :deep(.el-tabs__active-bar) {
  height: 3px;
  border-radius: 999px;
  background-color: var(--sidebar-accent);
}

.tabs-container :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}

.tabs-container :deep(.el-tab-pane) {
  height: 100%;
}

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
