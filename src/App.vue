<script setup lang="ts">
import TopNavBar from './components/TopNavBar.vue'
import EditorPane from './components/EditorPane.vue'
import PreviewPane from './components/PreviewPane.vue'
import Sidebar from './components/Sidebar.vue'
import { useResumeStore } from './stores/resume'

const store = useResumeStore()
</script>

<template>
  <div class="bg-surface text-on-surface antialiased w-full h-screen relative flex overflow-hidden font-['Manrope']">
    
    <!-- Workspace Selection Overlay -->
    <transition name="fade-overlay">
      <div v-if="store.shouldShowWorkspaceDialog" class="absolute inset-0 z-[100] flex items-center justify-center bg-surface/10 backdrop-blur-xl">
        <div class="max-w-md w-full p-12 card-soft shadow-ambient text-center flex flex-col items-center gap-8 border border-primary/10 animate-in fade-in zoom-in duration-500">
           <div class="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
             <span class="material-symbols-outlined text-4xl">folder_managed</span>
           </div>
           
           <div class="space-y-2">
             <h2 class="text-2xl font-bold text-on-surface tracking-tight">开启你的简历编辑之旅</h2>
             <p class="text-on-surface-variant text-sm leading-relaxed px-4">
               欢迎使用 Max-MD2CV。在开始编辑之前，请选择一个文件夹作为你的简历工作空间。
             </p>
           </div>

           <button 
             @click="store.selectWorkspace()"
             class="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 group"
           >
             <span class="material-symbols-outlined group-hover:rotate-12 transition-transform">folder_open</span>
             选择本地工作文件夹
           </button>
           
           <p class="text-[11px] text-outline opacity-60">选择文件夹后，应用将自动加载其中的简历文件</p>
        </div>
      </div>
    </transition>

    <!-- Sidebar (Left) -->
    <Sidebar :class="{ 'blur-md pointer-events-none opacity-40 transition-all duration-700': store.shouldShowWorkspaceDialog }" />

    <!-- Main Content Area (Right) -->
    <div 
      class="flex-1 flex flex-col h-full overflow-hidden bg-surface relative transition-all duration-700"
      :class="{ 'blur-md pointer-events-none opacity-20 scale-[0.98]': store.shouldShowWorkspaceDialog }"
    >
      <TopNavBar />
      <main class="flex-1 flex overflow-hidden px-6 pb-6 pt-2 gap-4">
          <!-- Card 1: Markdown Editor (40%) -->
          <EditorPane class="w-[40%]" />
          
          <!-- Card 2: PDF Preview (60%) -->
          <PreviewPane class="w-[60%]" />
      </main>
    </div>
  </div>
</template>

<style>
/* Global styles */

/* 隐藏 el-color-picker 弹出面板底部的 Clear / OK 按钮，保留 Hex 输入框 */
.el-color-dropdown__btns .el-button {
  display: none !important;
}

.fade-overlay-enter-active,
.fade-overlay-leave-active {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-overlay-enter-from,
.fade-overlay-leave-to {
  opacity: 0;
  backdrop-filter: blur(0px);
}

.fade-overlay-enter-to,
.fade-overlay-leave-from {
  opacity: 1;
  backdrop-filter: blur(20px);
}

</style>