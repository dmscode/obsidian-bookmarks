import { App, Notice, TFile, TFolder, requestUrl } from 'obsidian';
import { BookmarkCreatorSettings, BookmarkYamlData, NoteContentData } from './types';
import { ProgressModal, ProgressStatus, ProgressStep } from './progressModal';

/**
 * YAML书签创建器类
 * 负责处理从YAML数据创建书签笔记的所有功能
 * 
 * @class BookmarkYamlCreator
 */
export class BookmarkYamlCreator {
	/** Obsidian应用实例 */
	private app: App;
	/** 插件设置 */
	private settings: BookmarkCreatorSettings;

	/**
	 * 构造函数
	 * @param {App} app - Obsidian应用实例
	 * @param {BookmarkCreatorSettings} settings - 插件设置
	 */
	constructor(app: App, settings: BookmarkCreatorSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * 从YAML数据创建书签笔记
	 * 主要功能入口，处理完整的笔记创建流程
	 * 
	 * @param {BookmarkYamlData} yamlData - 从YAML解析的书签数据
	 * @returns {Promise<void>}
	 * @throws {Error} 当创建过程中出现错误时抛出
	 */
	async createBookmarkNoteFromYaml(yamlData: BookmarkYamlData): Promise<void> {
		let progressModal: ProgressModal | null = null;
		let steps: ProgressStep[] = [];
		
		try {
			// 创建进度模态框并立即显示
			progressModal = new ProgressModal(this.app, '创建书签笔记');
			
			// 定义处理步骤
			steps = [
				{ id: 'prepare', name: '准备环境', status: ProgressStatus.PENDING },
				{ id: 'validate', name: '验证数据', status: ProgressStatus.PENDING },
				{ id: 'screenshot', name: '生成截图', status: ProgressStatus.PENDING, estimatedTime: 60 }, // 生成截图：60秒
				{ id: 'content', name: '构建内容', status: ProgressStatus.PENDING },
				{ id: 'create', name: '创建文件', status: ProgressStatus.PENDING },
				{ id: 'open', name: '打开笔记', status: ProgressStatus.PENDING }
			];
			
			// 设置步骤并打开模态框
			progressModal.setSteps(steps);
			
			// 使用setTimeout确保模态框能在事件循环中正确显示
			setTimeout(() => {
				progressModal?.open();
			}, 0);

			// 等待一小段时间确保模态框显示后再开始处理
			await new Promise(resolve => setTimeout(resolve, 100));

			// 步骤1: 确保必要的文件夹存在
			console.log('步骤1: 准备环境 - 开始');
			progressModal.updateStep('prepare', ProgressStatus.PROCESSING);
			await this.ensureFolderExists(this.settings.bookmarkFolder);
			await this.ensureFolderExists(this.settings.attachmentFolder);
			progressModal.completeStep('prepare');
			console.log('步骤1: 准备环境 - 完成');

			// 步骤2: 提取和验证数据
			console.log('步骤2: 验证数据 - 开始');
			progressModal.updateStep('validate', ProgressStatus.PROCESSING);
			const validatedData = this.validateAndProcessYamlData(yamlData);
			progressModal.completeStep('validate');
			console.log('步骤2: 验证数据 - 完成');
			
			// 步骤3: 生成截图
			console.log('步骤3: 生成截图 - 开始');
			progressModal.updateStep('screenshot', ProgressStatus.PROCESSING);
			const screenshotFileName = await this.generateAndDownloadScreenshotWithProgress(
				validatedData.title, 
				validatedData.url,
				progressModal
			);
			progressModal.completeStep('screenshot');
			console.log('步骤3: 生成截图 - 完成');

			// 步骤4: 构建笔记内容
			console.log('步骤4: 构建内容 - 开始');
			progressModal.updateStep('content', ProgressStatus.PROCESSING);
			const noteContent = this.buildNoteContent({
				...validatedData,
				screenshotFileName
			});
			progressModal.completeStep('content');
			console.log('步骤4: 构建内容 - 完成');

			// 步骤5: 创建笔记文件
			console.log('步骤5: 创建文件 - 开始');
			progressModal.updateStep('create', ProgressStatus.PROCESSING);
			const file = await this.createNoteFile(validatedData.title, noteContent);
			progressModal.completeStep('create');
			console.log('步骤5: 创建文件 - 完成');

			// 步骤6: 自动打开笔记
			console.log('步骤6: 打开笔记 - 开始');
			progressModal.updateStep('open', ProgressStatus.PROCESSING);
			await this.app.workspace.getLeaf().openFile(file);
			progressModal.completeStep('open');
			console.log('步骤6: 打开笔记 - 完成');

			// 延迟关闭模态框，让用户看到完成状态
			setTimeout(() => {
				progressModal?.close();
			}, 1500);

			// 只在控制台输出成功信息，不再显示重复的Notice
			console.log(`书签笔记 "${validatedData.title}" 创建成功！`);
		} catch (error) {
			console.error('创建书签笔记失败:', error);
			if (progressModal) {
				// 找出当前失败的步骤并标记为失败
				const currentStep = steps.find(step => step.status === ProgressStatus.PROCESSING);
				if (currentStep) {
					progressModal.failStep(currentStep.id, error.message);
				}
				// 5秒后关闭模态框
				setTimeout(() => {
					progressModal?.close();
				}, 5000);
			}
			// 错误信息已经在进度模态框中显示，不再重复显示Notice
		}
	}

	/**
	 * 验证和处理YAML数据
	 * 确保所有必需字段都存在且格式正确
	 * 
	 * @private
	 * @param {BookmarkYamlData} yamlData - 原始YAML数据
	 * @returns {NoteContentData} 处理后的完整数据
	 * @throws {Error} 当数据验证失败时抛出错误
	 */
	private validateAndProcessYamlData(yamlData: BookmarkYamlData): NoteContentData {
		// 提取数据
		let title = yamlData.title || '';
		const url = yamlData.url || '';
		const description = yamlData.description || '';
		const tags = yamlData.tags || [];
		
		// 补全创建时间 - 修复时间格式，确保包含时间信息
		let created = yamlData.created;
		if (!created) {
			const now = new Date();
			// 使用 ISO 格式，确保包含完整的日期和时间
			created = now.toISOString().slice(0, 19).replace('T', ' ');
		} else if (created && !created.includes(':')) {
			// 如果只有日期没有时间，添加当前时间
			const now = new Date();
			const time = now.toTimeString().slice(0, 8);
			created = `${created} ${time}`;
		}

		// 验证必需字段
		if (!title) {
			throw new Error('标题不能为空');
		}
		if (!url) {
			throw new Error('URL不能为空');
		}

		// 验证URL格式
		try {
			new URL(url);
		} catch {
			throw new Error('URL格式无效');
		}

		return {
			created,
			title,
			url,
			description,
			tags,
			screenshotFileName: '' // 将在后续步骤中填充
		};
	}

	/**
	 * 生成并下载网站截图（带进度显示）
	 * 
	 * @private
	 * @param {string} title - 网站标题，用于生成文件名
	 * @param {string} url - 网站URL
	 * @param {ProgressModal} progressModal - 进度模态框
	 * @returns {Promise<string>} 截图文件名
	 * @throws {Error} 当截图生成失败时抛出错误
	 */
	private async generateAndDownloadScreenshotWithProgress(
		title: string, 
		url: string, 
		progressModal: ProgressModal
	): Promise<string> {
		// 清理文件名
		const safeTitle = this.sanitizeFileName(title);
		const screenshotFileName = `${safeTitle}.png`;
		const screenshotPath = `${this.settings.attachmentFolder}/${screenshotFileName}`;

		// 从截图URL中提取等待时间
		const waitTime = this.extractWaitTimeFromScreenshotUrl(url) || 12;
		const totalTime = waitTime + 10; // 基础等待时间 + 10秒额外时间
		
		console.log(`截图等待时间: ${waitTime}秒，总预计时间: ${totalTime}秒`);

		// 开始下载并模拟进度
		const downloadPromise = this.downloadScreenshot(
			`https://image.thum.io/get/wait/${waitTime}/viewportWidth/1600/width/1440/crop/900/png/noanimate/${url}`, 
			screenshotPath
		);

		// 模拟进度更新
		await this.simulateProgressWithRealTime(progressModal, 'screenshot', totalTime);

		await downloadPromise;
		return screenshotFileName;
	}

	/**
	 * 从截图URL中提取等待时间
	 * 
	 * @private
	 * @param {string} url - 截图服务URL
	 * @returns {number | null} 等待时间（秒）
	 */
	private extractWaitTimeFromScreenshotUrl(url: string): number | null {
		// 尝试从URL中提取等待时间参数
		const waitMatch = url.match(/wait\/(\d+)/);
		if (waitMatch) {
			return parseInt(waitMatch[1], 10);
		}
		return null;
	}

	/**
	 * 模拟实时进度更新
	 * 
	 * @private
	 * @param {ProgressModal} progressModal - 进度模态框
	 * @param {string} stepId - 步骤ID
	 * @param {number} totalTime - 总时间（秒）
	 * @returns {Promise<void>}
	 */
	private async simulateProgressWithRealTime(
		progressModal: ProgressModal, 
		stepId: string, 
		totalTime: number
	): Promise<void> {
		const startTime = Date.now();
		const updateInterval = 500; // 每500ms更新一次
		let lastProgress = 0;

		return new Promise<void>((resolve) => {
			const interval = setInterval(() => {
				const elapsed = Date.now() - startTime;
				const progress = Math.min(Math.round((elapsed / (totalTime * 1000)) * 100), 95); // 最多到95%，留5%给实际完成

				if (progress !== lastProgress) {
					progressModal.updateProgress(stepId, progress, `正在处理... ${progress}%`);
					lastProgress = progress;
				}

				if (elapsed >= totalTime * 1000) {
					clearInterval(interval);
					resolve();
				}
			}, updateInterval);
		});
	}

	/**
	 * 生成并下载网站截图
	 * 
	 * @private
	 * @param {string} title - 网站标题，用于生成文件名
	 * @param {string} url - 网站URL
	 * @returns {Promise<string>} 截图文件名
	 * @throws {Error} 当截图下载失败时抛出错误
	 */
	private async generateAndDownloadScreenshot(title: string, url: string): Promise<string> {
		// 清理文件名
		const safeTitle = this.sanitizeFileName(title);
		const screenshotFileName = `${safeTitle}.png`;
		const screenshotPath = `${this.settings.attachmentFolder}/${screenshotFileName}`;

		// 生成截图URL
		const screenshotUrl = `https://image.thum.io/get/wait/12/viewportWidth/1600/width/1440/crop/900/png/noanimate/${url}`;

		// 下载截图
		await this.downloadScreenshot(screenshotUrl, screenshotPath);

		return screenshotFileName;
	}

	/**
	 * 创建笔记文件
	 * 
	 * @private
	 * @param {string} title - 笔记标题
	 * @param {string} content - 笔记内容
	 * @returns {Promise<TFile>} 创建的文件对象
	 * @throws {Error} 当文件创建失败时抛出错误
	 */
	private async createNoteFile(title: string, content: string): Promise<TFile> {
		// 清理文件名
		const safeTitle = this.sanitizeFileName(title);
		const fileName = `${safeTitle}.md`;
		const filePath = `${this.settings.bookmarkFolder}/${fileName}`;

		// 确保文件可以被创建（处理同名文件情况）
		const finalFilePath = await this.ensureFileCanBeCreated(filePath);

		// 创建笔记文件
		return await this.app.vault.create(finalFilePath, content);
	}

	/**
	 * 确保文件夹存在
	 * 
	 * @private
	 * @param {string} folderPath - 文件夹路径
	 * @returns {Promise<void>}
	 * @throws {Error} 当文件夹创建失败时抛出错误
	 */
	private async ensureFolderExists(folderPath: string): Promise<void> {
		try {
			const folder = this.app.vault.getAbstractFileByPath(folderPath);
			
			// 如果路径不存在，创建文件夹
			if (!folder) {
				await this.app.vault.createFolder(folderPath);
				return;
			}
			
			// 如果路径存在但不是文件夹，抛出错误
			if (!(folder instanceof TFolder)) {
				throw new Error(`路径 "${folderPath}" 已存在但不是文件夹`);
			}
			
			// 文件夹已存在，无需操作
		} catch (error) {
			// 如果错误是 "Folder already exists"，忽略它
			if (error instanceof Error && error.message && error.message.includes('Folder already exists')) {
				console.log(`文件夹 "${folderPath}" 已存在，跳过创建`);
				return;
			}
			// 其他错误重新抛出
			throw error;
		}
	}

	/**
	 * 清理文件名，移除非法字符
	 * 
	 * @private
	 * @param {string} fileName - 原始文件名
	 * @returns {string} 清理后的文件名
	 */
	private sanitizeFileName(fileName: string): string {
		return fileName.replace(/[<>:\"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
	}

	/**
	 * 下载截图
	 * 
	 * @private
	 * @param {string} url - 截图URL
	 * @param {string} filePath - 保存的文件路径
	 * @returns {Promise<void>}
	 * @throws {Error} 当下载失败时抛出错误
	 */
	private async downloadScreenshot(url: string, filePath: string): Promise<void> {
		console.log('Downloading screenshot from:', url);
		try {
			const response = await requestUrl({
				url: url,
				method: 'GET',
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
				}
			});

			if (response.status === 200) {
				console.log('Screenshot downloaded successfully');
				await this.app.vault.createBinary(filePath, response.arrayBuffer);
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
	 * 
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
	 * 构建笔记内容
	 * 
	 * @private
	 * @param {NoteContentData} data - 笔记数据
	 * @returns {string} 生成的笔记内容
	 */
	private buildNoteContent(data: NoteContentData): string {
		const tagsString = data.tags.length > 0 ? data.tags.join(', ') : '';
		const screenshotLink = `screenshot:: ![网站截图](${this.settings.attachmentFolder}/${encodeURIComponent(data.screenshotFileName)})`;

		return `---
created: ${data.created}
title: "${data.title}"
url: "${data.url}"
description: "${data.description}"
tags: [${tagsString}]
---

## 网站截图

${screenshotLink}

## 网站笔记

`;
	}
}
