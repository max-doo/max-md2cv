<script setup lang="ts">
import TopNavBar from './components/TopNavBar.vue'
import EditorPane from './components/EditorPane.vue'
import PreviewPane from './components/PreviewPane.vue'
</script>

<template>
  <div class="bg-surface text-on-surface antialiased flex items-center justify-center min-h-screen">
    <!-- 16:9 Aspect Ratio Container per design specs -->
    <div class="w-full max-w-[1600px] aspect-[16/9] mx-auto relative flex flex-col overflow-hidden bg-surface max-h-screen">
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
</style>