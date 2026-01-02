/**
 * 书签创建器插件设置接口
 * 定义插件的配置选项
 * 
 * @interface BookmarkCreatorSettings
 */
export interface BookmarkCreatorSettings {
	/** 存储书签笔记的文件夹路径 */
	bookmarkFolder: string;
	/** 存储截图的文件夹路径 */
	attachmentFolder: string;
	/** Jina AI API密钥 */
	jinaApiKey: string;
	/** AI处理API基础URL */
	aiApiBaseUrl: string;
	/** AI处理API模型 */
	aiApiModel: string;
	/** AI处理API密钥 */
	aiApiKey: string;
	/** AI提示词模板 */
	aiPromptTemplate: string;
}

/**
 * AI服务类型
 * 定义可用的AI服务类型
 * 
 * @type AiServiceType
 */
export type AiServiceType = 'jinaReader' | 'jinaSearch' | 'openai';

/**
 * 模态框类型
 * 定义可用的模态框类型
 * 
 * @type modalType
 */
export type modalType = 'input' | 'progress' | 'simple-progress';

/**
 * 网站信息对象
 * 包含从Jina AI提取的网页内容和搜索信息
 * 
 * @interface siteInfoObj
 */
export interface siteInfoObj {
    webContent: string;
    searchInfo: string;
}
/**
 * 构建笔记内容所需的数据接口
 * 定义用于生成笔记内容的完整数据结构
 * 
 * @interface NoteContentData
 */
export interface NoteContentData {
	/** 创建时间 */
	created: string;
	/** 网站标题 */
	title: string;
	/** 网站URL */
	url: string;
	/** 网站描述 */
	description: string;
	/** 标签数组 */
	tags: string[];
	/** 截图文件名 */
	screenshotFileName: string;
	/** 书签笔记内容 */
	bookmarkNote?: string;
}

/** 步骤状态类型 */
export type stepStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * 工作流取消异常类
 * 用于标识工作流被取消的情况
 * 
 * @class WorkflowCancellationError
 * @extends Error
 */
export class WorkflowCancellationError extends Error {
	constructor(message: string = '工作流已取消') {
		super(message);
		this.name = 'WorkflowCancellationError';
	}
}