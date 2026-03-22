import { defineStore } from "pinia";
import { ref } from "vue";

export const useResumeStore = defineStore("resume", () => {
  const markdownContent = ref(`# 张晓明 (Xiao Ming Zhang)
Product Designer | 上海市

## 联系方式
- 电话: 138-0000-0000
- 邮箱: xiaoming.z@email.com
- 网站: portfolio.xiaoming.com

## 工作经历
### 智能科技有限责任公司 | 资深产品设计师 | 2021.06 - 至今
- 负责公司核心 AI 产品的 UI/UX 设计，提升了 40% 的用户留存率。
- 建立并维护跨平台的设计系统，减少了 30% 的开发交付时间。
- 协调多方团队进行用户调研，深度洞察用户需求。

### 未来实验室 | UI 设计师 | 2018.05 - 2021.05
- 主导了移动端 App 3.0 版本的重构，获得苹果应用商店推荐。
- 优化了入职流程体验，转化率提高 15%。

## 教育背景
### 同济大学 | 工业设计 | 学士学位 | 2014 - 2018

## 专业技能
- **设计工具**: Figma, Adobe Creative Suite, Framer
- **前端知识**: HTML/CSS, Tailwind CSS, Javascript
- **语言能力**: 中文 (母语), 英语 (专业)`);

  const activeTemplate = ref("modern");
  const isExporting = ref(false);

  return {
    markdownContent,
    activeTemplate,
    isExporting,
  };
});
