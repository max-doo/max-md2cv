<script setup lang="ts">
import { computed, ref } from 'vue'
import { useResumeStore } from '../stores/resume'
import ResumeLibraryPanel from './sidebar/ResumeLibraryPanel.vue'
import ResumeOutlinePanel from './sidebar/ResumeOutlinePanel.vue'

const store = useResumeStore()

const newFileName = ref('')
const isCreating = ref(false)

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
    class="relative z-20 flex h-full flex-shrink-0 flex-col overflow-hidden bg-surface-container-lowest transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
    :class="store.isSidebarOpen ? 'w-80 shadow-[4px_0_24px_rgba(0,0,0,0.03)]' : 'w-0 opacity-0'"
    :style="{ '--sidebar-accent': store.resumeStyle.themeColor }"
  >
    <div class="absolute left-0 top-0 flex h-full w-80 flex-col font-['Manrope'] antialiased">
      <div class="flex items-center gap-3 bg-surface-container-lowest px-4 py-5 pb-4 shrink-0">
        <div class="min-w-0 flex-1">
          <div class="sidebar-segmented">
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
        </div>
        <button
          class="group flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-surface-variant"
          @click="store.isSidebarOpen = false"
        >
          <span class="material-symbols-outlined text-xl text-on-surface-variant group-hover:text-on-surface">close</span>
        </button>
      </div>

      <div class="min-h-0 flex-1 px-4 pb-6">
        <ResumeLibraryPanel v-if="store.sidebarPrimaryView === 'library'" />
        <ResumeOutlinePanel v-else />
      </div>

      <div class="flex flex-col gap-3 border-t border-black/5 bg-surface-container-lowest px-6 pb-5 pt-3 shrink-0">
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

        <transition name="fade">
          <div
            v-if="isCreating"
            class="flex w-full items-center gap-2 rounded-xl border border-primary/20 bg-surface-container px-3 py-2 shadow-sm"
          >
            <input
              v-model="newFileName"
              autofocus
              placeholder="输入文件名..."
              class="min-w-0 flex-1 border-none bg-transparent text-sm text-on-surface focus:outline-none"
              @keyup.enter="handleCreateFile"
              @keyup.esc="closeCreateFile"
            />
            <button
              class="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-variant"
              @click="closeCreateFile"
            >
              <span class="material-symbols-outlined text-sm text-on-surface-variant">close</span>
            </button>
          </div>
        </transition>

        <div class="flex w-full items-center gap-2">
          <button
            class="flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-surface-container px-3 py-2.5 text-sm font-medium text-on-surface shadow-sm transition-all duration-200 hover:bg-surface-container-highest"
            @click="handleSelectWorkspace"
          >
            <span class="material-symbols-outlined shrink-0 text-lg">folder_open</span>
            <span class="truncate">更换文件夹</span>
          </button>

          <button
            v-if="store.workspacePath && !isCreating"
            class="flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium shadow-sm transition-all duration-200"
            :style="{
              backgroundColor: `color-mix(in srgb, ${store.resumeStyle.themeColor} 14%, white)`,
              color: store.resumeStyle.themeColor,
            }"
            @click="openCreateFile"
          >
            <span class="material-symbols-outlined shrink-0 text-lg">add</span>
            <span class="truncate">新建</span>
          </button>
        </div>
      </div>
    </div>
  </aside>
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
