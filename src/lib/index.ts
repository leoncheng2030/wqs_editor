import CanvasEditor from '../canvas-editor/CanvasEditor.vue'
import MarkdownPreviewPanel from '../canvas-editor/MarkdownPreviewPanel.vue'
import EditorConfig from '../canvas-editor/EditorConfig.vue'

// 只使用命名导出，避免混用命名和默认导出
export { CanvasEditor, MarkdownPreviewPanel, EditorConfig }

// 为了向后兼容，将主编辑器也命名导出为 VueMarkdownEditor
export { CanvasEditor as VueMarkdownEditor }
