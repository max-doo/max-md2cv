import type { UnlistenFn } from "@tauri-apps/api/event";
import type { Ref } from "vue";
import type {
  ActiveFileStatus,
  EditorJumpRequest,
  FileItem,
  PhotoItem,
  ResumeRenderProfile,
  ResumeStyle,
  ResumeTemplate,
  SidebarPrimaryView,
} from "./types";

type InvokeFn = typeof import("@tauri-apps/api/core").invoke;
type ListenFn = typeof import("@tauri-apps/api/event").listen;
type JoinFn = typeof import("@tauri-apps/api/path").join;
type OpenDialogFn = typeof import("@tauri-apps/plugin-dialog").open;
type MessageApi = typeof import("element-plus").ElMessage;
type MessageBoxApi = typeof import("element-plus").ElMessageBox;

export interface ResumeStoreState {
  markdownContent: Ref<string>;
  availableTemplates: Ref<ResumeTemplate[]>;
  activeTemplate: Ref<string>;
  isExporting: Ref<boolean>;
  isPreviewRendering: Ref<boolean>;
  isPreviewReady: Ref<boolean>;
  templatesLoaded: Ref<boolean>;
  resumeStyle: Ref<ResumeStyle>;
  renderProfilesByFile: Ref<Record<string, ResumeRenderProfile>>;
  workspacePath: Ref<string | null>;
  fileList: Ref<FileItem[]>;
  pdfFileList: Ref<FileItem[]>;
  photoFileList: Ref<PhotoItem[]>;
  activeFilePath: Ref<string | null>;
  activeFileStatus: Ref<ActiveFileStatus>;
  isDirty: Ref<boolean>;
  pendingLocalMutationPaths: Ref<string[]>;
  sidebarPrimaryView: Ref<SidebarPrimaryView>;
  isSidebarOpen: Ref<boolean>;
  shouldShowWorkspaceDialog: Ref<boolean>;
  currentPhotoPath: Ref<string | null>;
  photoBase64: Ref<string | null>;
  editorJumpRequest: Ref<EditorJumpRequest | null>;
  editorJumpToken: Ref<number>;
  isTemplateDialogVisible: Ref<boolean>;
}

export interface ResumeStoreRuntime {
  localMutationTimers: Map<string, ReturnType<typeof setTimeout>>;
  queuedWorkspacePaths: Map<string, string>;
  queuedWorkspaceRefreshTimer: ReturnType<typeof setTimeout> | null;
  previewRenderPromise: Promise<void> | null;
  previewRenderToken: number;
  workspaceChangedUnlisten: UnlistenFn | null;
  workspaceChangedListenerPromise: Promise<UnlistenFn> | null;
  conflictPromptPromise: Promise<void> | null;
  ignoredExternalContent: { pathKey: string; content: string } | null;
}

export interface ResumeStoreBaseContext {
  state: ResumeStoreState;
  runtime: ResumeStoreRuntime;
  platform: {
    invoke: InvokeFn;
    listen: ListenFn;
    join: JoinFn;
    openDialog: OpenDialogFn;
    document: Document | undefined;
  };
  ui: {
    message: MessageApi;
    messageBox: MessageBoxApi;
  };
}
