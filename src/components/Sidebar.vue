<script setup lang="ts">
import { ref } from 'vue'
import { useResumeStore } from '../stores/resume'

const store = useResumeStore()
const newFileName = ref('')
const isCreating = ref(false)

const handleSelectWorkspace = async () => {
  await store.selectWorkspace()
}

const handleFileClick = async (path: string) => {
  await store.openFile(path)
}

const handleCreateFile = async () => {
  if (!newFileName.value.trim()) {
    return
  }
  await store.createFile(newFileName.value.trim())
  newFileName.value = ''
  isCreating.value = false
}

// Handle deletion via el-popconfirm in the template

// Ensure proper spacing and aesthetic UI with tailwind
</script>

<template>
  <aside 
    class="h-full bg-surface-container-lowest flex flex-col transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden z-20 flex-shrink-0 relative"
    :class="store.isSidebarOpen ? 'w-80 shadow-[4px_0_24px_rgba(0,0,0,0.03)]' : 'w-0 opacity-0'"
  >
    <!-- Fixed width container inside so content doesn't squeeze during animation -->
    <div class="w-80 h-full flex flex-col font-['Manrope'] antialiased absolute top-0 left-0">
      <!-- Header -->
      <div class="px-6 py-5 flex justify-between items-center bg-surface-container-lowest pb-2">
        <h2 class="text-xl font-semibold text-on-surface tracking-wide">我的简历</h2>
        <button 
          @click="store.isSidebarOpen = false"
          class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-variant transition-colors group cursor-pointer"
        >
          <span class="material-symbols-outlined text-on-surface-variant group-hover:text-on-surface text-xl">close</span>
        </button>
      </div>

      <!-- Workspace selection or Creation -->
      <div class="px-6 py-4 flex flex-col gap-3">
        <div class="flex items-center gap-2 w-full">
          <button 
            class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-highest transition-all duration-200 cursor-pointer text-sm font-medium text-on-surface shadow-sm px-2"
            @click="handleSelectWorkspace"
          >
            <span class="material-symbols-outlined text-lg">folder_open</span>
            更换文件夹
          </button>

          <button 
            v-if="store.workspacePath && !isCreating"
            class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all duration-200 cursor-pointer text-sm font-medium"
            @click="isCreating = true"
          >
            <span class="material-symbols-outlined text-lg">add</span>
            新建
          </button>
        </div>
        
        <p v-if="store.workspacePath" class="text-xs text-on-surface-variant opacity-80 truncate w-full px-1" :title="store.workspacePath">
          {{ store.workspacePath }}
        </p>

        <!-- Create Input -->
        <transition name="fade">
          <div v-if="isCreating" class="flex items-center gap-2 w-full mt-1 bg-surface-container px-3 py-2 rounded-xl border border-primary/20 shadow-sm">
            <input 
              v-model="newFileName"
              @keyup.enter="handleCreateFile"
              @keyup.esc="isCreating = false"
              placeholder="文件名..."
              class="flex-1 bg-transparent border-none focus:outline-none text-sm text-on-surface w-full"
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

      <!-- File List -->
      <div class="flex-1 overflow-y-auto px-4 pb-6 mt-2 relative">
        <div v-if="!store.workspacePath" class="flex flex-col items-center justify-center h-full text-center text-on-surface-variant gap-4 opacity-70">
          <div class="w-16 h-16 rounded-full bg-surface-container flex flex-center items-center justify-center">
            <span class="material-symbols-outlined text-3xl">inbox</span>
          </div>
          <p class="text-sm font-medium">尚未选择工作空间</p>
        </div>
        
        <div v-else-if="store.fileList.length === 0" class="flex flex-col items-center justify-center h-full text-center text-on-surface-variant gap-4 opacity-70">
          <div class="w-16 h-16 rounded-full bg-surface-container flex flex-center items-center justify-center">
            <span class="material-symbols-outlined text-3xl">description</span>
          </div>
          <p class="text-sm font-medium">该目录下暂无 .md 文件</p>
        </div>

        <ul v-else class="flex flex-col gap-0.5 pt-1">
          <li 
            v-for="file in store.fileList" 
            :key="file.path"
            class="group relative flex items-center justify-between rounded-lg px-4 py-2 cursor-pointer transition-all duration-200"
            :class="[
              store.activeFilePath === file.path 
                ? 'bg-primary-container text-on-primary-container shadow-sm' 
                : 'hover:bg-surface-container-highest text-on-surface'
            ]"
            @click="handleFileClick(file.path)"
          >
            <div class="flex items-center overflow-hidden flex-1 mr-2">
              <span class="text-sm truncate font-medium align-middle leading-none">{{ file.name.replace(/\.md$/, '') }}</span>
            </div>
            
            <!-- Actions -->
            <el-popconfirm
              :title="`确定删除 ${file.name.replace(/\.md$/, '')} 吗？`"
              confirm-button-text="删除"
              cancel-button-text="取消"
              confirm-button-type="danger"
              @confirm="store.deleteFile(file.path)"
            >
              <template #reference>
                <button 
                  class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error/10 hover:text-error transition-all duration-200 shrink-0 transform scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100"
                  :class="store.activeFilePath === file.path ? 'text-on-primary-container/70' : 'text-on-surface-variant'"
                  @click.stop
                >
                  <span class="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </template>
            </el-popconfirm>
          </li>
        </ul>
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
