<script setup lang="ts">
import { useResumeStore } from '../stores/resume';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { ElMessage } from 'element-plus';
import 'element-plus/es/components/message/style/css';

const store = useResumeStore();

const handleExport = async () => {
  store.isExporting = true;
  try {
    const filePath = await save({
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      defaultPath: '简历.pdf'
    });
    
    if (!filePath) return;
    
    const pagesContainer = document.querySelector('.pagedjs_pages');
    if (!pagesContainer) {
      throw new Error("预览内容尚未准备好，请稍等解析完成");
    }
    
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('\n');
      
    const htmlContent = `
      <!DOCTYPE html>
      <html class="light" lang="zh-CN">
      <head>
        <meta charset="utf-8">
        ${styles}
        <style>
          body { 
            background: white !important; 
            margin: 0; padding: 0; 
          }
          .pagedjs-wrapper { 
            width: 100% !important; 
            align-items: flex-start !important; 
          }
          /* Only show the page container itself for print */
          .pagedjs_pages {
             display: block !important;
          }
          .pagedjs_page {
             box-shadow: none !important; /* Remove screen wrapper shadow */
          }
        </style>
      </head>
      <body>
        <div class="pagedjs-wrapper">
          <div class="pagedjs_pages">
            ${pagesContainer.innerHTML}
          </div>
        </div>
      </body>
      </html>
    `;
    
    await invoke('export_pdf_command', { htmlContent, outputPath: filePath });
    
    ElMessage.success(`导出成功`);
    
  } catch (error: any) {
    console.error("导出失败:", error);
    ElMessage.error(`导出失败: ${error}`);
  } finally {
    store.isExporting = false;
  }
};
</script>

<template>
  <nav class="w-full z-50 bg-transparent font-['Manrope'] antialiased tracking-wide text-sm font-medium">
    <div class="flex justify-between items-center h-16 px-8">
      <div class="flex items-center gap-8">
        <!-- Graphical Icon Logo -->
        <div class="flex items-center justify-center w-10 h-10 bg-primary rounded-xl shadow-lg shadow-primary/20">
          <span class="material-symbols-outlined text-white text-2xl" style="font-variation-settings: 'FILL' 1;">description</span>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <button 
          @click="handleExport"
          :disabled="store.isExporting"
          class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary-container text-white rounded-full font-bold shadow-lg hover:shadow-primary/20 active:scale-95 transition-all text-xs disabled:opacity-50"
        >
          <span v-if="store.isExporting" class="material-symbols-outlined animate-spin text-base">refresh</span>
          <span v-else class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">download</span>
          <span>导出为 PDF</span>
        </button>
      </div>
    </div>
  </nav>
</template>
