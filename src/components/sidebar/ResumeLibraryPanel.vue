<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { invoke } from '@tauri-apps/api/core'
import { useResumeStore } from '../../stores/resume'
import type { FileItem } from '../../stores/resume'

const store = useResumeStore()
const RENAME_IME_GUARD_MS = 180

const activeTab = ref<'resume' | 'pdf' | 'photo'>('resume')
const editingFilePath = ref<string | null>(null)
const editingFileType = ref<'resume' | 'pdf'>('resume')
const editingFileName = ref('')
const isRenameComposing = ref(false)
const renameImeGuardUntil = ref(0)
const editInputRefs = ref<Record<string, HTMLInputElement | null>>({})
const deleteDialogVisible = ref(false)
const fileToDelete = ref<FileItem | null>(null)
const deleteFileType = ref<'resume' | 'pdf'>('resume')

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

const handlePdfClick = async (path: string) => {
  if (editingFilePath.value === path) {
    return
  }
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

const handlePhotoSelect = async (path: string) => {
  await store.selectPhoto(path)
}

const startRename = async (file: FileItem, type: 'resume' | 'pdf' = 'resume') => {
  editingFilePath.value = file.path
  editingFileType.value = type
  editingFileName.value = type === 'resume'
    ? file.name.replace(/\.md$/, '')
    : file.name.replace(/\.pdf$/i, '')
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
    } else if (type === 'pdf') {
      await store.renamePdf(oldPath, newName)
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

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('pointerdown', handleRenamePointerDown, true)
  }
})

const openDeleteDialog = (file: FileItem, type: 'resume' | 'pdf' = 'resume') => {
  fileToDelete.value = file
  deleteFileType.value = type
  deleteDialogVisible.value = true
}

const deleteTargetDisplayName = computed(() => {
  if (!fileToDelete.value) {
    return ''
  }
  return deleteFileType.value === 'pdf'
    ? fileToDelete.value.name.replace(/\.pdf$/i, '')
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

  openDeleteDialog(command.file, 'resume')
}

const handlePdfContextMenu = (command: { action: string; file: FileItem }) => {
  if (command.action === 'duplicate') {
    void store.duplicatePdf(command.file.path)
    return
  }

  if (command.action === 'rename') {
    void startRename(command.file, 'pdf')
    return
  }

  openDeleteDialog(command.file, 'pdf')
}

const confirmDelete = async () => {
  if (fileToDelete.value) {
    if (deleteFileType.value === 'pdf') {
      await store.deletePdf(fileToDelete.value.path)
    } else {
      await store.deleteFile(fileToDelete.value.path)
    }
  }

  deleteDialogVisible.value = false
  fileToDelete.value = null
}
</script>

<template>
  <div class="h-full min-h-0">
    <el-dialog
      v-model="deleteDialogVisible"
      title="删除文件"
      width="260"
      :show-close="false"
      :append-to-body="false"
      class="delete-confirm-dialog"
    >
      <span class="text-sm text-on-surface">
        确认删除“{{ deleteTargetDisplayName }}”吗？
      </span>
      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button size="small" @click="deleteDialogVisible = false">取消</el-button>
          <el-button size="small" type="danger" @click="confirmDelete">删除</el-button>
        </div>
      </template>
    </el-dialog>

    <el-tabs v-model="activeTab" class="library-tabs h-full">
      <el-tab-pane label="简历" name="resume">
        <div class="h-full px-1 pb-2 pt-3">
          <div
            v-if="!store.workspacePath"
            class="flex h-full flex-col items-center justify-center gap-4 text-center text-on-surface-variant opacity-70"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <span class="material-symbols-outlined text-3xl">inbox</span>
            </div>
            <p class="text-sm font-medium">请选择工作文件夹</p>
          </div>

          <div
            v-else-if="store.fileList.length === 0"
            class="flex h-full flex-col items-center justify-center gap-4 text-center text-on-surface-variant opacity-70"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <span class="material-symbols-outlined text-3xl">description</span>
            </div>
            <p class="text-sm font-medium">当前目录还没有 Markdown 简历</p>
          </div>

          <ul v-else class="sidebar-panel-scroll space-y-1">
            <li v-for="file in store.fileList" :key="file.path" class="group relative">
              <el-dropdown trigger="contextmenu" popper-class="soft-dropdown-popper" @command="handleContextMenu" class="!block w-full overflow-hidden">
                <div
                  class="flex cursor-pointer items-center overflow-hidden rounded-2xl px-4 py-2.5 transition-all duration-200"
                  :class="store.activeFilePath === file.path ? 'sidebar-accent-surface font-medium' : 'text-on-surface hover:bg-surface-container-highest'"
                  @click="handleFileClick(file.path)"
                  @dblclick="startRename(file, 'resume')"
                >
                  <span class="sidebar-accent-text mr-2 flex h-8 w-8 shrink-0 items-center justify-center">
                    <span class="material-symbols-outlined text-[20px]">description</span>
                  </span>

                  <div class="mr-2 min-w-0 flex-1 overflow-hidden">
                    <input
                      v-if="editingFilePath === file.path"
                      :ref="(el) => { editInputRefs[file.path] = el as HTMLInputElement | null }"
                      :value="editingFileName"
                      class="sidebar-accent-input w-full rounded-lg border bg-surface-container-highest px-2 py-1 text-sm text-on-surface"
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
                      class="block truncate text-sm font-medium leading-none select-none"
                      :title="file.name.replace(/\.md$/, '')"
                    >
                      {{ file.name.replace(/\.md$/, '') }}
                    </span>
                  </div>

                  <button
                    v-if="editingFilePath !== file.path"
                    class="flex h-8 w-8 shrink-0 scale-90 cursor-pointer items-center justify-center rounded-lg text-on-surface-variant opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 hover:bg-surface-container hover:text-on-surface active:scale-95"
                    title="重命名"
                    aria-label="重命名"
                    @click.stop="startRename(file, 'resume')"
                  >
                    <span class="material-symbols-outlined text-[18px]">edit</span>
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
        </div>
      </el-tab-pane>

      <el-tab-pane label="PDF" name="pdf">
        <div class="h-full px-1 pb-2 pt-3">
          <div
            v-if="!store.workspacePath"
            class="flex h-full flex-col items-center justify-center gap-4 text-center text-on-surface-variant opacity-70"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <span class="material-symbols-outlined text-3xl">picture_as_pdf</span>
            </div>
            <p class="text-sm font-medium">请选择工作文件夹以查看 PDF</p>
          </div>

          <div
            v-else-if="store.pdfFileList.length === 0"
            class="flex h-full flex-col items-center justify-center gap-4 text-center text-on-surface-variant opacity-70"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <span class="material-symbols-outlined text-3xl">picture_as_pdf</span>
            </div>
            <p class="text-sm font-medium">当前目录还没有 PDF 文件</p>
          </div>

          <ul v-else class="sidebar-panel-scroll space-y-1">
            <li v-for="file in store.pdfFileList" :key="file.path" class="group relative">
              <el-dropdown trigger="contextmenu" popper-class="soft-dropdown-popper" @command="handlePdfContextMenu" class="!block w-full overflow-hidden">
                <div
                  class="flex cursor-pointer items-center overflow-hidden rounded-2xl px-4 py-2.5 text-on-surface transition-all duration-200 hover:bg-surface-container-highest"
                  @click="handlePdfClick(file.path)"
                  @dblclick="startRename(file, 'pdf')"
                >
                  <span class="mr-2 flex h-8 w-8 shrink-0 items-center justify-center text-[#dc2626]">
                    <span class="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                  </span>

                  <div class="mr-2 min-w-0 flex-1 overflow-hidden">
                    <input
                      v-if="editingFilePath === file.path"
                      :ref="(el) => { editInputRefs[file.path] = el as HTMLInputElement | null }"
                      :value="editingFileName"
                      class="sidebar-accent-input w-full rounded-lg border bg-surface-container-highest px-2 py-1 text-sm text-on-surface"
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
                      class="block truncate text-sm font-medium leading-none select-none"
                      :title="file.name.replace(/\.pdf$/i, '')"
                    >
                      {{ file.name.replace(/\.pdf$/i, '') }}
                    </span>
                  </div>

                  <button
                    v-if="editingFilePath !== file.path"
                    class="flex h-8 w-8 shrink-0 scale-90 cursor-pointer items-center justify-center rounded-lg text-on-surface-variant opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 hover:bg-surface-container hover:text-on-surface active:scale-95"
                    title="重命名"
                    aria-label="重命名"
                    @click.stop="startRename(file, 'pdf')"
                  >
                    <span class="material-symbols-outlined text-[18px]">edit</span>
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

</style>
