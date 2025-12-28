import { Notice, requestUrl } from 'obsidian';
import { BookmarkCreatorSettings } from './types';

/**
 * AI服务类
 * 负责处理Jina AI API调用和AI生成书签信息
 * 
 * @class AiService
 */
export class AiService {
	/** 插件设置 */
	private settings: BookmarkCreatorSettings;

	/**
	 * 构造函数
	 * @param {BookmarkCreatorSettings} settings - 插件设置
	 */
	constructor(settings: BookmarkCreatorSettings) {
		this.settings = settings;
	}

	/**
	 * 使用Jina AI提取网页内容
	 * @param {string} url - 网页URL
	 * @returns {Promise<string>} 网页内容
	 * @throws {Error} 当API调用失败时抛出错误
	 */
	async extractWebContent(url: string): Promise<string> {
		if (!this.settings.jinaApiKey) {
			throw new Error('Jina AI API密钥未设置');
		}

		// 验证URL格式
		try {
			new URL(url);
		} catch {
			throw new Error('无效的网址格式');
		}

		try {
			const response = await requestUrl({
				url: `https://r.jina.ai/${encodeURIComponent(url)}`,
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.settings.jinaApiKey}`,
					'Accept': 'application/json',
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
				}
			});

			if (response.status === 200) {
				const data = JSON.parse(response.text);
				const content = data.data?.content || data.content || '';
				if (!content || content.trim().length === 0) {
					throw new Error('网页内容为空或无法提取');
				}
				return content;
			} else if (response.status === 401) {
				throw new Error('Jina AI API密钥无效或已过期');
			} else if (response.status === 429) {
				throw new Error('Jina AI API请求过于频繁，请稍后再试');
			} else if (response.status >= 500) {
				throw new Error('Jina AI服务暂时不可用，请稍后再试');
			} else {
				throw new Error(`Jina AI API返回错误，状态码: ${response.status}`);
			}
		} catch (error) {
			console.error('Jina AI内容提取失败:', error);
			if (error instanceof Error) {
				if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
					throw new Error('网络连接失败，请检查网络设置');
				}
				throw new Error(`网页内容提取失败: ${error.message}`);
			} else {
				throw new Error('网页内容提取失败: 未知错误');
			}
		}
	}

	/**
	 * 使用Jina AI搜索网页相关信息
	 * @param {string} url - 网页URL
	 * @returns {Promise<string>} 搜索结果
	 * @throws {Error} 当API调用失败时抛出错误（可选功能，失败时返回空字符串）
	 */
	async searchWebInfo(url: string): Promise<string> {
		if (!this.settings.jinaApiKey) {
			throw new Error('Jina AI API密钥未设置');
		}

		// 验证URL格式
		try {
			new URL(url);
		} catch {
			throw new Error('无效的网址格式');
		}

		try {
			// 提取域名作为搜索关键词
			const domain = new URL(url).hostname;
			const searchQuery = `${domain} 网站评价 介绍`;

			const response = await requestUrl({
				url: `https://s.jina.ai/${encodeURIComponent(searchQuery)}`,
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.settings.jinaApiKey}`,
					'Accept': 'application/json',
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
				}
			});

			if (response.status === 200) {
				const data = JSON.parse(response.text);
				const content = data.data?.content || data.content || '';
				// 搜索功能可选，如果失败返回空字符串而不是抛出错误
				return content;
			} else if (response.status === 401) {
				console.warn('Jina AI搜索API密钥无效，跳过搜索步骤');
				return '';
			} else if (response.status === 429) {
				console.warn('Jina AI搜索API请求过于频繁，跳过搜索步骤');
				return '';
			} else {
				console.warn(`Jina AI搜索API返回错误，状态码: ${response.status}，跳过搜索步骤`);
				return '';
			}
		} catch (error) {
			console.error('Jina AI搜索失败:', error);
			// 搜索功能可选，失败时返回空字符串
			return '';
		}
	}

	/**
	 * 使用AI生成书签YAML信息
	 * @param {string} url - 网页URL
	 * @param {string} webContent - 网页内容
	 * @param {string} searchInfo - 搜索信息
	 * @returns {Promise<string>} 生成的YAML内容
	 * @throws {Error} 当API调用失败或生成内容无效时抛出错误
	 */
	async generateBookmarkYaml(url: string, webContent: string, searchInfo: string): Promise<string> {
		if (!this.settings.aiApiKey) {
			throw new Error('AI API密钥未设置');
		}

		// 验证API基础URL格式
		try {
			new URL(this.settings.aiApiBaseUrl);
		} catch {
			throw new Error('AI API基础URL格式无效');
		}

		// 检查输入内容长度，避免过长的提示词
		const maxContentLength = 8000;
		const truncatedWebContent = webContent.length > maxContentLength 
			? webContent.substring(0, maxContentLength) + '...' 
			: webContent;
		const truncatedSearchInfo = searchInfo.length > 2000 
			? searchInfo.substring(0, 2000) + '...' 
			: searchInfo;

		const prompt = `${this.settings.aiPromptTemplate}

## 网页内容：
${truncatedWebContent}

## 搜索信息：
${truncatedSearchInfo}

## 目标网址：
${url}

请根据以上信息生成完整的书签YAML信息。`;

		try {
			const response = await requestUrl({
				url: `${this.settings.aiApiBaseUrl}/chat/completions`,
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.settings.aiApiKey}`,
					'Content-Type': 'application/json',
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
				},
				body: JSON.stringify({
					model: this.settings.aiApiModel,
					messages: [
						{
							role: 'user',
							content: prompt
						}
					],
					temperature: 0.3, // 降低温度以获得更稳定的输出
					max_tokens: 1500, // 减少最大token数以避免过长的响应
					top_p: 0.9
				})
			});

			if (response.status === 200) {
				const data = JSON.parse(response.text);
				const generatedContent = data.choices?.[0]?.message?.content || '';
				
				if (!generatedContent || generatedContent.trim().length === 0) {
					throw new Error('AI未生成任何内容');
				}

				// 提取YAML内容（移除可能的markdown代码块标记）
				const yamlMatch = generatedContent.match(/```[\s\S]*?\n([\s\S]*?)```|---\s*\n([\s\S]*?)\n---/);
				let yamlContent;
				if (yamlMatch) {
					yamlContent = yamlMatch[1] || yamlMatch[2] || generatedContent;
				} else {
					yamlContent = generatedContent;
				}

				// 验证生成的YAML内容是否包含必需字段
				if (!yamlContent.includes('title:') || !yamlContent.includes('url:')) {
					throw new Error('生成的YAML内容缺少必需字段（title或url）');
				}

				return yamlContent;
			} else if (response.status === 401) {
				throw new Error('AI API密钥无效或已过期');
			} else if (response.status === 429) {
				throw new Error('AI API请求过于频繁，请稍后再试');
			} else if (response.status === 400) {
				throw new Error('AI API请求参数错误，请检查模型名称是否正确');
			} else if (response.status >= 500) {
				throw new Error('AI服务暂时不可用，请稍后再试');
			} else {
				throw new Error(`AI API返回错误，状态码: ${response.status}`);
			}
		} catch (error) {
			console.error('AI生成书签信息失败:', error);
			if (error instanceof Error) {
				if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
					throw new Error('网络连接失败，请检查网络设置');
				}
				throw new Error(`AI生成书签信息失败: ${error.message}`);
			} else {
				throw new Error('AI生成书签信息失败: 未知错误');
			}
		}
	}

	/**
	 * 完整的AI书签生成流程
	 * @param {string} url - 网页URL
	 * @returns {Promise<string>} 生成的YAML内容
	 * @throws {Error} 当整个流程中的任何步骤失败时抛出错误
	 */
	async generateBookmarkFromUrl(url: string): Promise<string> {
		try {
			// 移除Notice提示，由调用方通过进度模态框控制
			const webContent = await this.extractWebContent(url);
			const searchInfo = await this.searchWebInfo(url);
			const yamlContent = await this.generateBookmarkYaml(url, webContent, searchInfo);
			
			return yamlContent;
		} catch (error) {
			console.error('AI书签生成流程失败:', error);
			if (error instanceof Error) {
				throw new Error(`AI书签生成失败: ${error.message}`);
			} else {
				throw new Error('AI书签生成失败: 未知错误');
			}
		}
	}
}
