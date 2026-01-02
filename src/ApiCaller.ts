import { Notice, requestUrl, RequestUrlResponse } from 'obsidian';
import { BookmarkCreatorSettings, AiServiceType, siteInfoObj } from './types';

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
     * 调用AI API
     * @param {string} url - 要处理的URL
     * @param {AiServiceType} type - 服务类型（jinaReader、jinaSearch或openai）
     * @param {siteInfoObj} [siteInfo] - 可选的站点信息对象，用于openai服务
     * @returns {Promise<string>} 处理后的内容或错误消息
     * @throws {Error} 当服务类型无效、API密钥未设置、URL格式错误或API调用失败时抛出错误
     */
    async callApi(url: string, type: AiServiceType, siteInfo?: siteInfoObj): Promise<string> {
        // 验证服务类型
        if (type === 'jinaReader' || type === 'jinaSearch') {
            if (!this.settings.jinaApiKey) {
                throw new Error('Jina AI API密钥未设置');
            }
            // 验证URL格式
            try {
                new URL(url);
            } catch {
                throw new Error('无效的网址格式');
            }
        } else if (type === 'openai') {
            if (!this.settings.aiApiKey) {
                throw new Error('AI API密钥未设置');
            }
            // 验证API基础URL格式
            try {
                new URL(this.settings.aiApiBaseUrl);
            } catch {
                throw new Error('AI API基础URL格式无效');
            }
        } else {
            throw new Error(`未知的AI服务类型: ${type}`);
        }
        // 定义服务名称映射
        const typeNames: Record<AiServiceType, string> = {
            'jinaReader': 'Jina AI 读取器',
            'jinaSearch': 'Jina AI 搜索器',
            'openai': 'AI 处理器'
        };
        const serviceName = typeNames[type];
        // 发起请求
        let response: any;
        try {
            if (type === 'jinaReader') {
                response = await requestUrl({
                    url: `https://r.jina.ai/${encodeURIComponent(url)}`,
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.settings.jinaApiKey}`,
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
            } else if (type === 'jinaSearch') {
                const domain = new URL(url).hostname;
                response = await requestUrl({
                    url: `https://s.jina.ai/${encodeURIComponent(domain)}`,
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.settings.jinaApiKey}`,
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
            } else if (type === 'openai') {
                response = await this.generateBookmarkYaml(url, siteInfo.webContent, siteInfo.searchInfo);
            }
            // 处理API响应
            if (response.status === 200) {
                const data = JSON.parse(response.text);
                const content = ( type === 'openai'
                                    ? data.choices?.[0]?.message?.content
                                    : (data.data?.content  || data?.data?.toString() || data.content)
                                ) || '';
                if (!content || content.trim().length === 0) {
                    console.log(`${serviceName}: API返回内容为空:`, data);
                }
                return content;
            } else if (response.status === 401) {
                throw new Error(`${serviceName}: API密钥无效或已过期`);
            } else if (response.status === 429) {
                throw new Error(`${serviceName}: API请求过于频繁，请稍后再试`);
            } else if (response.status >= 500) {
                throw new Error(`${serviceName}: 服务暂时不可用，请稍后再试`);
            } else {
                throw new Error(`${serviceName}: API返回错误，状态码: ${response.status}`);
            }
        } catch (error) {
            console.error(`${serviceName}: 调用API时发生错误:`, error);
            if (error instanceof Error) {
                throw new Error(`AI书签生成失败: ${error.message}`);
            } else {
                throw new Error('AI书签生成失败: 未知错误');
            }
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
    async generateBookmarkYaml(url: string, webContent: string, searchInfo: string): Promise<RequestUrlResponse> {
        // 检查输入内容长度，避免过长的提示词
        const truncatedWebContent = webContent.length > 2000 
            ? webContent.substring(0, 2000) + '...' 
            : webContent;
        const truncatedSearchInfo = searchInfo.length > 8000 
            ? searchInfo.substring(0, 8000) + '...' 
            : searchInfo;

        const prompt = `${this.settings.aiPromptTemplate}

## 网页内容：
${truncatedWebContent}

## 搜索信息：
${truncatedSearchInfo}

## 目标网址：
${url}
`;

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

        return response;
    }
}
