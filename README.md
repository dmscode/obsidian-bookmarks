# Obsidian 书签创建器插件

智能化的 Obsidian 插件，一键创建带截图的书签笔记。支持 AI 自动生成和 YAML 手动输入双模式。

## 🌟 核心功能

- **🤖 AI 智能生成**: 输入网址自动生成完整书签信息
- **📸 自动截图**: 智能生成网站预览图并保存
- **🏷️ 多级标签**: 支持分类/子分类结构
- **⚡ 实时进度**: 显示处理状态和进度
- **📝 双模式输入**: AI 生成 + YAML 手动输入

## 🚀 快速开始

### 安装

#### 手动安装
1. 下载插件文件 (`manifest.json`, `main.js`, `styles.css`)
2. 复制到 `.obsidian/plugins/bookmark-creator/` 目录
3. 启用插件

#### BRAT 安装
1. 安装 [BRAT 插件](https://github.com/TfTHacker/obsidian42-brat)
2. 添加插件：`https://github.com/dmscode/obsidian-bookmarks`

### 基础配置

首次使用需配置：
- **Jina AI API 密钥**: 网页内容提取
- **AI API 配置**: OpenAI/Kimi 等
- **存储路径**: 书签和截图文件夹

## 💡 使用方法

### 方式一：AI 自动生成（推荐）

1. `Ctrl/Cmd + P` → "创建书签笔记"
2. 输入网址（如：`https://example.com`）
3. 等待 AI 处理完成

**AI 自动完成：**
- 提取网页内容 → 搜索相关信息 → 生成标题描述 → 智能分类 → 生成截图

### 方式二：YAML 手动输入

适合精确控制：（[可使用 AI 提示词模板](docs/ai-prompt-templates.md) 生成内容）

```yaml
---
created: 
title: 网站标题
url: https://example.com/
description: 网站描述
tags: 
    - 科技数码/软件下载
    - 实用工具
---
```

## 📈 更新日志

### [2.0.0] - 2026-01-02
- ✅ 重构代码

### [1.3.0] - 2025-12-28
- ✅ 完整 JSDoc 文档
- ✅ 模块化架构重构
- ✅ 增强错误处理
- ✅ 优化用户体验

### [1.0.0] - 2025-12-23
- ✅ 初始版本发布
- ✅ 核心功能实现
- ✅ 多平台支持

## 📄 许可证

MIT License

## 🙏 致谢

- [Obsidian](https://obsidian.md) - 知识管理平台
- [Jina AI](https://jina.ai) - AI 内容提取
- [thum.io](https://thum.io) - 截图服务

---

**⭐ 喜欢这个项目？给个 Star 支持一下！**