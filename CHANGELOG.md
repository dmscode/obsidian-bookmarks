# 更新日志

所有重要的更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且此项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

### 新增
- GitHub Actions 自动化构建和发布工作流
  - CI 工作流：自动测试和验证代码
  - 发布工作流：自动创建 GitHub Release
  - 版本管理工作流：自动版本号管理和发布

### 更改
- 更新 README.md 添加工作流状态徽章

## [1.0.0] - 2025-12-23

### 新增
- 初始版本发布
- 支持创建书签笔记功能
- 自动生成网站截图
- 支持标签分类和备注功能
- 可自定义存储文件夹路径
- 集成 AI 提示词模板用于完善书签信息
- 支持 YAML 格式的书签信息输入
- 自动验证 URL 格式
- 文件命名自动处理非法字符

### 技术特性
- 使用 TypeScript 开发
- 基于 Obsidian 插件 API
- 使用 esbuild 进行构建
- 集成 thum.io 截图服务
- 支持多平台（Windows, macOS, Linux）

### 配置选项
- 书签文件夹路径配置
- 附件文件夹路径配置
- 截图参数自定义（等待时间、视口大小等）

---

## 版本历史说明

### 版本命名规则
- **主版本号 (MAJOR)**：当进行不兼容的 API 修改时
- **次版本号 (MINOR)**：当添加向下兼容的新功能时
- **修订号 (PATCH)**：当进行向下兼容的问题修正时

### 标签说明
- **新增 (Added)**：新添加的功能
- **更改 (Changed)**：现有功能的更改
- **弃用 (Deprecated)**：即将删除的功能
- **删除 (Removed)**：现在删除的功能
- **修复 (Fixed)**：任何 bug 修复
- **安全 (Security)**：存在安全漏洞或修复安全漏洞

---

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助我们改进这个插件！

### 提交 Issue
- 使用清晰的标题和描述
- 提供复现步骤（如果是 bug）
- 注明使用的 Obsidian 版本和插件版本

### 提交 Pull Request
- 确保通过所有测试
- 更新相关文档
- 在 CHANGELOG.md 中添加更改记录
- 遵循现有的代码风格

## 联系方式

- GitHub Issues: [https://github.com/dmscode/obsidian-bookmarks/issues](https://github.com/dmscode/obsidian-bookmarks/issues)
- 作者主页: [https://github.com/dmscode](https://github.com/dmscode)
