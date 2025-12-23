import { App, Plugin, PluginSettingTab, Setting, Modal, Notice, TFile, TFolder, requestUrl } from 'obsidian';

interface BookmarkCreatorSettings {
	bookmarkFolder: string;
	attachmentFolder: string;
}

const DEFAULT_SETTINGS: BookmarkCreatorSettings = {
	bookmarkFolder: 'Bookmarks',
	attachmentFolder: 'assets/images'
}

export default class BookmarkCreatorPlugin extends Plugin {
	settings: BookmarkCreatorSettings;

	async onload() {
		await this.loadSettings();

		// 添加命令
		this.addCommand({
			id: 'create-bookmark',
			name: '创建书签笔记',
			callback: () => {
				new BookmarkModal(this.app, this).open();
			}
		});

		// 添加设置页面
		this.addSettingTab(new BookmarkCreatorSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}


	/**
	 * 确保文件夹存在
	 */
	private async ensureFolderExists(folderPath: string) {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			await this.app.vault.createFolder(folderPath);
		}
	}

	/**
	 * 清理文件名，移除非法字符
	 */
	private sanitizeFileName(fileName: string): string {
		return fileName.replace(/[<>:\"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
	}

	/**
	 * 下载截图
	 */
	private async downloadScreenshot(url: string, filePath: string) {
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
				await this.app.vault.createBinary(filePath, response.arrayBuffer);
			} else {
				throw new Error(`截图下载失败，状态码: ${response.status}`);
			}
		} catch (error) {
			console.error('下载截图失败:', error);
			throw new Error(`无法下载网站截图: ${error.message}`);
		}
	}

	/**
	 * 从YAML数据创建书签笔记
	 */
	async createBookmarkNoteFromYaml(yamlData: any) {
		try {
			// 确保文件夹存在
			await this.ensureFolderExists(this.settings.bookmarkFolder);
			await this.ensureFolderExists(this.settings.attachmentFolder);

			// 提取数据
			let title = yamlData.title || '';
			const url = yamlData.url || '';
			const description = yamlData.description || '';
			const tags = yamlData.tags || [];
			
			// 补全创建时间
			const created = yamlData.created || new Date().toLocaleString('zh-CN').replace(/\//g, '-');

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

			// 清理文件名，移除非法字符
			const safeTitle = this.sanitizeFileName(title);
			const fileName = `${safeTitle}.md`;
			const filePath = `${this.settings.bookmarkFolder}/${fileName}`;

			// 生成截图
			const screenshotUrl = `https://image.thum.io/get/wait/12/viewportWidth/1600/width/1440/crop/900/png/noanimate/${url}`;
			const screenshotFileName = `${safeTitle}.png`;
			const screenshotPath = `${this.settings.attachmentFolder}/${screenshotFileName}`;

			// 下载截图
			await this.downloadScreenshot(screenshotUrl, screenshotPath);

			// 构建笔记内容
			const noteContent = this.buildNoteContentFromYaml({
				created,
				title,
				url,
				description,
				tags,
				screenshotFileName
			});

			// 创建笔记文件
			const file = await this.app.vault.create(filePath, noteContent);

			// 自动打开笔记
			await this.app.workspace.getLeaf().openFile(file);

			new Notice(`书签笔记 "${title}" 创建成功！`);
		} catch (error) {
			console.error('创建书签笔记失败:', error);
			new Notice(`创建书签笔记失败: ${error.message}`);
		}
	}

	/**
	 * 从YAML数据构建笔记内容
	 */
	private buildNoteContentFromYaml(data: {
		created: string;
		title: string;
		url: string;
		description: string;
		tags: string[];
		screenshotFileName: string;
	}): string {
		const tagsString = data.tags.length > 0 ? data.tags.join(', ') : '';
		const screenshotLink = `screenshot:: ![网站截图](${this.settings.attachmentFolder}/${data.screenshotFileName})`;

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

/**
 * 书签输入模态框
 */
class BookmarkModal extends Modal {
	plugin: BookmarkCreatorPlugin;
	yamlTextarea: HTMLTextAreaElement;

	constructor(app: App, plugin: BookmarkCreatorPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: '创建书签笔记' });

		// YAML格式输入
		new Setting(contentEl)
			.setName('书签信息')
			.setDesc('请按YAML格式输入书签信息')
			.addTextArea(text => {
				this.yamlTextarea = text.inputEl;
				text.setPlaceholder(`---
created: 
title: 网站标题
url: https://example.com/
description: 网站描述
tags: 
    - 标签1
    - 标签2
---`);
				this.yamlTextarea.rows = 15;
				this.yamlTextarea.style.fontFamily = 'monospace';
				this.yamlTextarea.style.fontSize = '14px';
			});

		// 按钮区域
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

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * 解析YAML内容
	 */
	private parseYamlContent(yamlText: string): any {
		try {
			// 提取YAML内容（移除前后的---）
			const yamlMatch = yamlText.match(/---\s*\n([\s\S]*?)\n---/);
			if (!yamlMatch) {
				throw new Error('未找到YAML格式内容');
			}

			const yamlContent = yamlMatch[1];
			const result: any = {};

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
						result[currentKey] = currentValue;
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
	 * 创建书签
	 */
	private async createBookmark() {
		const yamlText = this.yamlTextarea.value.trim();

		if (!yamlText) {
			new Notice('请输入书签信息');
			return;
		}

		try {
			// 解析YAML内容
			const parsedData = this.parseYamlContent(yamlText);

			// 提取必需字段
			const title = parsedData.title;
			const url = parsedData.url;

			if (!title) {
				new Notice('请输入标题');
				return;
			}

			if (!url) {
				new Notice('请输入网址');
				return;
			}

			// 验证URL格式
			try {
				new URL(url);
			} catch {
				new Notice('请输入有效的网址');
				return;
			}

			// 关闭模态框
			this.close();

			// 创建书签笔记（传递完整的解析数据）
			await this.plugin.createBookmarkNoteFromYaml(parsedData);
		} catch (error) {
			new Notice(`输入格式错误: ${error.message}`);
		}
	}
}

/**
 * 插件设置页面
 */
class BookmarkCreatorSettingTab extends PluginSettingTab {
	plugin: BookmarkCreatorPlugin;

	constructor(app: App, plugin: BookmarkCreatorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: '书签创建器设置' });

		// 书签文件夹设置
		new Setting(containerEl)
			.setName('书签文件夹')
			.setDesc('存储书签笔记的文件夹路径')
			.addText(text => text
				.setPlaceholder('Bookmarks')
				.setValue(this.plugin.settings.bookmarkFolder)
				.onChange(async (value) => {
					this.plugin.settings.bookmarkFolder = value.trim() || 'Bookmarks';
					await this.plugin.saveSettings();
				}));

		// 附件文件夹设置
		new Setting(containerEl)
			.setName('附件文件夹')
			.setDesc('存储截图的文件夹路径')
			.addText(text => text
				.setPlaceholder('Attachments')
				.setValue(this.plugin.settings.attachmentFolder)
				.onChange(async (value) => {
					this.plugin.settings.attachmentFolder = value.trim() || 'Attachments';
					await this.plugin.saveSettings();
				}));

		// 使用说明
		containerEl.createEl('h3', { text: '使用说明' });
		containerEl.createEl('p', { 
			text: '1. 使用命令面板 (Ctrl/Cmd + P) 输入 "创建书签笔记" 来启动插件' 
		});
		containerEl.createEl('p', { 
			text: '2. 按YAML格式输入书签信息' 
		});
		containerEl.createEl('p', { 
			text: '3. 插件会自动补全创建时间、生成网站截图并创建笔记' 
		});
		containerEl.createEl('p', { 
			text: '4. 截图可能需要几秒钟时间生成，请耐心等待' 
		});

		// YAML格式示例
		containerEl.createEl('h4', { text: 'YAML格式示例：' });
		const exampleCode = containerEl.createEl('pre', {
			text: `---
created: 
title: 小众软件
url: https://www.appinn.com/
description: 专注分享免费、小巧、实用、有趣、绿色软件与应用的团队博客
tags: 
    - 科技数码/软件下载
    - 实用工具
    - 软件评测
---`,
			cls: 'yaml-example'
		});
		exampleCode.style.backgroundColor = '#f5f5f5';
		exampleCode.style.padding = '10px';
		exampleCode.style.borderRadius = '4px';
		exampleCode.style.fontFamily = 'monospace';
		exampleCode.style.fontSize = '14px';
		exampleCode.style.overflowX = 'auto';
	}
}
