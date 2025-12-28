import { App, Modal, Notice, Setting } from 'obsidian';
import { BookmarkYamlData } from './types';
import { BookmarkYamlCreator } from './addByYAML';
import { AiService } from './aiService';
import { ProgressStatus, ProgressStep } from './progressModal';

/**
 * 书签输入模态框类
 * 负责显示YAML输入界面和处理用户输入，同时支持进度显示
 * 
 * @class BookmarkModal
 * @extends {Modal}
 */
export class BookmarkModal extends Modal {
	/** 插件实例（使用any避免循环依赖） */
	private plugin: any;
	/** YAML输入文本域 */
	private yamlTextarea: HTMLTextAreaElement | null = null;
	/** YAML书签创建器 */
	private yamlCreator: BookmarkYamlCreator;
	/** 是否为进度模式 */
	private isProgressMode: boolean = false;
	/** 进度容器元素 */
	private progressContainer: HTMLElement | null = null;
	/** 步骤元素映射 */
	private stepElements: Map<string, HTMLElement> = new Map();
	/** 步骤列表 */
	private steps: ProgressStep[] = [];
	/** 原始内容容器 */
	private originalContent: HTMLElement | null = null;
	/** 进度更新定时器 */
	private progressUpdateInterval: number | null = null;

	/**
	 * 构造函数
	 * @param {App} app - Obsidian应用实例
	 * @param {any} plugin - 书签创建器插件实例
	 */
	constructor(app: App, plugin: any) {
		super(app);
		this.plugin = plugin;
		this.yamlCreator = new BookmarkYamlCreator(app, plugin.settings);
	}

	/**
	 * 模态框打开时的初始化
	 * 
	 * @returns {void}
	 */
	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: '创建书签笔记' });

		// 添加自定义样式
		this.addCustomStyles(contentEl);

		// YAML格式输入区域
		this.createYamlInputArea(contentEl);

		// 按钮区域
		this.createButtonArea(contentEl);
	}

	/**
	 * 添加自定义样式
	 * @private
	 * @param {HTMLElement} contentEl - 内容元素
	 * @returns {void}
	 */
	private addCustomStyles(contentEl: HTMLElement): void {
		contentEl.createEl('style', { text: `
			.bookmark-yaml-input-setting {
				flex-wrap: wrap;
			}
			.bookmark-yaml-input-setting .setting-item-info,
			.bookmark-yaml-input-setting .setting-item-control,
			.bookmark-yaml-input-setting .setting-item-control textarea {
				width: 100%;
			}
		`, type: 'text/css' });
	}

	/**
	 * 创建YAML输入区域
	 * @private
	 * @param {HTMLElement} contentEl - 内容元素
	 * @returns {void}
	 */
	private createYamlInputArea(contentEl: HTMLElement): void {
		new Setting(contentEl)
			.setClass('bookmark-yaml-input-setting')
			.setName('书签信息')
			.setDesc('支持YAML格式或直接输入网址。YAML格式将直接处理，网址将使用AI自动生成书签信息')
			.addTextArea(text => {
				this.yamlTextarea = text.inputEl;
				text.setPlaceholder(`方式1 - YAML格式：
---
created: 
title: 网站标题
url: https://example.com/
description: 网站描述
tags: 
    - 标签1
    - 标签2
---

方式2 - 直接输入网址：
https://example.com/`);
				this.yamlTextarea.rows = 15;
				this.yamlTextarea.style.fontFamily = 'monospace';
				this.yamlTextarea.style.fontSize = '14px';
			});
	}

	/**
	 * 创建按钮区域
	 * @private
	 * @param {HTMLElement} contentEl - 内容元素
	 * @returns {void}
	 */
	private createButtonArea(contentEl: HTMLElement): void {
		const buttonContainer = contentEl.createDiv('modal-button-container');
		buttonContainer.style.display = 'flex';
		buttonContainer.style.gap = '10px';
		buttonContainer.style.marginTop = '20px';

		// 创建按钮
		const createButton = buttonContainer.createEl('button', {
			text: '创建书签',
			cls: 'mod-cta'
		});
		createButton.addEventListener('click', () => this.createBookmark());

		// 取消按钮
		const cancelButton = buttonContainer.createEl('button', {
			text: '取消',
			cls: 'mod-muted'
		});
		cancelButton.addEventListener('click', () => this.close());
	}

	/**
	 * 模态框关闭时的清理
	 * 
	 * @returns {void}
	 */
	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * 解析YAML内容
	 * @private
	 * @param {string} yamlText - YAML文本内容
	 * @returns {BookmarkYamlData} 解析后的数据对象
	 * @throws {Error} 当YAML解析失败时抛出错误
	 */
	private parseYamlContent(yamlText: string): BookmarkYamlData {
		try {
			// 提取YAML内容（移除前后的---）
			const yamlMatch = yamlText.match(/---\s*\n([\s\S]*?)\n---/);
			if (!yamlMatch) {
				throw new Error('未找到YAML格式内容');
			}

			const yamlContent = yamlMatch[1];
			const result: BookmarkYamlData = {};

			// 解析各个字段
			const lines = yamlContent.split('\n');
			let currentKey = '';
			let currentValue = '';
			let inTags = false;
			const tags: string[] = [];

			for (const line of lines) {
				const trimmedLine = line.trim();
				
				// 处理标签数组
				if (trimmedLine.startsWith('tags:')) {
					inTags = true;
					currentKey = 'tags';
					continue;
				}

				if (inTags) {
					if (trimmedLine.startsWith('- ')) {
						tags.push(trimmedLine.substring(2).trim());
					} else if (trimmedLine && !trimmedLine.startsWith('-')) {
						inTags = false;
					}
					continue;
				}

				// 处理其他字段
				const colonIndex = trimmedLine.indexOf(':');
				if (colonIndex > 0) {
					currentKey = trimmedLine.substring(0, colonIndex).trim();
					currentValue = trimmedLine.substring(colonIndex + 1).trim();
					
				if (currentValue) {
					if (currentKey === 'tags') {
						// tags字段特殊处理，应该是数组类型
						result.tags = [currentValue];
					} else {
						(result as any)[currentKey] = currentValue;
					}
				}
				}
			}

			if (tags.length > 0) {
				result.tags = tags;
			}

			return result;
		} catch (error) {
			throw new Error(`YAML解析失败: ${error.message}`);
		}
	}

	/**
	 * 检查输入是否为有效的URL
	 * @private
	 * @param {string} input - 输入文本
	 * @returns {boolean} 是否为URL
	 */
	private isValidUrl(input: string): boolean {
		try {
			new URL(input);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * 检查输入是否为YAML格式
	 * @private
	 * @param {string} input - 输入文本
	 * @returns {boolean} 是否为YAML格式
	 */
	private isYamlFormat(input: string): boolean {
		// 检查是否包含YAML标记
		const yamlMarkerMatch = input.match(/---\s*\n/);
		if (!yamlMarkerMatch) {
			return false;
		}

		// 检查是否包含必需的YAML字段
		const hasTitle = input.includes('title:');
		const hasUrl = input.includes('url:');
		
		return hasTitle && hasUrl;
	}

	/**
	 * 从URL生成YAML内容
	 * @private
	 * @param {string} url - 网页URL
	 * @returns {Promise<string>} 生成的YAML内容
	 * @throws {Error} 当AI生成失败时抛出错误
	 */
	private async generateYamlFromUrl(url: string): Promise<string> {
		const aiService = new AiService(this.plugin.settings);
		return await aiService.generateBookmarkFromUrl(url);
	}

	/**
	 * 创建书签
	 * 处理用户点击创建按钮的逻辑
	 * 
	 * @private
	 * @returns {Promise<void>}
	 */
	private async createBookmark(): Promise<void> {
		if (!this.yamlTextarea) {
			new Notice('输入区域未初始化');
			return;
		}

		const inputText = this.yamlTextarea.value.trim();

		if (!inputText) {
			new Notice('请输入书签信息');
			return;
		}

		try {
			// 判断输入类型并分别处理
			if (this.isYamlFormat(inputText)) {
				// YAML格式处理
				await this.processYamlInput(inputText);
			} else if (this.isValidUrl(inputText)) {
				// URL格式处理
				await this.processUrlInput(inputText);
			} else {
				new Notice('请输入有效的YAML格式或网址');
				return;
			}
		} catch (error) {
			new Notice(`处理失败: ${error.message}`);
		}
	}

	/**
	 * 处理YAML格式输入
	 * @private
	 * @param {string} yamlText - YAML文本
	 * @returns {Promise<void>}
	 * @throws {Error} 当YAML处理失败时抛出错误
	 */
	private async processYamlInput(yamlText: string): Promise<void> {
		try {
			// 切换到进度模式
			this.switchToProgressMode();
			
			// 定义处理步骤 - 取消其他步骤的百分比显示
			this.steps = [
				{ id: 'parse', name: '解析YAML', status: ProgressStatus.PENDING },
				{ id: 'validate', name: '验证数据', status: ProgressStatus.PENDING },
				{ id: 'prepare', name: '准备环境', status: ProgressStatus.PENDING },
				{ id: 'screenshot', name: '生成截图', status: ProgressStatus.PENDING },
				{ id: 'content', name: '构建内容', status: ProgressStatus.PENDING },
				{ id: 'create', name: '创建文件', status: ProgressStatus.PENDING },
				{ id: 'open', name: '打开笔记', status: ProgressStatus.PENDING }
			];
			
			this.renderProgressSteps();

			// 步骤1: 解析YAML内容（不显示百分比）
			console.log('步骤1: 解析YAML - 开始');
			this.updateProgressStep('parse', ProgressStatus.PROCESSING);
			const parsedData = this.parseYamlContent(yamlText);
			this.completeProgressStep('parse');
			console.log('步骤1: 解析YAML - 完成');

			// 步骤2: 提取和验证数据（不显示百分比）
			console.log('步骤2: 验证数据 - 开始');
			this.updateProgressStep('validate', ProgressStatus.PROCESSING);
			
			// 提取必需字段
			const title = parsedData.title;
			const url = parsedData.url;

			if (!title) {
				throw new Error('YAML格式错误：缺少标题');
			}

			if (!url) {
				throw new Error('YAML格式错误：缺少网址');
			}

			// 验证URL格式
			try {
				new URL(url);
			} catch {
				throw new Error('YAML格式错误：无效的网址格式');
			}
			
			this.completeProgressStep('validate');
			console.log('步骤2: 验证数据 - 完成');

			// 继续后续步骤
			await this.processBookmarkCreation(parsedData);
			
		} catch (error) {
			this.failProgressStep('parse', error.message);
			setTimeout(() => this.close(), 3000);
			throw new Error(`YAML处理失败: ${error.message}`);
		}
	}

	/**
	 * 切换到进度显示模式
	 * @private
	 * @returns {void}
	 */
	private switchToProgressMode(): void {
		this.isProgressMode = true;
		const { contentEl } = this;
		
		// 保存原始内容
		this.originalContent = contentEl.createDiv();
		this.originalContent.innerHTML = contentEl.innerHTML;
		
		// 清空内容并重新布局
		contentEl.empty();
		contentEl.createEl('h2', { text: '创建书签笔记 - 处理中' });
		
		// 添加进度样式
		this.addProgressStyles(contentEl);
		
		// 创建进度容器
		this.progressContainer = contentEl.createDiv('progress-steps-container');
	}

	/**
	 * 添加进度显示样式
	 * @private
	 * @param {HTMLElement} contentEl - 内容元素
	 * @returns {void}
	 */
	private addProgressStyles(contentEl: HTMLElement): void {
		contentEl.createEl('style', { text: `
			.progress-steps-container {
				display: flex;
				flex-direction: column;
				gap: 8px;
				margin-top: 20px;
			}
			
			.progress-step {
				display: flex;
				align-items: center;
				padding: 8px 12px;
				border-radius: 4px;
				transition: all 0.3s ease;
			}
			
			/* 状态文字颜色变化 */
			.progress-step.processing .step-name {
				color: #007acc; /* 蓝色 */
			}
			
			.progress-step.completed .step-name {
				color: #28a745; /* 绿色 */
			}
			
			.progress-step.failed .step-name {
				color: #dc3545; /* 红色 */
			}
			
			.progress-step.pending .step-name {
				color: #6c757d; /* 浅灰色 */
			}
			
			.step-icon {
				width: 24px;
				height: 24px;
				margin-right: 12px;
				display: flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
			}
			
			.step-icon svg {
				width: 16px;
				height: 16px;
			}
			
			.step-content {
				flex: 1;
				display: flex;
				flex-direction: column;
				gap: 4px;
			}
			
			.step-name {
				font-weight: 500;
				color: var(--text-normal);
			}
			
			.step-description {
				font-size: 0.9em;
				color: var(--text-muted);
			}
			
			.step-progress {
				display: flex;
				align-items: center;
				gap: 8px;
				margin-left: auto;
				flex-shrink: 0;
			}
			
			.progress-percentage {
				font-size: 0.9em;
				color: var(--text-muted);
				min-width: 40px;
				text-align: right;
			}
			
			/* 加载动画 */
			.loading-spinner {
				width: 16px;
				height: 16px;
				border: 2px solid var(--background-modifier-border);
				border-top: 2px solid var(--interactive-accent);
				border-radius: 50%;
				animation: spin 1s linear infinite;
			}
			
			@keyframes spin {
				0% { transform: rotate(0deg); }
				100% { transform: rotate(360deg); }
			}
			
			/* 完成图标 */
			.check-icon {
				color: var(--interactive-success);
			}
			
			/* 失败图标 */
			.error-icon {
				color: var(--interactive-failure);
			}
		`, type: 'text/css' });
	}

	/**
	 * 渲染进度步骤
	 * @private
	 * @returns {void}
	 */
	private renderProgressSteps(): void {
		if (!this.progressContainer) return;

		this.progressContainer.empty();
		this.stepElements.clear();

		this.steps.forEach(step => {
			const stepElement = this.createProgressStepElement(step);
			this.progressContainer!.appendChild(stepElement);
			this.stepElements.set(step.id, stepElement);
		});
	}

	/**
	 * 创建进度步骤元素
	 * @private
	 * @param {ProgressStep} step - 步骤数据
	 * @returns {HTMLElement} 步骤元素
	 */
	private createProgressStepElement(step: ProgressStep): HTMLElement {
		const stepDiv = document.createElement('div');
		stepDiv.className = `progress-step ${step.status}`;
		stepDiv.id = `step-${step.id}`;

		// 图标
		const iconDiv = stepDiv.createDiv('step-icon');
		this.updateProgressStepIcon(iconDiv, step.status);

		// 内容
		const contentDiv = stepDiv.createDiv('step-content');
		contentDiv.createDiv('step-name').setText(step.name);
		if (step.description) {
			contentDiv.createDiv('step-description').setText(step.description);
		}

		// 进度信息 - 为所有状态显示百分比
		const progressDiv = stepDiv.createDiv('step-progress');
		if (step.status === ProgressStatus.PROCESSING) {
			progressDiv.createDiv('loading-spinner');
		}
		const progressPercentage = this.calculateProgressForModal(step);
		progressDiv.createDiv('progress-percentage').setText(`${progressPercentage}%`);

		return stepDiv;
	}

	/**
	 * 更新进度步骤图标
	 * @private
	 * @param {HTMLElement} iconDiv - 图标容器
	 * @param {ProgressStatus} status - 状态
	 * @returns {void}
	 */
	private updateProgressStepIcon(iconDiv: HTMLElement, status: ProgressStatus): void {
		iconDiv.empty();

		switch (status) {
			case ProgressStatus.PENDING:
				iconDiv.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>';
				break;
			case ProgressStatus.PROCESSING:
				iconDiv.innerHTML = '<div class="loading-spinner"></div>';
				break;
			case ProgressStatus.COMPLETED:
				iconDiv.innerHTML = '<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"></path></svg>';
				break;
			case ProgressStatus.FAILED:
				iconDiv.innerHTML = '<svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
				break;
		}
	}

	/**
	 * 更新进度步骤
	 * @private
	 * @param {string} stepId - 步骤ID
	 * @param {ProgressStatus} status - 状态
	 * @param {number} [progress] - 进度百分比
	 * @param {string} [description] - 描述
	 * @returns {void}
	 */
	private updateProgressStep(stepId: string, status: ProgressStatus, progress?: number, description?: string): void {
		const step = this.steps.find(s => s.id === stepId);
		if (!step) return;

		step.status = status;
		if (progress !== undefined) step.progress = progress;
		if (description !== undefined) step.description = description;

		// 记录开始时间
		if (status === ProgressStatus.PROCESSING && !step.startTime) {
			step.startTime = Date.now();
			// 开始实时更新进度
			this.startProgressUpdate();
		} else if (status !== ProgressStatus.PROCESSING && step.startTime) {
			// 停止实时更新进度
			this.stopProgressUpdate();
		}

		const stepElement = this.stepElements.get(stepId);
		if (!stepElement) return;

		// 更新状态类
		stepElement.className = `progress-step ${status}`;

		// 更新图标
		const iconDiv = stepElement.querySelector('.step-icon') as HTMLElement;
		if (iconDiv) {
			this.updateProgressStepIcon(iconDiv, status);
		}

		// 更新进度信息
		this.updateStepProgress(stepElement, step);

		// 更新描述
		if (description !== undefined) {
			const descriptionDiv = stepElement.querySelector('.step-description') as HTMLElement;
			if (descriptionDiv) {
				descriptionDiv.textContent = description;
			} else {
				const contentDiv = stepElement.querySelector('.step-content') as HTMLElement;
				if (contentDiv) {
					contentDiv.createDiv('step-description').setText(description);
				}
			}
		}
	}

	/**
	 * 完成进度步骤
	 * @private
	 * @param {string} stepId - 步骤ID
	 * @param {string} [description] - 描述
	 * @returns {void}
	 */
	private completeProgressStep(stepId: string, description?: string): void {
		this.updateProgressStep(stepId, ProgressStatus.COMPLETED, 100, description);
	}

	/**
	 * 失败进度步骤
	 * @private
	 * @param {string} stepId - 步骤ID
	 * @param {string} error - 错误信息
	 * @returns {void}
	 */
	private failProgressStep(stepId: string, error: string): void {
		this.updateProgressStep(stepId, ProgressStatus.FAILED, undefined, error);
	}

	/**
	 * 处理书签创建的主要流程（简化其他步骤的百分比显示）
	 * @private
	 * @param {BookmarkYamlData} parsedData - 解析后的书签数据
	 * @returns {Promise<void>}
	 * @throws {Error} 当书签创建失败时抛出错误
	 */
	private async processBookmarkCreation(parsedData: BookmarkYamlData): Promise<void> {
		try {
			// 确保数据完整性
			if (!parsedData.title || !parsedData.url) {
				throw new Error('缺少必需的标题或URL');
			}

			// 步骤3: 准备环境（不显示百分比）
			console.log('步骤3: 准备环境 - 开始');
			this.updateProgressStep('prepare', ProgressStatus.PROCESSING);
			
			// 创建文件夹
			await this.app.vault.createFolder(this.plugin.settings.bookmarkFolder).catch(() => {});
			await this.app.vault.createFolder(this.plugin.settings.attachmentFolder).catch(() => {});
			
			this.completeProgressStep('prepare');
			console.log('步骤3: 准备环境 - 完成');

			// 步骤4: 生成截图（实际完成后直接标记为100%）
			console.log('步骤4: 生成截图 - 开始');
			this.updateProgressStep('screenshot', ProgressStatus.PROCESSING);
			
			const screenshotFileName = await this.generateScreenshot(parsedData);
			
			this.completeProgressStep('screenshot');
			console.log('步骤4: 生成截图 - 完成');

			// 步骤5: 构建笔记内容（不显示百分比）
			console.log('步骤5: 构建内容 - 开始');
			this.updateProgressStep('content', ProgressStatus.PROCESSING);
			
			const noteContent = this.buildNoteContent({
				created: parsedData.created || new Date().toISOString().slice(0, 19).replace('T', ' '),
				title: parsedData.title,
				url: parsedData.url,
				description: parsedData.description || '',
				tags: parsedData.tags || [],
				screenshotFileName: screenshotFileName
			});
			
			this.completeProgressStep('content');
			console.log('步骤5: 构建内容 - 完成');

			// 步骤6: 创建笔记文件（不显示百分比）
			console.log('步骤6: 创建文件 - 开始');
			this.updateProgressStep('create', ProgressStatus.PROCESSING);
			
			const safeTitle = this.sanitizeFileName(parsedData.title);
			const fileName = `${safeTitle}.md`;
			const filePath = `${this.plugin.settings.bookmarkFolder}/${fileName}`;
			
			// 处理同名文件
			const finalFilePath = await this.ensureFileCanBeCreated(filePath);
			
			const file = await this.app.vault.create(finalFilePath, noteContent);
			
			this.completeProgressStep('create');
			console.log('步骤6: 创建文件 - 完成');

			// 步骤7: 自动打开笔记（不显示百分比）
			console.log('步骤7: 打开笔记 - 开始');
			this.updateProgressStep('open', ProgressStatus.PROCESSING);
			
			await this.app.workspace.getLeaf().openFile(file);
			
			this.completeProgressStep('open');
			console.log('步骤7: 打开笔记 - 完成');

			// 延迟关闭模态框，让用户看到完成状态
			setTimeout(() => {
				this.close();
			}, 1500);

		} catch (error) {
			console.error('书签创建失败:', error);
			this.failProgressStep('prepare', error.message);
			setTimeout(() => this.close(), 5000);
			throw error;
		}
	}

	/**
	 * 生成截图（实际完成后直接返回，不显示进度）
	 * @private
	 * @param {BookmarkYamlData} parsedData - 解析后的书签数据
	 * @returns {Promise<string>} 截图文件名
	 * @throws {Error} 当截图生成失败时抛出错误
	 */
	private async generateScreenshot(parsedData: BookmarkYamlData): Promise<string> {
		const safeTitle = this.sanitizeFileName(parsedData.title);
		const screenshotFileName = `${safeTitle}.png`;
		const screenshotPath = `${this.plugin.settings.attachmentFolder}/${screenshotFileName}`;

		// 下载截图，带重试机制
		const maxRetries = 3;
		let retryCount = 0;
		
		while (retryCount < maxRetries) {
			try {
				// 尝试下载截图
				await this.downloadScreenshot(
					`https://image.thum.io/get/wait/60/viewportWidth/1600/width/1440/crop/900/png/noanimate/${parsedData.url}`,
					screenshotPath
				);
				// 下载成功，返回文件名
				return screenshotFileName;
			} catch (error) {
				retryCount++;
				console.error(`截图下载失败 (尝试 ${retryCount}/${maxRetries}):`, error);
				
				if (retryCount < maxRetries) {
					// 等待10秒后重试
					await new Promise(resolve => setTimeout(resolve, 10000));
				} else {
					// 最后一次重试失败，抛出错误
					throw new Error(`截图下载失败，已重试${maxRetries - 1}次: ${error.message}`);
				}
			}
		}

		return screenshotFileName;
	}

	/**
	 * 处理URL格式输入
	 * @private
	 * @param {string} url - 网页URL
	 * @returns {Promise<void>}
	 * @throws {Error} 当URL处理失败时抛出错误
	 */
	private async processUrlInput(url: string): Promise<void> {
		try {
			// 验证URL格式
			try {
				new URL(url);
			} catch {
				throw new Error('无效的网址格式');
			}

			// 检查是否配置了必要的API密钥
			if (!this.plugin.settings.jinaApiKey) {
				throw new Error('Jina AI API密钥未设置，请在设置中配置');
			}

			if (!this.plugin.settings.aiApiKey) {
				throw new Error('AI API密钥未设置，请在设置中配置');
			}

			// 切换到进度模式
			this.switchToProgressMode();
			
			// 定义处理步骤 - 细化生成书签信息步骤，去除准备环境步骤
			this.steps = [
				{ id: 'extract', name: '读取网页内容', status: ProgressStatus.PENDING, estimatedTime: 30 }, // 抓取网页：30秒
				{ id: 'search', name: '搜索网站相关信息', status: ProgressStatus.PENDING, estimatedTime: 60 }, // 搜索信息：60秒
				{ id: 'generate', name: '使用AI生成完整的书签YAML信息', status: ProgressStatus.PENDING },
				{ id: 'parse', name: '解析数据', status: ProgressStatus.PENDING },
				{ id: 'screenshot', name: '生成截图', status: ProgressStatus.PENDING, estimatedTime: 60 }, // 生成截图：60秒
				{ id: 'content', name: '构建内容', status: ProgressStatus.PENDING },
				{ id: 'create', name: '创建文件', status: ProgressStatus.PENDING },
				{ id: 'open', name: '打开笔记', status: ProgressStatus.PENDING }
			];
			
			this.renderProgressSteps();

			// 创建AI服务实例
			const aiService = new AiService(this.plugin.settings);

			// 步骤1: 读取网页内容（实际完成后直接标记为100%）
			console.log('步骤1: 读取网页内容 - 开始');
			this.updateProgressStep('extract', ProgressStatus.PROCESSING);
			const webContent = await aiService.extractWebContent(url);
			this.completeProgressStep('extract');
			console.log('步骤1: 读取网页内容 - 完成');

			// 步骤2: 搜索网站相关信息（实际完成后直接标记为100%）
			console.log('步骤2: 搜索网站相关信息 - 开始');
			this.updateProgressStep('search', ProgressStatus.PROCESSING);
			const searchInfo = await aiService.searchWebInfo(url);
			this.completeProgressStep('search');
			console.log('步骤2: 搜索网站相关信息 - 完成');

			// 步骤3: 使用AI生成完整的书签YAML信息（实际完成后直接标记为100%）
			console.log('步骤3: 使用AI生成完整的书签YAML信息 - 开始');
			this.updateProgressStep('generate', ProgressStatus.PROCESSING);
			const yamlContent = await aiService.generateBookmarkYaml(url, webContent, searchInfo);
			this.completeProgressStep('generate');
			console.log('步骤3: 使用AI生成完整的书签YAML信息 - 完成');

			// 步骤4: 解析生成的YAML内容（不显示百分比）
			console.log('步骤4: 解析数据 - 开始');
			this.updateProgressStep('parse', ProgressStatus.PROCESSING);
			const parsedData = this.parseYamlContent(yamlContent);
			this.completeProgressStep('parse');
			console.log('步骤4: 解析数据 - 完成');

			// 继续后续步骤
			await this.processBookmarkCreation(parsedData);
			
		} catch (error) {
			this.failProgressStep('extract', error.message);
			setTimeout(() => this.close(), 5000);
			console.error('URL处理失败:', error);
			throw new Error(`URL处理失败: ${error.message}`);
		}
	}

	/**
	 * 清理文件名，移除非法字符
	 * @private
	 * @param {string} fileName - 原始文件名
	 * @returns {string} 清理后的文件名
	 */
	private sanitizeFileName(fileName: string): string {
		return fileName.replace(/[<>:\"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
	}

	/**
	 * 下载截图
	 * @private
	 * @param {string} url - 截图URL
	 * @param {string} filePath - 保存的文件路径
	 * @returns {Promise<void>}
	 * @throws {Error} 当下载失败时抛出错误
	 */
	private async downloadScreenshot(url: string, filePath: string): Promise<void> {
		console.log('Downloading screenshot from:', url);
		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
				}
			});

			if (response.ok) {
				const arrayBuffer = await response.arrayBuffer();
				await this.app.vault.createBinary(filePath, arrayBuffer);
				console.log('Screenshot downloaded successfully');
			} else {
				throw new Error(`截图下载失败，状态码: ${response.status}`);
			}
		} catch (error) {
			console.error('下载截图失败:', error);
			if (error instanceof Error) {
				throw new Error(`无法下载网站截图: ${error.message}`);
			} else {
				throw new Error('无法下载网站截图: 未知错误');
			}
		}
	}

	/**
	 * 确保文件可以被创建（处理同名文件存在的情况）
	 * @private
	 * @param {string} filePath - 原始文件路径
	 * @returns {Promise<string>} 可用的文件路径
	 */
	private async ensureFileCanBeCreated(filePath: string): Promise<string> {
		const existingFile = this.app.vault.getAbstractFileByPath(filePath);
		
		if (!existingFile) {
			// 文件不存在，可以直接创建
			return filePath;
		}
		
		// 如果文件已存在，生成带时间戳的新文件名
		const now = new Date();
		const timestamp = now.getTime().toString().slice(-6); // 取时间戳后6位
		const pathParts = filePath.split('/');
		const fileName = pathParts[pathParts.length - 1];
		const folderPath = pathParts.slice(0, -1).join('/');
		const nameParts = fileName.split('.');
		const extension = nameParts.length > 1 ? nameParts.pop() : '';
		const baseName = nameParts.join('.');
		
		const newFileName = `${baseName}_${timestamp}.${extension}`;
		const newFilePath = folderPath ? `${folderPath}/${newFileName}` : newFileName;
		
		return newFilePath;
	}

	/**
	 * 计算进度百分比（用于模态框）
	 * @private
	 * @param {ProgressStep} step - 步骤数据
	 * @returns {number} 进度百分比
	 */
	private calculateProgressForModal(step: ProgressStep): number {
		// 如果提供了明确的进度值，直接使用
		if (step.progress !== undefined) {
			return step.progress;
		}

		// 如果有预估时间和开始时间，基于时间计算进度
		if (step.estimatedTime && step.startTime) {
			const elapsed = (Date.now() - step.startTime) / 1000; // 已过去的时间（秒）
			const progress = Math.min(Math.round((elapsed / step.estimatedTime) * 100), 99); // 最多99%，留1%给完成
			return progress;
		}

		// 默认返回0%
		return 0;
	}

	/**
	 * 开始实时更新进度
	 * @private
	 * @returns {void}
	 */
	private startProgressUpdate(): void {
		// 如果已经有定时器在运行，先停止它
		this.stopProgressUpdate();
		
		// 创建新的定时器，每500ms更新一次
		this.progressUpdateInterval = window.setInterval(() => {
			this.updateProcessingStepsProgress();
		}, 500);
	}

	/**
	 * 停止实时更新进度
	 * @private
	 * @returns {void}
	 */
	private stopProgressUpdate(): void {
		if (this.progressUpdateInterval) {
			window.clearInterval(this.progressUpdateInterval);
			this.progressUpdateInterval = null;
		}
	}

	/**
	 * 更新所有处理中步骤的进度
	 * @private
	 * @returns {void}
	 */
	private updateProcessingStepsProgress(): void {
		this.steps.forEach(step => {
			if (step.status === ProgressStatus.PROCESSING) {
				const stepElement = this.stepElements.get(step.id);
				if (stepElement) {
					this.updateStepProgress(stepElement, step);
				}
			}
		});
	}

	/**
	 * 更新步骤进度显示
	 * @private
	 * @param {HTMLElement} stepElement - 步骤元素
	 * @param {ProgressStep} step - 步骤数据
	 * @returns {void}
	 */
	private updateStepProgress(stepElement: HTMLElement, step: ProgressStep): void {
		let progressDiv = stepElement.querySelector('.step-progress') as HTMLElement;
		
		// 如果进度div不存在，创建它
		if (!progressDiv) {
			progressDiv = stepElement.createDiv('step-progress');
		}

		progressDiv.empty();

		// 根据状态显示不同的进度信息
		if (step.status === ProgressStatus.PROCESSING) {
			// 处理中状态：显示加载动画和百分比
			progressDiv.createDiv('loading-spinner');
			const progress = this.calculateProgressForModal(step);
			progressDiv.createDiv('progress-percentage').setText(`${progress}%`);
		} else if (step.status === ProgressStatus.COMPLETED) {
			// 完成状态：显示100%
			progressDiv.createDiv('progress-percentage').setText('100%');
		} else if (step.status === ProgressStatus.FAILED) {
			// 失败状态：显示0%或之前的进度
			const progress = step.progress || 0;
			progressDiv.createDiv('progress-percentage').setText(`${progress}%`);
		} else {
			// 待处理状态：显示0%
			progressDiv.createDiv('progress-percentage').setText('0%');
		}
	}

	/**
	 * 构建笔记内容
	 * @private
	 * @param {any} data - 笔记数据
	 * @returns {string} 生成的笔记内容
	 */
	private buildNoteContent(data: any): string {
		// 处理标签：将空格替换为下划线，使用列表格式
		const processedTags = data.tags.map((tag: string) => tag.replace(/\s+/g, '_'));
		const tagsContent = processedTags.length > 0 
			? processedTags.map((tag: string) => `  - ${tag}`).join('\n')
			: '';
		
		const screenshotLink = `screenshot:: ![网站截图](${this.plugin.settings.attachmentFolder}/${encodeURIComponent(data.screenshotFileName)})`;

		return `---
created: ${data.created}
title: "${data.title}"
url: "${data.url}"
description: "${data.description}"
tags:
${tagsContent}
---

## 网站截图

${screenshotLink}

## 网站笔记

`;
	}
}
