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
 * YAML数据接口
 * 定义从YAML解析的书签数据结构
 * 
 * @interface BookmarkYamlData
 */
export interface BookmarkYamlData {
	/** 创建时间 */
	created?: string;
	/** 网站标题 */
	title?: string;
	/** 网站URL */
	url?: string;
	/** 网站描述 */
	description?: string;
	/** 标签数组 */
	tags?: string[];
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
}
