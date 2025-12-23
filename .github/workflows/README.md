# GitHub Actions 工作流文档

此项目包含三个主要的GitHub Actions工作流，用于自动化构建、测试和发布流程。

## 工作流概览

### 1. CI 工作流 (`.github/workflows/ci.yml`)

**触发条件：**
- 推送到 `main`, `master`, `develop` 分支
- 向这些分支发起 Pull Request
- 手动触发 (`workflow_dispatch`)

**功能：**
- 在多个 Node.js 版本 (16.x, 18.x, 20.x) 上测试构建
- 验证 TypeScript 编译
- 检查构建产物 (`main.js`)
- 验证 `manifest.json` 格式和必需字段
- 可选的 ESLint 检查
- 安全漏洞扫描 (`npm audit`)

### 2. 构建和发布工作流 (`.github/workflows/release.yml`)

**触发条件：**
- 推送到 `main`, `master` 分支
- 创建 `v*` 标签（如 `v1.0.0`）
- 向这些分支发起 Pull Request
- 手动触发 (`workflow_dispatch`)

**功能：**
- 构建插件
- 上传构建产物为 GitHub Artifacts
- 当创建版本标签时，自动创建 GitHub Release
- 上传发布资源 (`main.js`, `manifest.json`)
- 在 Pull Request 时检查版本号是否更新

### 3. 版本管理工作流 (`.github/workflows/version-bump.yml`)

**触发条件：**
- 仅手动触发 (`workflow_dispatch`)

**输入参数：**
- `version_type`: 版本类型 (`patch`, `minor`, `major`)
- `pre_release`: 预发布版本后缀（可选，如 `alpha`, `beta`, `rc`）

**功能：**
- 自动计算新版本号
- 更新 `manifest.json` 中的版本号
- 更新 `versions.json` 文件
- 提交更改并创建版本标签
- 自动创建 GitHub Release
- 上传发布资源

## 使用方法

### 日常开发

1. **提交代码**：推送到 `main` 或 `develop` 分支会自动触发 CI 工作流
2. **Pull Request**：向主分支发起 PR 会自动运行测试和验证
3. **查看结果**：在 GitHub 的 Actions 标签页查看工作流运行状态

### 发布新版本

#### 方法 1：使用版本管理工作流（推荐）

1. 进入 GitHub 仓库的 Actions 页面
2. 选择 "Version Bump" 工作流
3. 点击 "Run workflow"
4. 选择版本类型：
   - `patch`: 修复 bug（如 1.0.0 → 1.0.1）
   - `minor`: 添加功能（如 1.0.0 → 1.1.0）
   - `major`: 重大更改（如 1.0.0 → 2.0.0）
5. 可选：添加预发布后缀（如 `alpha`, `beta`）
6. 点击 "Run workflow"

工作流会自动：
- 更新版本号
- 构建插件
- 创建标签和发布
- 上传资源文件

#### 方法 2：手动创建标签

1. 本地更新 `manifest.json` 中的版本号
2. 提交更改：`git add manifest.json && git commit -m "Bump version to x.x.x"`
3. 创建标签：`git tag -a vx.x.x -m "Release version x.x.x"`
4. 推送标签：`git push origin vx.x.x`

推送标签会自动触发发布工作流。

### 安装插件

用户可以通过以下步骤安装插件：

1. 从 [Releases](https://github.com/dmscode/obsidian-bookmarks/releases) 页面下载最新版本的文件
2. 解压下载的文件
3. 将 `main.js` 和 `manifest.json` 复制到 Obsidian vault 的 `.obsidian/plugins/bookmark-creator/` 目录
4. 重启 Obsidian
5. 在设置 > 社区插件中启用插件

## 工作流状态徽章

在 README.md 中添加以下徽章来显示工作流状态：

```markdown
![CI](https://github.com/dmscode/obsidian-bookmarks/workflows/CI/badge.svg)
![Build and Release](https://github.com/dmscode/obsidian-bookmarks/workflows/Build%20and%20Release/badge.svg)
```

## 故障排除

### 工作流失败常见原因

1. **构建失败**：检查 TypeScript 编译错误
2. **版本格式错误**：确保版本号遵循语义化版本规范（如 1.0.0）
3. **缺少必需字段**：确保 `manifest.json` 包含 `id`, `version`, `minAppVersion`
4. **依赖安全漏洞**：运行 `npm audit` 查看并修复安全问题

### 手动重试工作流

1. 进入 GitHub 的 Actions 页面
2. 找到失败的工作流运行
3. 点击 "Re-run jobs" 重新运行

## 最佳实践

1. **保持版本号同步**：确保 `manifest.json` 和 `versions.json` 同时更新
2. **使用语义化版本**：遵循 `major.minor.patch` 格式
3. **编写清晰的提交信息**：有助于生成发布说明
4. **定期更新依赖**：保持项目安全性
5. **测试构建**：在本地运行 `npm run build` 确保构建成功
