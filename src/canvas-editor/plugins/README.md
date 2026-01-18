# Canvas Editor 插件系统

## 概述

Canvas Editor 提供了强大的插件系统，允许开发者扩展编辑器功能。

## 核心特性

- 🔌 **易于扩展**：基于事件驱动的插件架构
- ⚡ **生命周期钩子**：beforeInit, afterInit, beforeRender等
- ⌨️ **命令系统**：注册自定义命令和快捷键
- 🎨 **工具栏集成**：插件可以添加工具栏按钮
- 🧩 **模块化**：插件可以独立开发和分发

## 内置插件

### 1. Markdown表格插件 (markdown-table)

提供完整的Markdown表格支持。

**功能**：
- ✅ 插入表格 (Ctrl+Shift+T)
- ✅ 格式化表格 (Ctrl+Shift+F)
- ✅ 添加行/列
- ✅ 自动对齐

**使用方式**：
```javascript
// 在工具栏点击表格按钮
// 或使用快捷键 Ctrl+Shift+T
```

### 2. 任务列表插件 (todo-list)

支持Markdown标准的任务列表语法。

**功能**：
- ✅ 插入任务项
- ✅ 切换任务状态 (Ctrl+Shift+X)
- ✅ Checkbox 支持

### 3. 数学公式插件 (math)

使用KaTeX渲染数学公式。

**功能**：
- ✅ 行内公式 `$...$`
- ✅ 块级公式 `$$...$$`
- ✅ LaTeX 语法支持

### 4. 流程图插件 (mermaid)

使用Mermaid渲染各种图表。

**功能**：
- ✅ 流程图 (flowchart)
- ✅ 时序图 (sequence)
- ✅ 甘特图 (gantt)

### 5. 代码补全插件 (autocomplete) ⭐

智能代码补全，提高编辑效率。

**功能**：
- ✅ Markdown语法补全（标题、列表、代码块等）
- ✅ Emoji补全 (`:smile:` → 😊)
- ✅ 代码片段补全
- ✅ 自动触发
- ✅ 手动触发 (Ctrl+Space)

**快捷键**：
- `Ctrl+Space` - 手动触发补全
- `Tab` / `Enter` - 接受补全
- `↑` / `↓` - 选择补全项
- `Esc` - 取消补全

**补全示例**：
```markdown
# → 自动显示标题级别 (H1-H6)
- → 自动显示列表选项
:smile → 显示 emoji 补全
table → 插入表格模板
code → 插入代码块模板
```

### 6. 语法检查插件 (syntax-checker) ⭐

Markdown语法检查和诊断，帮助编写规范的Markdown。

**功能**：
- ✅ 实时语法检查
- ✅ 错误/警告/提示三级诊断
- ✅ 诊断面板显示
- ✅ 点击跳转到问题位置
- ✅ 自动修复部分问题

**检查规则**：
1. **标题格式** - 标题符号后是否有空格
2. **列表格式** - 列表符号/编号后是否有空格
3. **代码块格式** - 围栏是否完整
4. **链接格式** - 链接语法是否完整
5. **表格格式** - 表格分隔行是否正确
6. **任务列表格式** - 复选框格式是否正确
7. **空行规范** - 连续空行检查
8. **行尾空格** - 行尾多余空格检查

**使用方式**：
- 自动检查：编辑时自动运行
- 查看问题：底部诊断面板显示
- 跳转：点击问项跳转到对应位置

## 创建自定义插件

### 插件结构

```javascript
export const MyPlugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  description: '插件描述',

  activate(context) {
    // 插件激活时调用
    const {
      editor,
      registerCommand,
      registerKeybinding,
      registerToolbarButton,
      onAfterRender,
      log
    } = context

    // 注册命令
    registerCommand('myCommand', () => {
      // 命令逻辑
    })

    // 注册快捷键
    registerKeybinding('ctrl+shift+m', 'myCommand')

    // 注册工具栏按钮
    registerToolbarButton({
      id: 'my-button',
      icon: '🔧',
      title: '我的按钮',
      command: 'my-plugin.myCommand'
    })

    // 监听生命周期
    onAfterRender(() => {
      // 渲染后执行
    })
  },

  deactivate() {
    // 插件停用时调用（可选）
  }
}
```

### 插件API

#### 编辑器对象

```javascript
const { editor } = context

// 核心对象
editor.document   // 文档对象
editor.cursor     // 光标对象
editor.selection  // 选区对象
editor.viewport   // 视口管理器
editor.history    // 历史记录
editor.render     // 重新渲染
```

#### 注册命令

```javascript
registerCommand(commandId, handler, options)

// 示例
registerCommand('insertEmoji', (emoji) => {
  const { document, cursor } = editor
  document.insertText(cursor.line, cursor.column, emoji)
}, {
  title: '插入表情',
  description: '在光标位置插入表情'
})
```

#### 注册快捷键

```javascript
registerKeybinding(key, commandId, options)

// 示例
registerKeybinding('ctrl+e', 'insertEmoji')
registerKeybinding('ctrl+shift+e', 'my-plugin.insertEmoji')
```

#### 注册工具栏按钮

```javascript
registerToolbarButton(button)

// 示例
registerToolbarButton({
  id: 'emoji-btn',
  icon: '😀',
  title: '插入表情',
  command: 'my-plugin.insertEmoji',
  commandArgs: ['😀']
})
```

#### 生命周期钩子

```javascript
// 编辑器初始化前后
onBeforeInit(handler)
onAfterInit(handler)

// 渲染前后
onBeforeRender(handler)
onAfterRender(handler)

// 文档变化前后
onBeforeChange(handler)
onAfterChange(handler)

// 命令执行前后
onBeforeCommand(handler)
onAfterCommand(handler)

// 编辑器销毁前后
onBeforeDestroy(handler)
onAfterDestroy(handler)
```

### 插件示例：待办列表

```javascript
export const TodoListPlugin = {
  id: 'todo-list',
  name: 'Todo List',
  version: '1.0.0',

  activate(context) {
    const { editor, registerCommand, registerKeybinding } = context

    // 插入待办项
    registerCommand('insertTodo', (checked = false) => {
      const { document, cursor } = editor
      const todo = checked ? '- [x] ' : '- [ ] '
      document.insertText(cursor.line, cursor.column, todo)
      cursor.column += todo.length
      editor.render()
    })

    // 切换待办状态
    registerCommand('toggleTodo', () => {
      const { document, cursor } = editor
      const lineText = document.getLine(cursor.line)
      
      if (lineText.includes('- [ ]')) {
        const newText = lineText.replace('- [ ]', '- [x]')
        document.deleteText(cursor.line, 0, cursor.line, lineText.length)
        document.insertText(cursor.line, 0, newText)
      } else if (lineText.includes('- [x]')) {
        const newText = lineText.replace('- [x]', '- [ ]')
        document.deleteText(cursor.line, 0, cursor.line, lineText.length)
        document.insertText(cursor.line, 0, newText)
      }
      
      editor.render()
    })

    // 快捷键
    registerKeybinding('ctrl+shift+c', 'toggleTodo')
  }
}
```

## 使用插件

### 在编辑器中加载插件

```javascript
import { PluginManager } from './plugins/PluginManager.js'
import { MyPlugin } from './plugins/MyPlugin.js'

// 创建插件管理器
const pluginManager = new PluginManager(editor)

// 注册插件
pluginManager.register(MyPlugin)

// 激活插件
await pluginManager.activate('my-plugin')

// 停用插件
await pluginManager.deactivate('my-plugin')
```

### 执行插件命令

```javascript
// 直接执行
pluginManager.executeCommand('my-plugin.myCommand', arg1, arg2)

// 通过快捷键触发
// 用户按下注册的快捷键时自动执行
```

## 最佳实践

1. **命名规范**：使用 `pluginId.commandId` 格式命名命令
2. **错误处理**：在命令中添加 try-catch 错误处理
3. **性能优化**：避免在 onAfterRender 钩子中执行耗时操作
4. **清理资源**：在 deactivate 中清理定时器、事件监听器等
5. **文档化**：为插件提供清晰的文档和示例

## 未来规划

- [ ] 插件市场
- [ ] 插件配置面板
- [ ] 插件间通信
- [ ] 异步插件加载
- [ ] 插件依赖管理
