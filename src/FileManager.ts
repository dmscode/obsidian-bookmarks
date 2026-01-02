import { App, Notice, TFile, TFolder, requestUrl, stringifyYaml } from 'obsidian';
import { BookmarkCreatorSettings, NoteContentData } from './types';

export class FileManager {
    /** Obsidian应用实例 */
    private app: App;
    /** 插件设置 */
    private settings: BookmarkCreatorSettings;
    constructor(app: App, settings: BookmarkCreatorSettings) {
        this.app = app;
        this.settings = settings;
    }

    /**
     * 确保文件夹存在
     * @param folderPath - 文件夹路径
     * @returns 是否创建了新文件夹
     */
    async ensureFolderExists(folderPath: string): Promise<boolean> {
        const isExist = await this.app.vault.adapter.exists(folderPath);
        try {
            if(!isExist){
                await this.app.vault.createFolder(folderPath);
                return true;
            } else {
                return false;
            }
        } catch (error) {
            new Notice(`创建文件夹 ${folderPath} 失败`);
            return false;
        }
    }
    /**
	 * 清理文件名，移除非法字符
	 * 
	 * @param {string} fileName - 原始文件名
	 * @returns {string} 清理后的文件名
	 */
	sanitizeFileName(fileName: string): string {
		return fileName.replace(/[<>:\"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
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
	 * 创建笔记文件
	 * 
	 * @param {string} title - 笔记标题
	 * @param {string} content - 笔记内容
	 * @returns {Promise<TFile>} 创建的文件对象
	 * @throws {Error} 当文件创建失败时抛出错误
	 */
	async createNoteFile(title: string, content: string): Promise<TFile> {
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
	 * 下载截图
	 * 
	 * @param {string} url - 网站URL
	 * @param {string} noteTitle - 笔记标题
	 * @returns {Promise<string>} 截图文件名
	 * @throws {Error} 当下载失败时抛出错误
	 */
	async downloadScreenshot(url: string, noteTitle: string): Promise<string> {
		const screenshotUrl = `https://image.thum.io/get/wait/12/viewportWidth/1600/width/1440/crop/900/png/noanimate/${url}`;
		console.log('Downloading screenshot from:', screenshotUrl);
		try {
			// 确保附件文件夹存在
			await this.ensureFolderExists(this.settings.attachmentFolder);
			const screenshotFileName = `${this.sanitizeFileName(noteTitle)}.png`;
			const filePath = `${this.settings.attachmentFolder}/${screenshotFileName}`;
			const response = await requestUrl({
				url: screenshotUrl,
				method: 'GET',
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
				}
			});

			if (response.status === 200) {
				console.log('Screenshot downloaded successfully');
				await this.app.vault.createBinary(filePath, response.arrayBuffer);
				return screenshotFileName;
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
     * 构建笔记内容
     * 
     * @param {NoteContentData} data - 笔记数据
     * @returns {string} 生成的笔记内容
     */
    buildNoteContent(data: NoteContentData): string {
        const frontmatter = {
            created: data.created,
            title: data.title,
            url: data.url,
            description: data.description,
            tags: data.tags,
        }
        try {
            return `---
${stringifyYaml(frontmatter)}
---

## 网站截图

screenshot:: ![网站截图](${this.settings.attachmentFolder}/${encodeURIComponent(data.screenshotFileName)})

## 网站笔记

${data.bookmarkNote || ''}
`;
        } catch (error) {
            console.error('构建笔记内容失败:', error);
            throw new Error('构建笔记内容时出错');
        }
    }
}