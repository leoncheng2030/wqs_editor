# Contributing Guide

[English](#english) | [简体中文](#简体中文)

---

<a name="english"></a>

## English

Thank you for your interest in contributing to @nywqs/vue-markdown-editor! This guide will help you get started.

### 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Guidelines](#coding-guidelines)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)

---

## Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please read and follow our Code of Conduct:

- **Be respectful** and inclusive of differing viewpoints and experiences
- **Be collaborative** and professional in all interactions
- **Be patient** and understanding with beginners
- **Report** unacceptable behavior to the maintainers

---

## How to Contribute

There are many ways to contribute to this project:

### 🐛 Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

**Good bug reports include:**
- Clear, descriptive title
- Exact steps to reproduce
- Expected vs. actual behavior
- Screenshots if applicable
- Environment details (OS, browser, versions)

**Template:**
```markdown
**Bug Description**
A clear description of the bug.

**To Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g. Windows 11]
- Browser: [e.g. Chrome 120]
- Version: [e.g. 2.0.0]
```

### 💡 Suggesting Features

Feature requests are welcome! Please:
- Check if the feature already exists or is planned
- Provide clear use cases and examples
- Explain why this feature benefits users

### 📝 Improving Documentation

Documentation improvements are greatly appreciated:
- Fix typos and grammar
- Add missing information
- Improve code examples
- Translate documentation

### 🔧 Submitting Code

Follow the development workflow below.

---

## Development Setup

### Prerequisites

- Node.js >= 16
- npm >= 8 or pnpm >= 8

### Clone and Install

```bash
# Clone the repository
git clone https://github.com/leoncheng2030/wqs_editor.git
cd wqs_editor

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

```bash
# Development
npm run dev              # Start dev server at localhost:5173

# Building
npm run build            # Build demo app
npm run build:lib        # Build library for npm

# Type Checking
npm run typecheck        # Run TypeScript type checking

# Preview
npm run preview          # Preview production build
```

---

## Project Structure

```
wqs_editor/
├── src/
│   ├── canvas-editor/           # Main editor source
│   │   ├── core/               # Core modules (Document, Cursor, Selection, History)
│   │   ├── managers/           # Manager modules (Input, Viewport, Cache, etc.)
│   │   ├── renderers/          # Renderer modules (Text, Cursor, Selection, etc.)
│   │   ├── syntax/             # Syntax highlighting (Lexer, Highlighter)
│   │   ├── plugins/            # Plugin system
│   │   │   ├── core/          # Plugin infrastructure
│   │   │   └── builtin/       # Built-in plugins
│   │   ├── workers/            # Web Workers
│   │   ├── types/              # TypeScript type definitions
│   │   ├── components/         # Vue components
│   │   └── CanvasEditor.vue    # Main editor component
│   ├── lib/                    # Library entry point
│   ├── App.vue                 # Demo app
│   └── main.ts                 # Demo entry
├── public/                     # Static assets
├── dist-lib/                   # Built library output
├── docs/                       # Documentation
│   ├── API.md                  # API documentation
│   ├── BENCHMARK.md            # Performance benchmarks
│   ├── EXAMPLES.md             # Usage examples
│   └── CONTRIBUTING.md         # This file
├── CHANGELOG.md                # Version history
├── README.md                   # English readme
├── README.zh-CN.md             # Chinese readme
├── package.json
├── tsconfig.json
└── vite.config.js
```

---

## Coding Guidelines

### TypeScript

This project is written in TypeScript. Please:

✅ **DO:**
- Add type annotations for all function parameters
- Use interfaces for complex objects
- Avoid `any` type when possible
- Add JSDoc comments for public APIs

❌ **DON'T:**
- Use `any` without good reason
- Ignore TypeScript errors
- Skip type checking

**Example:**
```typescript
// ✅ Good
interface CursorPosition {
  line: number
  column: number
}

function moveCursor(position: CursorPosition): void {
  // ...
}

// ❌ Bad
function moveCursor(position: any) {
  // ...
}
```

### Vue 3

Use Composition API with `<script setup>`:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

// ✅ Use typed refs
const count = ref<number>(0)

// ✅ Use computed for derived state
const doubled = computed(() => count.value * 2)

// ✅ Define props with types
const props = defineProps<{
  modelValue: string
  theme: 'light' | 'dark'
}>()
</script>
```

### Code Style

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for TypeScript, double quotes for templates
- **Semicolons**: Required
- **Naming**:
  - PascalCase for classes and components
  - camelCase for functions and variables
  - UPPER_CASE for constants

### Performance

- Use viewport clipping for rendering
- Implement incremental updates
- Debounce expensive operations
- Cache computed results

---

## Testing

### Manual Testing

1. Start dev server: `npm run dev`
2. Test in browser at `http://localhost:5173`
3. Check console for errors
4. Test on different document sizes (1K, 5K, 10K lines)

### Type Checking

```bash
npm run typecheck
```

Must pass with zero errors before submitting PR.

### Performance Testing

Compare performance with baseline:

```bash
# Generate large document
node scripts/generate-test-doc.js 10000 > test-10k.md

# Test rendering performance
# (Manual: Open in editor, measure FPS and responsiveness)
```

---

## Submitting Changes

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `perf/description` - Performance improvements

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `perf`: Performance
- `test`: Testing
- `chore`: Maintenance

**Examples:**
```
feat(editor): add auto-save functionality

fix(renderer): correct line number alignment

docs(api): update props documentation

perf(viewport): optimize scroll performance
```

### Pull Request Process

1. **Fork** the repository
2. **Create** a new branch from `main`
3. **Make** your changes
4. **Run** type checking: `npm run typecheck`
5. **Test** your changes thoroughly
6. **Commit** with descriptive messages
7. **Push** to your fork
8. **Create** a Pull Request

**PR Template:**
```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How were these changes tested?

## Screenshots
If applicable, add screenshots.

## Checklist
- [ ] Code follows project style
- [ ] Type checking passes
- [ ] Documentation updated
- [ ] Changes tested locally
```

### Review Process

- Maintainers will review your PR
- Address feedback and update PR
- Once approved, maintainer will merge

---

## Development Tips

### Hot Reload

Dev server supports hot reload. Changes are reflected immediately.

### Debugging

Use browser DevTools:

```typescript
// Add breakpoints
debugger;

// Log performance
console.time('render');
render();
console.timeEnd('render');

// Inspect state
console.log('Cursor:', cursor);
console.log('Document:', document.getText());
```

### Plugin Development

Create plugins in `src/canvas-editor/plugins/builtin/`:

```typescript
import { Plugin } from '../core/PluginManager'

export class MyPlugin implements Plugin {
  name = 'my-plugin'
  version = '1.0.0'
  
  activate(context) {
    // Plugin logic
  }
  
  deactivate() {
    // Cleanup
  }
}
```

---

## Getting Help

- **Questions**: Open a [Discussion](https://github.com/leoncheng2030/wqs_editor/discussions)
- **Bugs**: Open an [Issue](https://github.com/leoncheng2030/wqs_editor/issues)
- **Chat**: Join our community (coming soon)

---

## Recognition

Contributors will be:
- Listed in CHANGELOG for their contributions
- Mentioned in release notes
- Added to Contributors section

---

<a name="简体中文"></a>

## 简体中文

感谢您对 @nywqs/vue-markdown-editor 的贡献兴趣！本指南将帮助您开始贡献。

### 📋 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发环境设置](#开发环境设置)
- [项目结构](#项目结构-1)
- [编码规范](#编码规范)
- [测试](#测试-1)
- [提交变更](#提交变更)

---

## 行为准则

我们致力于为所有人提供友好和鼓舞人心的社区。请阅读并遵守我们的行为准则：

- **尊重**不同的观点和经验
- 在所有互动中保持**协作**和专业
- 对初学者保持**耐心**和理解
- **报告**不可接受的行为给维护者

---

## 如何贡献

有多种方式可以为这个项目做出贡献：

### 🐛 报告 Bug

在创建 bug 报告之前，请检查现有 issue 以避免重复。

**好的 bug 报告包括：**
- 清晰、描述性的标题
- 准确的重现步骤
- 预期 vs 实际行为
- 如果适用，添加截图
- 环境详情（操作系统、浏览器、版本）

**模板：**
```markdown
**Bug 描述**
清晰的 bug 描述。

**重现步骤**
1. 进入 '...'
2. 点击 '...'
3. 看到错误

**预期行为**
你期望发生什么。

**截图**
如果适用，添加截图。

**环境：**
- 操作系统: [例如 Windows 11]
- 浏览器: [例如 Chrome 120]
- 版本: [例如 2.0.0]
```

### 💡 功能建议

欢迎功能请求！请：
- 检查该功能是否已存在或已计划
- 提供清晰的用例和示例
- 解释为什么这个功能对用户有益

### 📝 改进文档

文档改进非常受欢迎：
- 修复拼写和语法错误
- 添加缺失的信息
- 改进代码示例
- 翻译文档

### 🔧 提交代码

遵循下面的开发工作流程。

---

## 开发环境设置

### 前置要求

- Node.js >= 16
- npm >= 8 或 pnpm >= 8

### 克隆和安装

```bash
# 克隆仓库
git clone https://github.com/leoncheng2030/wqs_editor.git
cd wqs_editor

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 可用脚本

```bash
# 开发
npm run dev              # 启动开发服务器在 localhost:5173

# 构建
npm run build            # 构建演示应用
npm run build:lib        # 构建 npm 库

# 类型检查
npm run typecheck        # 运行 TypeScript 类型检查

# 预览
npm run preview          # 预览生产构建
```

---

## 项目结构

```
wqs_editor/
├── src/
│   ├── canvas-editor/           # 主编辑器源代码
│   │   ├── core/               # 核心模块（Document、Cursor、Selection、History）
│   │   ├── managers/           # 管理器模块（Input、Viewport、Cache 等）
│   │   ├── renderers/          # 渲染器模块（Text、Cursor、Selection 等）
│   │   ├── syntax/             # 语法高亮（Lexer、Highlighter）
│   │   ├── plugins/            # 插件系统
│   │   │   ├── core/          # 插件基础设施
│   │   │   └── builtin/       # 内置插件
│   │   ├── workers/            # Web Workers
│   │   ├── types/              # TypeScript 类型定义
│   │   ├── components/         # Vue 组件
│   │   └── CanvasEditor.vue    # 主编辑器组件
│   ├── lib/                    # 库入口点
│   ├── App.vue                 # 演示应用
│   └── main.ts                 # 演示入口
├── public/                     # 静态资源
├── dist-lib/                   # 构建库输出
├── docs/                       # 文档
│   ├── API.md                  # API 文档
│   ├── BENCHMARK.md            # 性能基准
│   ├── EXAMPLES.md             # 使用示例
│   └── CONTRIBUTING.md         # 本文件
├── CHANGELOG.md                # 版本历史
├── README.md                   # 英文 readme
├── README.zh-CN.md             # 中文 readme
├── package.json
├── tsconfig.json
└── vite.config.js
```

---

## 编码规范

### TypeScript

本项目使用 TypeScript 编写。请：

✅ **应该：**
- 为所有函数参数添加类型注解
- 使用接口定义复杂对象
- 尽可能避免 `any` 类型
- 为公共 API 添加 JSDoc 注释

❌ **不应该：**
- 无充分理由使用 `any`
- 忽略 TypeScript 错误
- 跳过类型检查

**示例：**
```typescript
// ✅ 好
interface CursorPosition {
  line: number
  column: number
}

function moveCursor(position: CursorPosition): void {
  // ...
}

// ❌ 坏
function moveCursor(position: any) {
  // ...
}
```

### Vue 3

使用 Composition API 和 `<script setup>`：

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

// ✅ 使用带类型的 ref
const count = ref<number>(0)

// ✅ 使用 computed 处理派生状态
const doubled = computed(() => count.value * 2)

// ✅ 定义带类型的 props
const props = defineProps<{
  modelValue: string
  theme: 'light' | 'dark'
}>()
</script>
```

### 代码风格

- **缩进**：2 个空格
- **引号**：TypeScript 使用单引号，模板使用双引号
- **分号**：必需
- **命名**：
  - 类和组件使用 PascalCase
  - 函数和变量使用 camelCase
  - 常量使用 UPPER_CASE

### 性能

- 使用视口裁剪进行渲染
- 实现增量更新
- 对昂贵操作进行防抖
- 缓存计算结果

---

## 测试

### 手动测试

1. 启动开发服务器：`npm run dev`
2. 在浏览器中测试 `http://localhost:5173`
3. 检查控制台错误
4. 测试不同文档大小（1K、5K、10K 行）

### 类型检查

```bash
npm run typecheck
```

提交 PR 前必须零错误通过。

---

## 提交变更

### 分支命名

- `feature/描述` - 新功能
- `fix/描述` - Bug 修复
- `docs/描述` - 文档更新
- `refactor/描述` - 代码重构
- `perf/描述` - 性能改进

### 提交信息

遵循 [约定式提交](https://www.conventionalcommits.org/zh-hans/)：

```
类型(范围): 主题

[可选的正文]

[可选的页脚]
```

**类型：**
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档
- `style`: 格式
- `refactor`: 重构
- `perf`: 性能
- `test`: 测试
- `chore`: 维护

**示例：**
```
feat(editor): 添加自动保存功能

fix(renderer): 修正行号对齐

docs(api): 更新 props 文档

perf(viewport): 优化滚动性能
```

### Pull Request 流程

1. **Fork** 仓库
2. 从 `main` **创建**新分支
3. **进行**更改
4. **运行**类型检查：`npm run typecheck`
5. **彻底测试**你的更改
6. 使用描述性消息**提交**
7. **推送**到你的 fork
8. **创建** Pull Request

---

## 获取帮助

- **问题**：开启 [Discussion](https://github.com/leoncheng2030/wqs_editor/discussions)
- **Bug**：开启 [Issue](https://github.com/leoncheng2030/wqs_editor/issues)
- **聊天**：加入我们的社区（即将推出）

---

## 致谢

贡献者将会：
- 在 CHANGELOG 中列出他们的贡献
- 在发布说明中提及
- 添加到贡献者部分

---

## 📝 许可证

MIT © [nywqs](https://github.com/leoncheng2030)
