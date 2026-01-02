/**
 * 书签创建工作流管理器
 * 负责协调整个书签创建流程，包括AI内容生成、截图下载和笔记创建
 * 
 * @class BookmarkWorkflow
 */
import { App, Notice, parseYaml } from 'obsidian';
import { BookmarkCreatorSettings, NoteContentData, WorkflowCancellationError } from './types';
import { AiService } from './ApiCaller';
import { BookmarkModal } from './modal';
import { waitlist } from './waitlist';
import { FileManager } from './FileManager';

export class BookmarkWorkflow {
    /** 全局静态锁，跨实例共享 */
    private static isWorkflowRunning: boolean = false;
    /** 当前运行的工作流实例ID */
    private static runningInstanceId: string | null = null;
    /** 全局取消请求标志 */
    private static isCancellationRequested: boolean = false;
    /** 当前请求取消的实例ID */
    private static cancellingInstanceId: string | null = null;
    /** 当前实例ID */
    private instanceId: string;
    /** Obsidian应用实例 */
    private app: App;
    /** 插件设置 */
    private settings: BookmarkCreatorSettings;
    /** AI服务实例 */
    private aiService: AiService;
    /** 模态框实例 */
    private modal: BookmarkModal;
    /** 文件管理器实例 */
    private fileManager: FileManager;
    /** 成功创建的笔记列表 */
    private createdNotes: string[] = [];

    /**
     * 构造函数
     * @param {App} app - Obsidian应用实例
     * @param {BookmarkCreatorSettings} settings - 插件设置
     * @param {BookmarkModal} modal - 模态框实例（可选）
     */
    constructor(app: App, settings: BookmarkCreatorSettings, modal?: BookmarkModal) {
        this.app = app;
        this.settings = settings;
        this.modal = modal || new BookmarkModal(app, settings);
        this.aiService = new AiService(settings);
        this.fileManager = new FileManager(app, settings);
        this.instanceId = Math.random().toString(36).substr(2, 9);
        // 初始化时清空笔记列表
        this.createdNotes = [];
    }

    /**
     * 请求取消当前运行的工作流
     * @returns {void}
     */
    requestCancellation(): void {
        if (BookmarkWorkflow.isWorkflowRunning && BookmarkWorkflow.runningInstanceId) {
            BookmarkWorkflow.isCancellationRequested = true;
            BookmarkWorkflow.cancellingInstanceId = BookmarkWorkflow.runningInstanceId;
            console.log(`工作流取消请求已发送 (实例ID: ${BookmarkWorkflow.runningInstanceId})`);
        }
    }

    /**
     * 检查是否应该取消当前工作流
     * @returns {boolean} 是否应该取消
     * @private
     */
    private shouldCancel(): boolean {
        return BookmarkWorkflow.isCancellationRequested && 
               BookmarkWorkflow.cancellingInstanceId === this.instanceId;
    }

    /**
     * 重置取消状态
     * @private
     */
    private resetCancellationState(): void {
        BookmarkWorkflow.isCancellationRequested = false;
        BookmarkWorkflow.cancellingInstanceId = null;
    }
    /**
     * 启动URL工作流
     * @returns {Promise<boolean>} 是否成功创建所有书签
     */
    async startURLWorkflow(): Promise<boolean> {
        // 检查全局锁
        if (BookmarkWorkflow.isWorkflowRunning) {
            new Notice(`工作流正在运行中 (${BookmarkWorkflow.runningInstanceId})，请稍候...`);
            return false;
        }
        
        // 获取锁
        BookmarkWorkflow.isWorkflowRunning = true;
        BookmarkWorkflow.runningInstanceId = this.instanceId;
        
        let currentIndex = 0;
        let hasError = false;
        
        try {
            // 显示模态框并切换到批量处理模式
            this.modal.open();
            this.modal.progressMode(true);
            
            // 处理等待队列中的所有项目，直到完全处理结束
            while (currentIndex < waitlist.length) {
                // 检查是否请求取消
                if (this.shouldCancel()) {
                    throw new WorkflowCancellationError();
                }
                
                const item = waitlist.read(currentIndex);
                if (!item) {
                    currentIndex++;
                    continue;
                }
                
                try {
                    // 处理当前URL
                    await this.URLWorkflow(item.url, currentIndex);
                } catch (error) {
                    console.error(`处理URL失败: ${item.url}`, error);
                    hasError = true;
                    // 即使单个URL处理失败，也继续处理下一个
                }
                
                currentIndex++;
            }
            
            // 所有项目处理完成后，清空等待队列
            waitlist.clear();
            
            // 通知模态框工作流已完成，更新按钮状态
            this.modal.setCreatedNotes(this.createdNotes);

            this.modal.setTitle('处理完成！');
            
            // 显示完成状态
            if (!hasError) {
                new Notice('所有书签创建完成！');
            } else {
                new Notice('批量处理完成，部分书签创建失败');
            }
            
            return !hasError;
        } catch (error) {
            console.error('批量处理URL时发生错误:', error);
            
            if (error instanceof WorkflowCancellationError) {
                new Notice('工作流已取消');
            } else {
                new Notice('批量处理失败: ' + (error instanceof Error ? error.message : '未知错误'));
            }
            
            return false;
        } finally {
            // 释放锁
            BookmarkWorkflow.isWorkflowRunning = false;
            BookmarkWorkflow.runningInstanceId = null;
            // 重置取消状态
            this.resetCancellationState();
        }
    }
    /**
     * 执行工作流步骤，统一处理状态更新
     * @param {string} stepId - 步骤ID
     * @param {Function} stepFunction - 步骤执行函数
     * @returns {Promise<any>} 步骤执行结果
     * @private
     */
    private async executeStep(stepId: string, stepFunction: () => Promise<any>): Promise<any> {
        // 检查是否请求取消
        if (this.shouldCancel()) {
            throw new WorkflowCancellationError();
        }
        
        try {
            waitlist.update(stepId, 'processing');
            const result = await stepFunction();
            waitlist.update(stepId, 'completed');
            return result;
        } catch (error) {
            waitlist.update(stepId, 'failed');
            throw error;
        }
    }

    /**
     * 执行完整的书签创建工作流
     * @param {string} url - 目标网址
     * @param {number} currentIndex - 当前处理索引
     * @returns {Promise<boolean>} 是否成功创建书签
     */
    private async URLWorkflow(url: string, currentIndex: number): Promise<boolean> {
        try {
            // 切换到进度模式并显示完整步骤
            this.modal.progressMode(true, `正在处理中...${ waitlist.length>1 ? ` (${currentIndex+1}/${waitlist.length})` : '' } ${new URL(url).hostname}`);
            
            // 步骤1: 获取网页内容
            const webContent = await this.executeStep('get-web-content', async () => {
                return await this.aiService.callApi(url, 'jinaReader');
            });
            
            // 步骤2: 获取网站评价
            const searchInfo = await this.executeStep('get-web-rating', async () => {
                return await this.aiService.callApi(url, 'jinaSearch');
            });
            
            // 步骤3: 生成书签信息
            const bookmarkYaml = await this.executeStep('generate-bookmark-info', async () => {
                return await this.aiService.callApi(url, 'openai', {
                    webContent, 
                    searchInfo
                });
            });
            
            // 解析生成的YAML内容
            const noteData = this.parseGeneratedYaml(bookmarkYaml);
            noteData.url = url; // 确保URL正确
            
            // 步骤4: 下载网站截图
            noteData.screenshotFileName = await this.executeStep('download-web-screenshot', async () => {
                return await this.fileManager.downloadScreenshot(url, noteData.title);
            });
            
            // 步骤5: 创建书签笔记
            await this.executeStep('create-bookmark-note', async () => {
                await this.createBookmarkNote(noteData);
            });
            
            new Notice('书签创建成功！');
            return true;
            
        } catch (error) {
            console.error('书签创建工作流失败:', error);
            
            if (error instanceof Error) {
                new Notice(`书签创建失败: ${error.message}`);
            } else {
                new Notice('书签创建失败: 未知错误');
            }
            
            return false;
        }
    }

    /**
     * 执行简化的书签创建工作流（仅下载截图和创建笔记）
     * @param {NoteContentData} noteData - 笔记数据
     * @returns {Promise<boolean>} 是否成功创建书签
     */
    async startYAMLWorkflow(yamlContent: string): Promise<boolean> {
        // 检查全局锁
        if (BookmarkWorkflow.isWorkflowRunning) {
            new Notice(`工作流正在运行中 (${BookmarkWorkflow.runningInstanceId})，请稍候...`);
            return false;
        }
        
        // 获取锁
        BookmarkWorkflow.isWorkflowRunning = true;
        BookmarkWorkflow.runningInstanceId = this.instanceId;
        
        try {
            // 解析YAML内容
            let noteData: NoteContentData;
            try {
                noteData = this.parseGeneratedYaml(yamlContent);
            } catch (error) {
                console.error('解析YAML内容失败:', error);
                new Notice('解析书签信息失败: 未知错误');
                return false;
            }
            
            // 切换到进度模式并显示简化步骤
            this.modal.progressMode(false);
            
            // 步骤1: 下载网站截图
            noteData.screenshotFileName = await this.executeStep('download-web-screenshot', async () => {
                return await this.fileManager.downloadScreenshot(noteData.url, noteData.title);
            });
            
            // 步骤2: 创建书签笔记
            await this.executeStep('create-bookmark-note', async () => {
                await this.createBookmarkNote(noteData);
            });
            
            new Notice('书签创建成功！');
            return true;
            
        } catch (error) {
            console.error('简化书签创建工作流失败:', error);
            
            if (error instanceof WorkflowCancellationError) {
                new Notice('工作流已取消');
            } else if (error instanceof Error) {
                new Notice(`书签创建失败: ${error.message}`);
            } else {
                new Notice('书签创建失败: 未知错误');
            }
            
            return false;
        } finally {
            // 释放锁
            BookmarkWorkflow.isWorkflowRunning = false;
            BookmarkWorkflow.runningInstanceId = null;
            // 重置取消状态
            this.resetCancellationState();
        }
    }

    /**
     * 解析AI生成的YAML内容
     * @param {string} yamlContent - YAML内容
     * @returns {NoteContentData} 解析后的笔记数据
     * @private
     */
    private parseGeneratedYaml(yamlContent: string): NoteContentData {
        try {
            // 提取YAML内容（移除可能的markdown代码块标记）
            let cleanYaml = yamlContent;
            // 第一次：提取三横线之间的内容（最优先，因为YAML标准格式）
            const yamlDelimiter = yamlContent.match(/-{3,}\s*\n([\s\S]*?)\n-{3,}/);
            if (yamlDelimiter) {
                cleanYaml = yamlDelimiter[1].trim();
            } else {
                // 第二次：提取带语言标识的代码块
                const yamlCodeBlock = yamlContent.match(/`{3,}ya?ml\s*\n([\s\S]*?)`{3,}/i);
                if (yamlCodeBlock) {
                    cleanYaml = yamlCodeBlock[1].trim();
                } else {
                    // 第三次：提取普通代码块
                    const codeBlock = yamlContent.match(/`{3,}\s*\n([\s\S]*?)`{3,}/);
                    if (codeBlock) {
                        cleanYaml = codeBlock[1].trim();
                    }
                }
            }
            
            // 使用Obsidian内置的parseYaml解析
            const parsedYaml = parseYaml(cleanYaml);

            if (!parsedYaml.title || !parsedYaml.url) {
                throw new Error('书签信息中缺少标题或URL');
            }
            
            return {
                created: new Date().toISOString(),
                title: parsedYaml.title,
                url: parsedYaml.url,
                description: parsedYaml.description || '',
                tags: parsedYaml.tags || [],
                screenshotFileName: `${parsedYaml.title}.png`,
                bookmarkNote: parsedYaml.bookmarkNote || ''
            };
        } catch (error) {
            console.error('解析YAML内容失败:', error);
            throw new Error('解析生成的书签信息失败');
        }
    }


    /**
     * 创建书签笔记
     * @param {NoteContentData} noteData - 笔记数据
     * @returns {Promise<void>}
     * @private
     */
    private async createBookmarkNote(noteData: NoteContentData): Promise<void> {
        try {
            const content = this.fileManager.buildNoteContent(noteData);
            const file = await this.fileManager.createNoteFile(noteData.title, content);
            // 记录成功创建的笔记完整路径
            this.createdNotes.push(file.path);
        } catch (error) {
            console.error('创建笔记失败:', error);
            throw new Error(`创建书签笔记失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

}