<script setup lang="ts">
import { computed } from 'vue'
import { useResumeStore } from '../stores/resume'
import { invoke } from '@tauri-apps/api/core'
import { join } from '@tauri-apps/api/path'
import { ElMessage, ElMessageBox } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import { buildSelfContainedExportStyles } from '../utils/exportStyles'
import { getInlinePingFangFontFaceCss } from '../utils/fontAssets'

const store = useResumeStore()

const currentFileName = computed(() => {
  if (!store.activeFilePath) {
    return ''
  }

  return store.activeFilePath.split(/[/\\]/).pop()?.replace(/\.md$/, '') ?? ''
})

const currentFileStatusLabel = computed(() => {
  if (store.activeFileStatus === 'missing') {
    return '已删除'
  }

  if (store.activeFileStatus === 'conflict') {
    return '有冲突'
  }

  return ''
})

const handleExport = async () => {
  if (!store.activeFilePath || !store.workspacePath) {
    ElMessage.error('未找到当前打开的文件或工作区')
    return
  }

  store.isExporting = true
  try {
    const fileNameWithExt = store.activeFilePath.split(/[/\\]/).pop() || '简历.md'
    const documentTitle = fileNameWithExt.replace(/\.[^/.]+$/, '')
    const targetPdfName = `${documentTitle}.pdf`
    const targetPdfPath = await join(store.workspacePath, targetPdfName)

    const exists = store.pdfFileList.some((file) => file.name === targetPdfName)
    if (exists) {
      try {
        await ElMessageBox.confirm(
          `工作区已存在名为 "${targetPdfName}" 的文件，是否覆盖？`,
          '导出确认',
          {
            confirmButtonText: '覆盖',
            cancelButtonText: '取消',
            type: 'warning',
          },
        )
      } catch {
        store.isExporting = false
        return
      }
    }

    const pagesContainer = document.querySelector('.pagedjs_pages')
    if (!pagesContainer) {
      throw new Error('预览内容尚未准备好，请稍后重试。')
    }

    const styles = await buildSelfContainedExportStyles()
    const inlinePingFangFontFaceCss = await getInlinePingFangFontFaceCss()

    const exportedPagesContainer = pagesContainer.cloneNode(true) as HTMLElement
    if (!exportedPagesContainer.style.getPropertyValue('--pagedjs-page-count')) {
      exportedPagesContainer.style.setProperty(
        '--pagedjs-page-count',
        String(exportedPagesContainer.querySelectorAll('.pagedjs_page').length),
      )
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html class="light" lang="zh-CN">
      <head>
        <meta charset="utf-8">
        <title>${documentTitle}</title>
        ${styles}
        <style>
          ${inlinePingFangFontFaceCss}
          body {
            background: white !important;
            margin: 0;
            padding: 0;
          }
          .pagedjs-wrapper {
            width: 100% !important;
            align-items: flex-start !important;
          }
          .pagedjs_pages {
            display: block !important;
          }
          .pagedjs_page {
            box-shadow: none !important;
          }
        </style>
      </head>
      <body class="resume-document">
        <div class="pagedjs-wrapper">
          ${exportedPagesContainer.outerHTML}
        </div>
      </body>
      </html>
    `

    await invoke('export_pdf_command', { htmlContent, outputPath: targetPdfPath })

    if (store.workspacePath) {
      await store.refreshPdfList(store.workspacePath)
    }

    ElMessage.success(`导出成功：${targetPdfName}`)
  } catch (error: any) {
    console.error('导出失败:', error)
    // If the error is from Rust, it will be a string. 
    // If it's a desktop-side error, we present it as is.
    const errorMsg = typeof error === 'string' ? error : (error.message || JSON.stringify(error))
    ElMessage.error({
      message: `导出失败: ${errorMsg}`,
      duration: 5000,
      showClose: true
    })
  } finally {
    store.isExporting = false
  }
}
</script>

<template>
  <nav class="z-50 w-full bg-transparent font-['Manrope'] text-sm font-medium tracking-wide antialiased">
    <div class="flex h-16 items-center justify-between px-8">
      <div class="flex items-center gap-8">
        <button
          v-show="!store.isSidebarOpen"
          title="展开侧边栏"
          @click="store.isSidebarOpen = true"
          class="group flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-surface-variant"
        >
          <span
            class="material-symbols-outlined text-[30px]! text-on-surface transition-colors group-hover:text-primary"
          >
            dock_to_right
          </span>
        </button>

        <div v-if="currentFileName" class="flex min-w-0 items-center gap-3">
          <div
            class="max-w-[20rem] truncate text-base font-semibold tracking-[0.02em] text-on-surface"
            :title="currentFileName"
          >
            {{ currentFileName }}
          </div>

          <span
            v-if="currentFileStatusLabel"
            class="rounded-full bg-error/10 px-2.5 py-1 text-xs font-semibold text-error"
          >
            {{ currentFileStatusLabel }}
          </span>
        </div>
      </div>

      <div class="flex items-center gap-4">
        <button
          @click="handleExport"
          :disabled="store.isExporting"
          class="btn-primary"
        >
          <span v-if="store.isExporting" class="material-symbols-outlined animate-spin text-base">refresh</span>
          <span v-else class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">download</span>
          <span>导出为 PDF</span>
        </button>
      </div>
    </div>
  </nav>
</template>
