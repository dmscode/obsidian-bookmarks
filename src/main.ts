import { App, Plugin, Notice } from 'obsidian';
import { BookmarkCreatorSettings } from './types';
import { DEFAULT_SETTINGS, BookmarkCreatorSettingTab } from './settings';
import { BookmarkModal } from './modal';

/**
 * 书签创建器插件主类
 * Obsidian插件的入口点，负责初始化和协调各个模块
 * 
 * @class BookmarkCreatorPlugin
 * @extends {Plugin}
 */
export default class BookmarkCreatorPlugin extends Plugin {
	/** 插件设置 */
	settings: BookmarkCreatorSettings = DEFAULT_SETTINGS;

	/**
	 * 插件加载时的初始化
	 * 设置命令、设置页面等
	 * 
	 * @async
	 * @returns {Promise<void>}
	 */
	async onload(): Promise<void> {
		await this.loadSettings();

		// 添加创建书签命令
		this.addCommand({
			id: 'create-bookmark',
			name: '创建书签笔记',
			callback: () => {
				new BookmarkModal(this.app, this).open();
			}
		});

		// 添加设置页面
		this.addSettingTab(new BookmarkCreatorSettingTab(this.app, this));

		console.log('书签创建器插件已加载');
	}

	/**
	 * 插件卸载时的清理
	 * 
	 * @returns {void}
	 */
	onunload(): void {
		console.log('书签创建器插件已卸载');
	}

	/**
	 * 加载插件设置
	 * 从存储中读取设置，如果不存在则使用默认设置
	 * 
	 * @async
	 * @returns {Promise<void>}
	 */
	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * 保存插件设置
	 * 将当前设置保存到存储中
	 * 
	 * @async
	 * @returns {Promise<void>}
	 */
	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
