import { App, Modal, Notice, Setting, parseYaml, setIcon } from 'obsidian';
import { modalType, stepStatus } from './types';
import { statusIcons, Step, steps } from './steps';
import { waitlist } from './waitlist';
import { BookmarkWorkflow } from './workflow';

// 定义新的类型
interface StepElements {
    stepEl: HTMLElement;
    stepTitle: HTMLElement;
    stepProgress: HTMLElement;
	estimatedTime?: number;
}

export class BookmarkModal extends Modal {
    /** 插件实例（使用any避免循环依赖） */
	private plugin: any;
    private modalType: modalType = "input";
    /** 输入区域文本域 */
    private mainTextarea: HTMLTextAreaElement;
	/** 当前步骤列表 */
	private currentSteps: Step[] = [];
    /** 步骤元素映射，用于快速访问和更新步骤DOM */
    private stepEls: Map<string, StepElements> = new Map();
	/** 当前运行的进度定时器ID */
    private currentProgressTimer: number | null = null;
    /** 当前正在更新进度的步骤名称 */
    private currentProcessingStep: string | null = null;
	/** waitlist状态更新监听器 */
	private waitlistUpdateListener: ((data: any) => void) | null = null;
    /** 工作流管理器实例 */
    private workflow: BookmarkWorkflow;
	/** 取消按钮元素 */
	private cancelButton: HTMLButtonElement | null = null;
	/** 打开所有笔记按钮元素 */
	private openAllButton: HTMLButtonElement | null = null;
	/** 关闭按钮元素 */
	private closeButton: HTMLButtonElement | null = null;
	/** 是否正在取消 */
	private isCancelling: boolean = false;
	/** 成功创建的笔记列表 */
	private createdNotes: string[] = [];

    /**
     * 构造函数
     * @param {App} app - Obsidian应用实例
     * @param {any} plugin - 书签创建器插件实例
     */
    constructor(app: App, plugin: any) {
        super(app);
        this.plugin = plugin;
        this.workflow = new BookmarkWorkflow(this.app, this.plugin.settings, this);
    }

    /**
	 * 模态框打开时的初始化
	 * 
	 * @returns {void}
	 */
	onOpen(): void {
		
	}
    /**
     * 切换到输入模式
     * @returns {BookmarkModal} 当前实例，用于链式调用
     */
    inputMode(): BookmarkModal {
        this.modalType = "input";
        this.contentEl.empty();
        this.setTitle('创建书签笔记');
        this.createStyle();
        this.createInputArea();
        this.createButtonArea();

		return this;
    }
    /**
     * 切换到进度模式
     * @param full 是否显示完整进度模式
     * @returns {BookmarkModal} 当前实例，用于链式调用
     */
    progressMode(full: boolean, title: string = '处理中...'): BookmarkModal {
        this.modalType = full ?  "progress" : "simple-progress";
        this.contentEl.empty();
        
        // 选择对应的步骤列表
        // 拷贝步骤列表，避免外部修改影响内部状态
        this.currentSteps = full ? [...steps.full] : [...steps.simple];
        
        // 设置模态窗口标题
        this.setTitle(title);
        
        // 创建样式
        this.createStyle();
        
        // 创建步骤容器
        const stepsContainer = this.contentEl.createDiv('bookmark-steps-container');
        
        // 清空之前的步骤元素映射
        this.stepEls.clear();
        
        // 初始化并渲染每个步骤
        this.currentSteps.forEach(step => {
            // 创建步骤元素
            const stepEl = stepsContainer.createDiv('bookmark-step');
            stepEl.addClass('step-pending');

            // 设置步骤名称
            const stepTitle = stepEl.createDiv('step-title');
            stepTitle.textContent = step.title;
            
            // 设置进度百分比元素。
            const stepProgress = stepEl.createDiv('step-progress');
            
            // 存储步骤元素到映射中
            this.stepEls.set(step.name, {
				stepEl,
				stepTitle,
				stepProgress,
				estimatedTime: step.estimatedTime || 10,
			});
        });

		// 创建按钮容器
		const buttonContainer = this.contentEl.createDiv('modal-button-container');

		// 创建取消按钮
		this.cancelButton = buttonContainer.createEl('button', {
			text: '取消',
			cls: 'mod-muted'
		});
		this.cancelButton.addEventListener('click', () => this.handleCancel());

		// 创建打开所有笔记按钮（初始隐藏）
		this.openAllButton = buttonContainer.createEl('button', {
			text: '打开所有笔记',
			cls: 'mod-cta',
			attr: {
				style: 'display: none; margin-right: auto;'
			}
		});
		this.openAllButton.addEventListener('click', () => this.openAllNotes());

		// 创建关闭按钮（初始隐藏）
		this.closeButton = buttonContainer.createEl('button', {
			text: '关闭',
			cls: 'mod-muted',
			attr: {
				style: 'display: none;'
			}
		});
		this.closeButton.addEventListener('click', () => this.close());

		// 订阅waitlist状态更新事件
		this.waitlistUpdateListener = (data: any) => {
			// 当waitlist中的状态更新时，更新对应的步骤状态
			if (data.step && data.newStatus) {
				this.updateStepStatus(data.step, data.newStatus);
			}
		};
		waitlist.subscribe('update', this.waitlistUpdateListener);
		return this;
    }

    /**
     * 更新步骤状态
     * @param stepName 步骤名称
     * @param status 新的状态
     */
    updateStepStatus(stepName: string, status: stepStatus): void {
        // 获取步骤元素
        const step = this.stepEls.get(stepName);
        if (!step) return;
		const {stepEl, stepTitle, stepProgress, estimatedTime} = step;
        
        // 移除所有状态类
        stepEl.removeClass('step-pending');
        stepEl.removeClass('step-processing');
        stepEl.removeClass('step-completed');
        stepEl.removeClass('step-failed');
        
        // 添加新的状态类
        stepEl.addClass(`step-${status}`);

        // 仅在“processing”状态显示进度百分比，其他状态清空
        if (status === 'processing') {
            // 记录起始时间戳，供后续调用复用
            if (!stepEl.dataset.startTs) stepEl.dataset.startTs = String(Date.now());
			// 启动进度定时器
			this.startProgressTimer(stepName, stepEl, stepProgress, estimatedTime * 1000);
        } else {
            stepProgress.textContent = '';
            // 非 processing 状态清除时间戳
            delete stepEl.dataset.startTs;
			// 停止当前定时器（如果正在运行）
			if (this.currentProcessingStep === stepName) {
				this.stopCurrentProgressTimer();
			}
        }
    }
	/**
	 * 启动进度定时器
	 * @param stepName 步骤名称
	 * @param stepEl 步骤元素
	 * @param stepProgress 进度百分比元素
	 * @param estimatedMsPerStep 预计每个步骤耗时（毫秒）
	 */
	private startProgressTimer(stepName: string, stepEl: HTMLElement, stepProgress: HTMLElement, estimatedMsPerStep: number): void {
		// 停止任何已存在的定时器
		this.stopCurrentProgressTimer();
		
		// 记录当前处理的步骤
		this.currentProcessingStep = stepName;
		
		// 创建新的定时器
		this.currentProgressTimer = window.setInterval(() => {
			try {
				const startTime = stepEl.dataset.startTs ? Number(stepEl.dataset.startTs) : Date.now();
				const elapsed = Date.now() - startTime;
				const percent = Math.min(99, Math.round((elapsed / estimatedMsPerStep) * 100));
				
				stepProgress.textContent = `${percent}%`;
				
				if (percent >= 99) {
					this.stopCurrentProgressTimer();
				}
			} catch (error) {
				console.error(`步骤 ${stepName} 进度更新失败:`, error);
				this.stopCurrentProgressTimer();
			}
		}, 200);
	}

	/**
	 * 停止当前进度定时器
	 */
	private stopCurrentProgressTimer(): void {
		if (this.currentProgressTimer !== null) {
			window.clearInterval(this.currentProgressTimer);
			this.currentProgressTimer = null;
			this.currentProcessingStep = null;
		}
	}

    private createStyle(): void {
        const styleEl = this.contentEl.createEl('style');
        if (this.modalType === "input") {
            styleEl.textContent = `
            .bookmark-input-setting {
                flex-direction: column;
                align-items: normal;
            }`
        }
        if (this.modalType === "progress" || this.modalType === "simple-progress") {
            styleEl.textContent = `
                /* 步骤容器样式 */
                .bookmark-steps-container {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    width: 100%;
                    padding: 10px 0;
                }
                
                /* 单个步骤样式 */
                .bookmark-step {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 4px;
                    padding: 12px;
                    border-radius: 6px;
                    border: 1px solid var(--background-modifier-border);
                    transition: all 0.3s ease;
                }
                
                /* 步骤标题样式 */
                .step-title {
                    font-weight: 600;
                    font-size: 14px;
                    color: var(--text-normal);
                    flex: 1;
                }
                
                /* 步骤描述样式 */
                .step-desc {
                    font-size: 12px;
                    color: var(--text-muted);
                }
                
                /* 步骤进度样式 */
                .step-progress {
                    color: var(--text-faint);
                    margin-top: 2px;
                    text-align: right;
                    min-width: 40px;
                }
                
                /* 待处理状态样式 */
                .step-pending {
                    background-color: var(--background-secondary);
                    border-color: var(--background-modifier-border);
                }
                
                /* 处理中状态样式 */
                .step-processing {
                    background-color: rgba(37, 99, 235, 0.1);
                    border-color: rgba(37, 99, 235, 0.3);
                }
                .step-processing::before {
                    content: '';
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    margin-right: 8px;
                    border: 2px solid var(--interactive-accent);
                    border-top: 2px solid transparent;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                /* 已完成状态样式 */
                .step-completed {
                    background-color: rgba(16, 185, 129, 0.1);
                    border-color: rgba(16, 185, 129, 0.3);
                }
                .step-completed::before {
                    content: '✓';
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    margin-right: 8px;
                    color: rgb(16, 185, 129);
                    font-weight: bold;
                }
                
                /* 失败状态样式 */
                .step-failed {
                    background-color: rgba(239, 68, 68, 0.1);
                    border-color: rgba(239, 68, 68, 0.3);
                }
                .step-failed::before {
                    content: '✗';
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    margin-right: 8px;
                    color: rgb(239, 68, 68);
                    font-weight: bold;
                }
                
                /* 旋转动画 */
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                /* 步骤标题和描述在状态样式中的调整 */
                .step-processing .step-title,
                .step-completed .step-title,
                .step-failed .step-title {
                    display: flex;
                    align-items: center;
                }
            `;
        }
    }

    /**
	 * 创建YAML输入区域
	 * @private
	 * @returns {void}
	 */
	private createInputArea(): void {
		new Setting(this.contentEl)
			.setClass('bookmark-input-setting')
			.setName('书签信息')
			.setDesc('支持 YAML 格式或直接输入网址。YAML 格式将直接处理，网址将使用 AI 自动生成书签信息')
			.addTextArea(text => {
				this.mainTextarea = text.inputEl;
				text.setPlaceholder(`方式1 - YAML格式：
---
created: 
title: 网站标题
url: https://example.com/
description: 网站描述
tags: 
    - 标签1
    - 标签2
---

方式2 - 直接输入网址：
https://example.com/`);
				this.mainTextarea.rows = 15;
				this.mainTextarea.style.fontFamily = 'monospace';
				this.mainTextarea.style.fontSize = '14px';
				this.mainTextarea.style.width = '100%';
			});
	}

	/**
	 * 创建按钮区域
	 * @private
	 * @returns {void}
	 */
	private createButtonArea(): void {
		const buttonContainer = this.contentEl.createDiv('modal-button-container');
		buttonContainer.style.display = 'flex';
		buttonContainer.style.gap = '10px';
		buttonContainer.style.marginTop = '20px';

		// 创建按钮
		const createButton = buttonContainer.createEl('button', {
			text: '创建书签',
			cls: 'mod-cta'
		});
		// 工作流启动
		createButton.addEventListener('click', () => this.startWorkflow());

		// 取消按钮
		const cancelButton = buttonContainer.createEl('button', {
			text: '取消',
			cls: 'mod-muted'
		});
		cancelButton.addEventListener('click', () => this.close());
	}

    /**
     * 启动书签创建工作流
     * @returns {void}
     */
    private startWorkflow(): void {
        // 获取并清理用户输入内容
        const input = this.mainTextarea.value.trim();
        
        // 验证输入是否为空
        if (!input) {
            new Notice('请输入网址或书签信息');
            return;
        }
        
        // 判断输入是否为YAML格式（检测代码块分隔符）
        if(/^(-{3,}|`{3,}\w*)$/m.test(input)) {
            // 启动YAML格式的工作流
            this.workflow.startYAMLWorkflow(input.trim());
        } else {
            // 处理非YAML格式的输入，逐行验证是否为网址
            const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
            for (const line of lines) {
                try {
                    new URL(line);
                } catch {
                    new Notice(`无效网址：${line}`);
                    return;
                }
            }
            // 验证通过后，将URL添加到等待队列
            lines.forEach(line => {
                waitlist.add(line);
            })
            // 启动URL工作流
            this.workflow.startURLWorkflow();
        }
    }

    /**
	 * 模态框关闭时的清理
	 * 
	 * @returns {void}
	 */
	onClose(): void {
		// 取消waitlist状态更新事件订阅
		if (this.waitlistUpdateListener) {
			waitlist.unsubscribe('update', this.waitlistUpdateListener);
			this.waitlistUpdateListener = null;
		}
		// 停止进度定时器
		this.stopCurrentProgressTimer();
		// 清空内容区域
		this.contentEl.empty();
		// 清空步骤元素映射
		this.stepEls.clear();
		// 清空笔记列表
		this.createdNotes = [];
	}

	/**
	 * 设置成功创建的笔记列表
	 * @param {string[]} notes - 笔记标题列表
	 * @returns {void}
	 */
	setCreatedNotes(notes: string[]): void {
		this.createdNotes = notes;
		this.updateButtonStates();
	}

	/**
	 * 更新按钮状态
	 * @returns {void}
	 */
	private updateButtonStates(): void {
		// 工作流完成时禁用取消按钮
		if (this.cancelButton) {
			this.cancelButton.disabled = true;
			this.cancelButton.textContent = '已完成';
		}
		
		// 显示打开所有笔记按钮（如果有笔记）
		if (this.openAllButton) {
			this.openAllButton.style.display = this.createdNotes.length > 0 ? 'inline-block' : 'none';
		}
		
		// 显示关闭按钮
		if (this.closeButton) {
			this.closeButton.style.display = 'inline-block';
		}
	}

	/**
	 * 打开所有笔记
	 * @returns {Promise<void>}
	 */
	private async openAllNotes(): Promise<void> {
		for (const notePath of this.createdNotes) {
			try {
				const file = this.app.vault.getFileByPath(notePath);
				if (file) {
					await this.app.workspace.getLeaf().openFile(file);
				}
			} catch (error) {
				console.error(`打开笔记失败: ${notePath}`, error);
			}
		}
		// 打开所有笔记后关闭模态框
		this.close();
	}

	/**
	 * 处理取消按钮点击事件
	 * @returns {void}
	 */
	private handleCancel(): void {
		// 防止重复点击
		if (this.isCancelling) {
			return;
		}

		this.isCancelling = true;
		
		// 更新取消按钮状态
		if (this.cancelButton) {
			this.cancelButton.textContent = '正在取消...';
			this.cancelButton.disabled = true;
		}

		// 请求取消工作流
		this.workflow.requestCancellation();

		// 显示取消提示
		new Notice('正在取消工作流，请稍候...');

		// 延迟关闭模态框，让用户看到取消过程
		setTimeout(() => {
			this.close();
		}, 1000);
	}
}