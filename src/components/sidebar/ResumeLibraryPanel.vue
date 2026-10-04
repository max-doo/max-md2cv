<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useResumeStore } from '../../stores/resume'
import type { FileItem } from '../../stores/resume'

const store = useResumeStore()
const RENAME_IME_GUARD_MS = 180

const activeTab = ref<'resume' | 'export' | 'photo'>('resume')
const resumeSearchQuery = ref('')
const exportSearchQuery = ref('')

const filteredFileList = computed(() => {
  const query = resumeSearchQuery.value.trim().toLowerCase()
  if (!query) {
    return store.fileList
  }
  return store.fileList.filter((file) => {
    const displayName = file.name.replace(/\.md$/, '').toLowerCase()
    return displayName.includes(query) || file.name.toLowerCase().includes(query)
  })
})

const filteredExportFileList = computed(() => {
  const query = exportSearchQuery.value.trim().toLowerCase()
  if (!query) {
    return store.exportFileList
  }
  return store.exportFileList.filter((file) => {
    const displayName = file.name.replace(/\.[^/.]+$/, '').toLowerCase()
    return displayName.includes(query) || file.name.toLowerCase().includes(query)
  })
})

watch(() => store.workspacePath, () => {
  resumeSearchQuery.value = ''
  exportSearchQuery.value = ''
})

const editingFilePath = ref<string | null>(null)
const editingFileType = ref<'resume' | 'export'>('resume')
const editingFileName = ref('')
const isRenameComposing = ref(false)
const renameImeGuardUntil = ref(0)
const editInputRefs = ref<Record<string, HTMLInputElement | null>>({})
const deletePopoverVisible = ref(false)
const fileToDelete = ref<FileItem | null>(null)
const deleteFileType = ref<'resume' | 'export'>('resume')
const deleteTargetRef = ref<HTMLElement | null>(null)
const deletePopoverContentRef = ref<HTMLElement | null>(null)
const fileRowRefs = ref<Record<string, HTMLElement | null>>({})

const handleFileClick = async (path: string) => {
  if (editingFilePath.value === path) {
    return
  }
  await store.openFile(path)
}

const photoUrls = ref<Record<string, string>>({})

watch(() => store.photoFileList, async (newList) => {
  const currentUrls = photoUrls.value
  
  const newPaths = new Set(newList.map(p => p.path))
  for (const path of Object.keys(currentUrls)) {
    if (!newPaths.has(path)) {
      delete currentUrls[path]
    }
  }

  for (const photo of newList) {
    if (!currentUrls[photo.path]) {
      try {
        const dataUrl = await invoke<string>('read_image_as_data_url', { path: photo.path })
        currentUrls[photo.path] = dataUrl
      } catch (e) {
        console.error('Failed to load photo:', e)
      }
    }
  }
}, { immediate: true, deep: true })

const handleExportClick = async (path: string) => {
  if (editingFilePath.value === path) {
    return
  }
  await store.openExportedFile(path)
}

const handlePhotoImport = async () => {
  await store.importIdPhoto()
}

const handlePhotoSelect = async (path: string) => {
  await store.selectPhoto(path)
}

const startRename = async (file: FileItem, type: 'resume' | 'export' = 'resume') => {
  if (deletePopoverVisible.value) {
    closeDeleteConfirm()
  }
  editingFilePath.value = file.path
  editingFileType.value = type
  editingFileName.value = type === 'resume'
    ? file.name.replace(/\.md$/, '')
    : file.name.replace(/\.[^/.]+$/, '')
  isRenameComposing.value = false
  renameImeGuardUntil.value = 0
  await nextTick()
  const input = editInputRefs.value[file.path]
  if (input) {
    input.focus()
    input.select()
  }
}

const finishRename = async (options: { force?: boolean } = {}) => {
  if (!editingFilePath.value) {
    return
  }

  if (isRenameComposing.value && !options.force) {
    return
  }

  const oldPath = editingFilePath.value
  const type = editingFileType.value
  const newName = editingFileName.value.trim()

  editingFilePath.value = null
  editingFileName.value = ''
  isRenameComposing.value = false
  renameImeGuardUntil.value = 0

  if (newName) {
    if (type === 'resume') {
      await store.renameFile(oldPath, newName)
    } else if (type === 'export') {
      await store.renameExportFile(oldPath, newName)
    }
  }
}

const cancelRename = () => {
  editingFilePath.value = null
  editingFileName.value = ''
  isRenameComposing.value = false
  renameImeGuardUntil.value = 0
}

const markRenameImeGuard = () => {
  renameImeGuardUntil.value = Date.now() + RENAME_IME_GUARD_MS
}

const isRenameImeActive = () => isRenameComposing.value || Date.now() < renameImeGuardUntil.value

const handleRenameInput = (event: Event) => {
  editingFileName.value = (event.target as HTMLInputElement).value
}

const handleRenameCompositionStart = () => {
  isRenameComposing.value = true
  markRenameImeGuard()
}

const handleRenameCompositionUpdate = () => {
  markRenameImeGuard()
}

const handleRenameCompositionEnd = (event: CompositionEvent) => {
  isRenameComposing.value = false
  markRenameImeGuard()
  editingFileName.value = (event.target as HTMLInputElement).value
}

const handleRenameEnter = async (event: KeyboardEvent) => {
  if (event.isComposing || event.keyCode === 229 || isRenameImeActive()) {
    return
  }

  await finishRename({ force: true })
}

const handleRenamePointerDown = (event: PointerEvent) => {
  const currentEditingPath = editingFilePath.value
  if (!currentEditingPath) {
    return
  }

  const input = editInputRefs.value[currentEditingPath]
  if (input?.contains(event.target as Node)) {
    return
  }

  if (isRenameImeActive()) {
    return
  }

  void finishRename({ force: true })
}

watch(editingFilePath, (path) => {
  if (typeof document === 'undefined') {
    return
  }

  if (path) {
    document.addEventListener('pointerdown', handleRenamePointerDown, true)
    return
  }

  document.removeEventListener('pointerdown', handleRenamePointerDown, true)
})

const openDeleteConfirm = (file: FileItem, type: 'resume' | 'export' = 'resume') => {
  fileToDelete.value = file
  deleteFileType.value = type
  deleteTargetRef.value = fileRowRefs.value[file.path] || null
  deletePopoverVisible.value = true
}

const closeDeleteConfirm = () => {
  deletePopoverVisible.value = false
  fileToDelete.value = null
  deleteTargetRef.value = null
}

const deleteTargetDisplayName = computed(() => {
  if (!fileToDelete.value) {
    return ''
  }
  return deleteFileType.value === 'export'
    ? fileToDelete.value.name.replace(/\.[^/.]+$/, '')
    : fileToDelete.value.name.replace(/\.md$/, '')
})

const handleContextMenu = (command: { action: string; file: FileItem }) => {
  if (command.action === 'duplicate') {
    void store.duplicateFile(command.file.path)
    return
  }

  if (command.action === 'rename') {
    void startRename(command.file, 'resume')
    return
  }

  openDeleteConfirm(command.file, 'resume')
}

const handleExportContextMenu = (command: { action: string; file: any }) => {
  if (command.action === 'duplicate') {
    void store.duplicateExportFile(command.file.path)
    return
  }

  if (command.action === 'rename') {
    void startRename(command.file, 'export')
    return
  }

  openDeleteConfirm(command.file, 'export')
}

const confirmDelete = async () => {
  const target = fileToDelete.value
  const type = deleteFileType.value
  closeDeleteConfirm()

  if (target) {
    if (type === 'export') {
      await store.deleteExportFile(target.path)
    } else {
      await store.deleteFile(target.path)
    }
  }
}

const handleDeletePointerDown = (event: PointerEvent) => {
  if (!deletePopoverVisible.value) {
    return
  }

  const popoverEl = deletePopoverContentRef.value?.closest('.el-popper') || deletePopoverContentRef.value
  const targetEl = deleteTargetRef.value
  const path = event.composedPath()

  if ((popoverEl && path.includes(popoverEl)) || (targetEl && path.includes(targetEl))) {
    return
  }

  closeDeleteConfirm()
}

const handleDeleteKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && deletePopoverVisible.value) {
    closeDeleteConfirm()
  }
}

watch(deletePopoverVisible, (visible) => {
  if (typeof document === 'undefined') return

  if (visible) {
    nextTick(() => {
      document.addEventListener('pointerdown', handleDeletePointerDown, true)
      document.addEventListener('keydown', handleDeleteKeyDown)
    })
  } else {
    document.removeEventListener('pointerdown', handleDeletePointerDown, true)
    document.removeEventListener('keydown', handleDeleteKeyDown)
  }
})

watch(activeTab, () => {
  if (deletePopoverVisible.value) {
    closeDeleteConfirm()
  }
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('pointerdown', handleRenamePointerDown, true)
    document.removeEventListener('pointerdown', handleDeletePointerDown, true)
    document.removeEventListener('keydown', handleDeleteKeyDown)
  }
})
</script>

<template>
  <div class="h-full min-h-0">
    <el-popover
      :virtual-ref="deleteTargetRef"
      virtual-triggering
      :visible="deletePopoverVisible"
      placement="bottom-end"
      :width="270"
      :show-arrow="false"
      :offset="4"
      popper-class="soft-delete-popover"
      :teleported="true"
    >
      <div ref="deletePopoverContentRef" class="space-y-3 font-sans select-none">
        <div class="flex items-start gap-2.5">
          <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-error/10 text-error">
            <span class="material-symbols-outlined text-[17px]">delete</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-semibold text-on-surface">删除文件</div>
            <div class="mt-1 text-xs text-on-surface-variant break-words leading-relaxed">
              确认删除“<span class="font-medium text-on-surface">{{ deleteTargetDisplayName }}</span>”吗？
            </div>
            <div class="mt-0.5 text-[11px] text-on-surface-variant/70">
              此操作不可撤销
            </div>
          </div>
        </div>
        <div class="flex justify-end items-center gap-2 pt-0.5">
          <button
            type="button"
            class="cursor-pointer rounded-xl px-2.5 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface active:scale-95"
            @click="closeDeleteConfirm"
          >
            取消
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-xl bg-error px-3 py-1 text-xs font-semibold text-white shadow-sm transition-all hover:bg-error/90 active:scale-95"
            @click="confirmDelete"
          >
            删除
          </button>
        </div>
      </div>
    </el-popover>

    <el-tabs v-model="activeTab" class="library-tabs h-full">
      <el-tab-pane label="简历" name="resume">
        <div class="flex h-full flex-col px-1 pb-2 pt-2.5">
          <div
            v-if="!store.workspacePath"
            class="flex flex-1 flex-col items-center justify-center gap-4 text-center text-on-surface-variant opacity-70"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <span class="material-symbols-outlined text-3xl">inbox</span>
            </div>
            <p class="text-sm font-medium">请选择工作文件夹</p>
          </div>

          <div
            v-else-if="store.fileList.length === 0"
            class="flex flex-1 flex-col items-center justify-center gap-4 text-center text-on-surface-variant opacity-70"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <span class="material-symbols-outlined text-3xl">description</span>
            </div>
            <p class="text-sm font-medium">当前目录还没有 Markdown 简历</p>
          </div>

          <template v-else>
            <!-- 搜索框 -->
            <div class="mb-2 shrink-0 px-0.5">
              <div class="relative flex items-center rounded-xl bg-surface-container/60 text-on-surface transition-colors focus-within:bg-surface-container focus-within:ring-2 focus-within:ring-[var(--sidebar-accent,var(--color-primary))]/20">
                <span class="pointer-events-none flex h-8 w-8 shrink-0 items-center justify-center text-on-surface-variant/50">
                  <span class="material-symbols-outlined text-[18px]">search</span>
                </span>
                <input
                  v-model="resumeSearchQuery"
                  type="text"
                  placeholder="搜索简历…"
                  class="h-8 w-full bg-transparent pr-7 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
                  @keydown.esc="resumeSearchQuery = ''"
                  @keydown.enter.prevent
                />
                <button
                  v-if="resumeSearchQuery"
                  type="button"
                  class="absolute right-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md text-on-surface-variant/60 transition-colors hover:bg-surface-container-highest hover:text-on-surface active:scale-95"
                  title="清空"
                  aria-label="清空搜索"
                  @click="resumeSearchQuery = ''"
                >
                  <span class="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            </div>

            <!-- 无匹配状态 -->
            <div
              v-if="filteredFileList.length === 0"
              class="flex flex-1 flex-col items-center justify-center gap-2.5 py-12 text-center text-on-surface-variant"
            >
              <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-low text-on-surface-variant/60">
                <span class="material-symbols-outlined text-2xl">search_off</span>
              </div>
              <p class="text-xs font-medium text-on-surface-variant/80">未找到匹配的简历</p>
              <button
                type="button"
                class="cursor-pointer rounded-xl bg-surface-container px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-highest active:scale-95"
                @click="resumeSearchQuery = ''"
              >
                清空搜索
              </button>
            </div>

            <!-- 文件列表 -->
            <ul v-else class="sidebar-panel-scroll flex-1 min-h-0 space-y-1">
              <li v-for="file in filteredFileList" :key="file.path" class="group relative">
                <el-dropdown trigger="contextmenu" popper-class="soft-dropdown-popper" @command="handleContextMenu" class="!block w-full overflow-hidden">
                  <div
                    :ref="(el) => { fileRowRefs[file.path] = el as HTMLElement | null }"
                    class="flex cursor-pointer items-start overflow-hidden rounded-2xl px-3 py-2 transition-all duration-200"
                    :class="store.activeFilePath === file.path ? 'sidebar-accent-surface font-medium' : 'text-on-surface hover:bg-surface-container-highest'"
                    @click="handleFileClick(file.path)"
                    @dblclick="startRename(file, 'resume')"
                  >
                    <span class="sidebar-accent-text mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
                      <span class="material-symbols-outlined text-[19px]">description</span>
                    </span>

                    <div class="min-w-0 flex-1 overflow-hidden py-0.5">
                      <input
                        v-if="editingFilePath === file.path"
                        :ref="(el) => { editInputRefs[file.path] = el as HTMLInputElement | null }"
                        :value="editingFileName"
                        class="sidebar-accent-input w-full rounded-lg border bg-surface-container-highest px-2 py-1 text-xs text-on-surface"
                        @input="handleRenameInput"
                        @compositionstart="handleRenameCompositionStart"
                        @compositionupdate="handleRenameCompositionUpdate"
                        @compositionend="handleRenameCompositionEnd"
                        @keydown.stop
                        @keydown.enter.prevent="handleRenameEnter"
                        @keyup.stop
                        @keyup.esc.prevent="cancelRename"
                        @click.stop
                      />
                      <span
                        v-else
                        class="block line-clamp-2 break-all text-sm font-medium leading-snug select-none"
                        :title="file.name.replace(/\.md$/, '')"
                      >
                        {{ file.name.replace(/\.md$/, '') }}
                      </span>
                    </div>

                    <button
                      v-if="editingFilePath !== file.path"
                      class="mt-0.5 ml-1 flex h-6 w-6 shrink-0 scale-90 cursor-pointer items-center justify-center rounded-lg text-on-surface-variant opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 hover:bg-surface-container hover:text-on-surface active:scale-95"
                      title="重命名"
                      aria-label="重命名"
                      @click.stop="startRename(file, 'resume')"
                    >
                      <span class="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                  </div>

                  <template #dropdown>
                    <el-dropdown-menu class="soft-dropdown-menu">
                      <el-dropdown-item :command="{ action: 'duplicate', file }">
                        <span class="flex items-center gap-2">
                          <span class="material-symbols-outlined text-[18px]">content_copy</span>
                          复制
                        </span>
                      </el-dropdown-item>
                      <el-dropdown-item :command="{ action: 'rename', file }">
                        <span class="flex items-center gap-2">
                          <span class="material-symbols-outlined text-[18px]">edit</span>
                          重命名
                        </span>
                      </el-dropdown-item>
                      <el-dropdown-item :command="{ action: 'delete', file }" class="soft-dropdown-item-danger">
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
          </template>
        </div>
      </el-tab-pane>

      <el-tab-pane label="导出" name="export">
        <div class="flex h-full flex-col px-1 pb-2 pt-2.5">
          <div
            v-if="!store.workspacePath"
            class="flex flex-1 flex-col items-center justify-center gap-4 text-center text-on-surface-variant opacity-70"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <span class="material-symbols-outlined text-3xl">folder_zip</span>
            </div>
            <p class="text-sm font-medium">请选择工作文件夹以查看导出文件</p>
          </div>

          <div
            v-else-if="store.exportFileList.length === 0"
            class="flex flex-1 flex-col items-center justify-center gap-4 text-center text-on-surface-variant opacity-70"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <span class="material-symbols-outlined text-3xl">folder_zip</span>
            </div>
            <p class="text-sm font-medium">当前目录还没有导出文件</p>
          </div>

          <template v-else>
            <!-- 搜索框 -->
            <div class="mb-2 shrink-0 px-0.5">
              <div class="relative flex items-center rounded-xl bg-surface-container/60 text-on-surface transition-colors focus-within:bg-surface-container focus-within:ring-2 focus-within:ring-[var(--sidebar-accent,var(--color-primary))]/20">
                <span class="pointer-events-none flex h-8 w-8 shrink-0 items-center justify-center text-on-surface-variant/50">
                  <span class="material-symbols-outlined text-[18px]">search</span>
                </span>
                <input
                  v-model="exportSearchQuery"
                  type="text"
                  placeholder="搜索导出文件…"
                  class="h-8 w-full bg-transparent pr-7 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
                  @keydown.esc="exportSearchQuery = ''"
                  @keydown.enter.prevent
                />
                <button
                  v-if="exportSearchQuery"
                  type="button"
                  class="absolute right-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md text-on-surface-variant/60 transition-colors hover:bg-surface-container-highest hover:text-on-surface active:scale-95"
                  title="清空"
                  aria-label="清空搜索"
                  @click="exportSearchQuery = ''"
                >
                  <span class="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            </div>

            <!-- 无匹配状态 -->
            <div
              v-if="filteredExportFileList.length === 0"
              class="flex flex-1 flex-col items-center justify-center gap-2.5 py-12 text-center text-on-surface-variant"
            >
              <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-low text-on-surface-variant/60">
                <span class="material-symbols-outlined text-2xl">search_off</span>
              </div>
              <p class="text-xs font-medium text-on-surface-variant/80">未找到匹配的导出文件</p>
              <button
                type="button"
                class="cursor-pointer rounded-xl bg-surface-container px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-highest active:scale-95"
                @click="exportSearchQuery = ''"
              >
                清空搜索
              </button>
            </div>

            <!-- 文件列表 -->
            <ul v-else class="sidebar-panel-scroll flex-1 min-h-0 space-y-1">
              <li v-for="file in filteredExportFileList" :key="file.path" class="group relative">
                <el-dropdown trigger="contextmenu" popper-class="soft-dropdown-popper" @command="handleExportContextMenu" class="!block w-full overflow-hidden">
                  <div
                    :ref="(el) => { fileRowRefs[file.path] = el as HTMLElement | null }"
                    class="flex cursor-pointer items-start overflow-hidden rounded-2xl px-3 py-2 text-on-surface transition-all duration-200 hover:bg-surface-container-highest"
                    @click="handleExportClick(file.path)"
                    @dblclick="startRename(file, 'export')"
                  >
                    <span
                      v-if="file.fileType === 'pdf'"
                      class="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-[#dc2626]"
                      title="PDF 文档"
                    >
                      <span class="material-symbols-outlined text-[19px]">picture_as_pdf</span>
                    </span>
                    <span
                      v-else
                      class="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-primary"
                      title="简历图片"
                    >
                      <span class="material-symbols-outlined text-[19px]">image</span>
                    </span>

                    <div class="min-w-0 flex-1 overflow-hidden py-0.5">
                      <input
                        v-if="editingFilePath === file.path"
                        :ref="(el) => { editInputRefs[file.path] = el as HTMLInputElement | null }"
                        :value="editingFileName"
                        class="sidebar-accent-input w-full rounded-lg border bg-surface-container-highest px-2 py-1 text-xs text-on-surface"
                        @input="handleRenameInput"
                        @compositionstart="handleRenameCompositionStart"
                        @compositionupdate="handleRenameCompositionUpdate"
                        @compositionend="handleRenameCompositionEnd"
                        @keydown.stop
                        @keydown.enter.prevent="handleRenameEnter"
                        @keyup.stop
                        @keyup.esc.prevent="cancelRename"
                        @click.stop
                      />
                      <span
                        v-else
                        class="block line-clamp-2 break-all text-sm font-medium leading-snug select-none"
                        :title="file.name.replace(/\.[^/.]+$/, '')"
                      >
                        {{ file.name.replace(/\.[^/.]+$/, '') }}
                      </span>
                    </div>

                    <button
                      v-if="editingFilePath !== file.path"
                      class="mt-0.5 ml-1 flex h-6 w-6 shrink-0 scale-90 cursor-pointer items-center justify-center rounded-lg text-on-surface-variant opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 hover:bg-surface-container hover:text-on-surface active:scale-95"
                      title="重命名"
                      aria-label="重命名"
                      @click.stop="startRename(file, 'export')"
                    >
                      <span class="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                  </div>

                  <template #dropdown>
                    <el-dropdown-menu class="soft-dropdown-menu">
                      <el-dropdown-item :command="{ action: 'duplicate', file }">
                        <span class="flex items-center gap-2">
                          <span class="material-symbols-outlined text-[18px]">content_copy</span>
                          复制
                        </span>
                      </el-dropdown-item>
                      <el-dropdown-item :command="{ action: 'rename', file }">
                        <span class="flex items-center gap-2">
                          <span class="material-symbols-outlined text-[18px]">edit</span>
                          重命名
                        </span>
                      </el-dropdown-item>
                      <el-dropdown-item :command="{ action: 'delete', file }" class="soft-dropdown-item-danger">
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
          </template>
        </div>
      </el-tab-pane>

      <el-tab-pane label="证件照" name="photo">
        <div class="h-full px-1 pb-2 pt-3">
          <div
            v-if="!store.workspacePath"
            class="flex h-full flex-col items-center justify-center gap-4 text-center text-on-surface-variant opacity-70"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <span class="material-symbols-outlined text-3xl">add_a_photo</span>
            </div>
            <p class="text-sm font-medium">请选择工作文件夹以上传证件照</p>
          </div>

          <div v-else class="sidebar-panel-scroll h-full pr-1">
            <div class="flex flex-col gap-4 pb-2">
            <button
              class="sidebar-accent-surface w-full cursor-pointer rounded-2xl py-2.5 text-sm font-medium shadow-sm transition-all duration-200"
              @click="handlePhotoImport"
            >
              <span class="flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-lg">upload</span>
                <span>上传证件照</span>
              </span>
            </button>

            <div v-if="store.photoFileList.length === 0" class="flex flex-col items-center justify-center gap-4 py-8 text-center text-on-surface-variant opacity-70">
              <div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
                <span class="material-symbols-outlined text-3xl">gallery_thumbnail</span>
              </div>
              <p class="text-sm font-medium">当前目录还没有证件照</p>
              <p class="max-w-[200px] text-xs leading-5">
                导入后会保存在当前工作文件夹，<br/>并按 <code>IDphoto</code> 这类名称自动管理。
              </p>
            </div>

            <ul v-else class="grid grid-cols-2 gap-3 mt-2">
              <li v-for="photo in store.photoFileList" :key="photo.path" class="group relative">
                <div class="flex flex-col gap-1.5 cursor-pointer" @click="handlePhotoSelect(photo.path)">
                  <div
                    class="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border-[2px] transition-all duration-200"
                    :class="photo.path === store.currentPhotoPath ? 'border-[var(--sidebar-accent,var(--color-primary))] shadow-sm' : 'border-black/5 hover:border-black/10 dark:border-white/5 dark:hover:border-white/10'"
                  >
                    <img v-if="photoUrls[photo.path]" :src="photoUrls[photo.path]" class="absolute inset-0 h-full w-full bg-surface-container-lowest object-cover transition-transform duration-300 group-hover:scale-105" />
                    <div v-else class="absolute inset-0 flex h-full w-full flex-col items-center justify-center bg-surface-container-lowest text-on-surface-variant opacity-50">
                      <span class="material-symbols-outlined mb-1 text-2xl">image</span>
                    </div>
                    
                    <div v-if="photo.path === store.currentPhotoPath" class="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--sidebar-accent,var(--color-primary))] text-white shadow-sm ring-2 ring-white">
                      <span class="material-symbols-outlined text-[14px]">check</span>
                    </div>

                    <el-popconfirm
                      :title="`确认删除 ${photo.name} 吗？`"
                      confirm-button-text="删除"
                      cancel-button-text="取消"
                      confirm-button-type="danger"
                      popper-class="soft-delete-popover"
                      @confirm="store.deletePhoto(photo.path)"
                    >
                      <template #reference>
                        <button
                          class="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg bg-surface/90 text-on-surface shadow-sm opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:opacity-100 hover:bg-error hover:text-white"
                          @click.stop
                        >
                          <span class="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </template>
                    </el-popconfirm>
                  </div>
                  <div class="px-1 text-center">
                    <p class="truncate text-[12px] font-medium text-on-surface/90" :title="photo.name">{{ photo.name }}</p>
                  </div>
                </div>
              </li>
            </ul>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.library-tabs {
  display: flex;
  flex-direction: column;
}

.library-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 0.25rem;
  flex-shrink: 0;
}

.library-tabs :deep(.el-tabs__nav-wrap) {
  padding: 0 0.25rem;
}

.library-tabs :deep(.el-tabs__nav-wrap::after) {
  background-color: color-mix(in srgb, var(--sidebar-accent, var(--color-primary)) 18%, var(--color-surface-variant));
}

.library-tabs :deep(.el-tabs__nav-scroll) {
  overflow: visible;
}

.library-tabs :deep(.el-tabs__nav) {
  display: flex;
  width: 100%;
}

.library-tabs :deep(.el-tabs__item) {
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

.library-tabs :deep(.el-tabs__item:hover),
.library-tabs :deep(.el-tabs__item.is-active) {
  color: var(--sidebar-accent, var(--color-primary));
}

.library-tabs :deep(.el-tabs__active-bar) {
  height: 3px;
  border-radius: 999px;
  background-color: var(--sidebar-accent, var(--color-primary));
}

.library-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}

.library-tabs :deep(.el-tab-pane) {
  height: 100%;
}

:global(.soft-delete-popover.el-popover.el-popper),
:global(.soft-delete-popover.el-popper) {
  border: none !important;
  border-radius: 1rem !important;
  background-color: color-mix(in srgb, var(--color-surface-container-lowest) 96%, white) !important;
  box-shadow: var(--shadow-ambient) !important;
  padding: 0.75rem 0.875rem !important;
}

:global(.soft-delete-popover .el-popper__arrow::before) {
  border: none !important;
  background-color: color-mix(in srgb, var(--color-surface-container-lowest) 96%, white) !important;
}

:global(.soft-delete-popover .el-popconfirm__main) {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-on-surface);
}

:global(.soft-delete-popover .el-popconfirm__action) {
  margin-top: 0.625rem;
}
</style>
