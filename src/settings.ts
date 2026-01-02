import { App, PluginSettingTab, Setting } from 'obsidian';
import { BookmarkCreatorSettings } from './types';
import BookmarkCreatorPlugin from './main';

/**
 * 默认设置
 * 插件的默认配置值
 * 
 * @constant {BookmarkCreatorSettings} DEFAULT_SETTINGS
 */
export const DEFAULT_SETTINGS: BookmarkCreatorSettings = {
	bookmarkFolder: 'Bookmarks',
	attachmentFolder: 'assets/images',
	jinaApiKey: '',
	aiApiBaseUrl: 'https://api.openai.com/v1',
	aiApiModel: 'gpt-3.5-turbo',
	aiApiKey: '',
	aiPromptTemplate: `请根据提供的网页内容和搜索信息，生成完整的书签YAML信息。我会提供目标网址、网页内容摘要以及相关搜索评价，你需要生成符合Obsidian书签格式的YAML数据。

## 生成要求：

### 标题规范
- 使用简洁的网站名称，不包含描述性文字
- 去除冗余的公司、官网等字样
- 保持原始品牌名称，不要翻译专有名词

### 描述规范  
- 说明网站的核心功能和价值
- 突出网站的主要用途和特色
- 使用简体中文，避免冗长介绍
- 描述要具体有用，避免空泛的形容词
- 不超过 300 字

### 标签规范
1. **主要分类标签**（1-2个）：
   - 从预设分类中选择最合适的分类
   - 格式：一级分类/二级分类
   - 优先选择最贴切的单一分类

2. **功能标签**（2-4个）：
   - 描述网站的核心功能或特点
   - 使用简洁的中文词汇
   - 避免过于宽泛的标签

3. **特色标签**（1-2个）：
   - 突出网站的独特之处
   - 可以是技术特点、用户群体、内容类型等

总标签数量控制在4-7个，确保每个标签都有实际意义。

## 输出格式：

严格按照以下YAML格式输出，标签使用列表格式：

\`\`\`yaml
---
created: 
title: 网站标题
url: 目标网址
description: 网站功能描述
tags: 
    - 分类标签
    - 功能标签1
    - 功能标签2
    - 特色标签
---
\`\`\`

## 预设分类：

- 工作学习：办公软件、开发工具、设计资源、学习平台、文档资料
- 实用工具：搜索引擎、翻译工具、文件处理、系统工具、安全隐私  
- 科技数码：产品资讯、软件下载、硬件信息、教程攻略
- 购物消费：电商平台、比价工具、支付服务、购物攻略
- 娱乐影音：视频网站、音乐平台、游戏娱乐、阅读小说
- 新闻资讯：综合新闻、行业资讯、本地信息
- 生活休闲：旅游出行、美食烹饪、健康养生、家居生活
- 社交社区：社交平台、论坛社区、博客平台
- 投资理财：股票基金、财经资讯、理财工具
- 管理维护：待处理、重要备份、历史存档、测试开发

## 注意事项：

- 保持YAML语法正确，使用多行标签格式
- 标签优先使用简体中文，如非必要的专业名词避免英文标签
- 不要添加引号，除非必要
- 确保生成的信息准确反映网站实际内容`
};

/**
 * 插件设置页面类
 * 负责渲染和管理插件的设置界面
 * 
 * @class BookmarkCreatorSettingTab
 * @extends {PluginSettingTab}
 */
export class BookmarkCreatorSettingTab extends PluginSettingTab {
	/** 插件实例 */
	plugin: BookmarkCreatorPlugin;

	/**
	 * 构造函数
	 * @param app - Obsidian应用实例
	 * @param plugin - 书签创建器插件实例
	 */
	constructor(app: App, plugin: BookmarkCreatorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * 显示设置页面
	 * 渲染所有设置选项和说明
	 * 
	 * @returns {void}
	 */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: '书签创建器设置' });

		// 基础设置
		containerEl.createEl('h3', { text: '基础设置' });
		this.createBookmarkFolderSetting(containerEl);
		this.createAttachmentFolderSetting(containerEl);
		
		// Jina AI API设置
		containerEl.createEl('h3', { text: 'Jina AI API设置' });
		this.createJinaApiKeySetting(containerEl);
		
		// AI处理API设置
		containerEl.createEl('h3', { text: 'AI处理API设置' });
		this.createAiApiBaseUrlSetting(containerEl);
		this.createAiApiModelSetting(containerEl);
		this.createAiApiKeySetting(containerEl);
		this.createAiPromptTemplateSetting(containerEl);
		
		// 使用说明
		this.createUsageInstructions(containerEl);
		
		// 捐助支持
		this.createDonationSection(containerEl);
	}

	/**
	 * 创建书签文件夹设置
	 * @private
	 * @param {HTMLElement} containerEl - 容器元素
	 * @returns {void}
	 */
	private createBookmarkFolderSetting(containerEl: HTMLElement): void {
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
	}

	/**
	 * 创建附件文件夹设置
	 * @private
	 * @param {HTMLElement} containerEl - 容器元素
	 * @returns {void}
	 */
	private createAttachmentFolderSetting(containerEl: HTMLElement): void {
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
	}

	/**
	 * 创建使用说明
	 * @private
	 * @param {HTMLElement} containerEl - 容器元素
	 * @returns {void}
	 */
	private createUsageInstructions(containerEl: HTMLElement): void {
		// 使用说明标题
		containerEl.createEl('h3', { text: '使用说明' });
		
		// 使用步骤说明
		const instructions = [
			'1. 使用命令面板 (Ctrl/Cmd + P) 输入 "创建书签笔记" 来启动插件',
			'2. 支持两种输入方式：',
			'   - YAML格式：按传统方式输入完整的书签信息',
			'   - 直接输入网址：插件将使用AI自动生成书签信息',
			'3. 插件会自动补全创建时间、生成网站截图并创建笔记',
			'4. 截图可能需要几秒钟时间生成，请耐心等待'
		];
		
		instructions.forEach(instruction => {
			containerEl.createEl('p', { text: instruction });
		});

		// YAML格式示例
		this.createYamlExample(containerEl);
		
		// AI功能说明
		this.createAiFeatureInstructions(containerEl);
	}

	/**
	 * 创建AI功能使用说明
	 * @private
	 * @param {HTMLElement} containerEl - 容器元素
	 * @returns {void}
	 */
	private createAiFeatureInstructions(containerEl: HTMLElement): void {
		containerEl.createEl('h4', { text: 'AI自动生成功能：' });
		
		const aiInstructions = [
			'• 直接输入网址（如：https://example.com/）',
			'• 插件会自动：',
			'  - 使用Jina AI提取网页内容',
			'  - 搜索相关信息和评价',
			'  - 使用AI生成完整的书签YAML信息',
			'• 需要配置Jina AI API密钥和AI API密钥',
			'• 生成的书签包含标题、描述和合适的标签'
		];
		
		aiInstructions.forEach(instruction => {
			containerEl.createEl('p', { text: instruction });
		});
	}

	/**
	 * 创建Jina API密钥设置
	 * @private
	 * @param {HTMLElement} containerEl - 容器元素
	 * @returns {void}
	 */
	private createJinaApiKeySetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Jina AI API密钥')
			.setDesc('用于提取网页内容的Jina AI API密钥（可选）')
			.addText(text => text
				.setPlaceholder('输入Jina AI API密钥')
				.setValue(this.plugin.settings.jinaApiKey)
				.onChange(async (value) => {
					this.plugin.settings.jinaApiKey = value.trim();
					await this.plugin.saveSettings();
				}));
	}

	/**
	 * 创建AI API基础URL设置
	 * @private
	 * @param {HTMLElement} containerEl - 容器元素
	 * @returns {void}
	 */
	private createAiApiBaseUrlSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('AI API基础URL')
			.setDesc('AI处理API的基础URL，默认为OpenAI格式')
			.addText(text => text
				.setPlaceholder('https://api.openai.com/v1')
				.setValue(this.plugin.settings.aiApiBaseUrl)
				.onChange(async (value) => {
					this.plugin.settings.aiApiBaseUrl = value.trim() || 'https://api.openai.com/v1';
					await this.plugin.saveSettings();
				}));
	}

	/**
	 * 创建AI API模型设置
	 * @private
	 * @param {HTMLElement} containerEl - 容器元素
	 * @returns {void}
	 */
	private createAiApiModelSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('AI API模型')
			.setDesc('用于处理书签信息的AI模型名称')
			.addText(text => text
				.setPlaceholder('gpt-3.5-turbo')
				.setValue(this.plugin.settings.aiApiModel)
				.onChange(async (value) => {
					this.plugin.settings.aiApiModel = value.trim() || 'gpt-3.5-turbo';
					await this.plugin.saveSettings();
				}));
	}

	/**
	 * 创建AI API密钥设置
	 * @private
	 * @param {HTMLElement} containerEl - 容器元素
	 * @returns {void}
	 */
	private createAiApiKeySetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('AI API密钥')
			.setDesc('用于处理书签信息的AI API密钥')
			.addText(text => text
				.setPlaceholder('输入AI API密钥')
				.setValue(this.plugin.settings.aiApiKey)
				.onChange(async (value) => {
					this.plugin.settings.aiApiKey = value.trim();
					await this.plugin.saveSettings();
				}));
	}

	/**
	 * 创建AI提示词模板设置
	 * @private
	 * @param {HTMLElement} containerEl - 容器元素
	 * @returns {void}
	 */
	private createAiPromptTemplateSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('AI提示词模板')
			.setDesc('用于生成书签信息的AI提示词模板')
			.addTextArea(text => {
				text.setPlaceholder('输入AI提示词模板')
					.setValue(this.plugin.settings.aiPromptTemplate)
					.onChange(async (value) => {
						this.plugin.settings.aiPromptTemplate = value.trim() || DEFAULT_SETTINGS.aiPromptTemplate;
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 10;
				text.inputEl.style.fontFamily = 'monospace';
				text.inputEl.style.fontSize = '12px';
				text.inputEl.style.width = '100%';
			});
	}

	/**
	 * 创建YAML格式示例
	 * @private
	 * @param {HTMLElement} containerEl - 容器元素
	 * @returns {void}
	 */
	private createYamlExample(containerEl: HTMLElement): void {
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
		
		// 设置示例代码样式
		exampleCode.style.backgroundColor = '#f5f5f5';
		exampleCode.style.padding = '10px';
		exampleCode.style.borderRadius = '4px';
		exampleCode.style.fontFamily = 'monospace';
		exampleCode.style.fontSize = '14px';
		exampleCode.style.overflowX = 'auto';
	}

	/**
	 * 创建捐助支持部分
	 * @private
	 * @param {HTMLElement} containerEl - 容器元素
	 * @returns {void}
	 */
	private createDonationSection(containerEl: HTMLElement): void {
		// 分隔线
		containerEl.createEl('hr').style.margin = '30px 0';
		
		// 捐助标题
		containerEl.createEl('h3', { text: '支持开发者' });
		
		// 捐助说明
		containerEl.createEl('p', { 
			text: '如果这个插件对你有帮助，希望能请我喝杯咖啡，这将会使我开心好一阵子~',
			cls: 'donation-description'
		});
		
		// 爱发电链接按钮
		const donationContainer = containerEl.createDiv({ cls: 'donation-container' });
		donationContainer.style.display = 'flex';
		donationContainer.style.alignItems = 'center';
		donationContainer.style.gap = '10px';
		donationContainer.style.marginTop = '15px';
		
		const donationButton = donationContainer.createEl('a', {
			text: '☕ 爱发电支持',
			href: 'https://afdian.com/a/daomishu',
			title: '点击跳转到爱发电页面支持开发者'
		});
		
		// 设置按钮样式
		donationButton.style.display = 'inline-block';
		donationButton.style.padding = '8px 16px';
		donationButton.style.backgroundColor = '#8B62DC';
		donationButton.style.color = 'white';
		donationButton.style.textDecoration = 'none';
		donationButton.style.borderRadius = '6px';
		donationButton.style.fontWeight = 'bold';
		donationButton.style.transition = 'background-color 0.3s ease';
		
		// 悬停效果
		donationButton.addEventListener('mouseenter', () => {
			donationButton.style.backgroundColor = '#6d41c3ff';
		});
		
		donationButton.addEventListener('mouseleave', () => {
			donationButton.style.backgroundColor = '#8B62DC';
		});
		
		// 感谢文字
		donationContainer.createEl('span', {
			text: '每一份支持都是我持续更新的动力！',
			cls: 'donation-thanks'
		}).style.color = '#666';
	}
}
