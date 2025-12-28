import { App, Modal } from 'obsidian';

/**
 * 进度状态枚举
 * 定义进度步骤的不同状态
 * 
 * @enum {string} ProgressStatus
 */
export enum ProgressStatus {
	/** 待处理状态 */
	PENDING = 'pending',
	/** 处理中状态 */
	PROCESSING = 'processing',
	/** 已完成状态 */
	COMPLETED = 'completed',
	/** 失败状态 */
	FAILED = 'failed'
}

/**
 * 进度步骤接口
 * 定义进度步骤的数据结构
 * 
 * @interface ProgressStep
 */
export interface ProgressStep {
	/** 步骤唯一标识符 */
	id: string;
	/** 步骤显示名称 */
	name: string;
	/** 步骤当前状态 */
	status: ProgressStatus;
	/** 进度百分比（0-100） */
	progress?: number;
	/** 步骤描述信息 */
	description?: string;
	/** 预估时间（秒） */
	estimatedTime?: number;
	/** 开始时间（时间戳） */
	startTime?: number;
}

/**
 * 进度显示模态框类
 * 负责显示处理进度和步骤状态
 * 
 * @class ProgressModal
 * @extends {Modal}
 */
export class ProgressModal extends Modal {
	/** 进度步骤列表 */
	private steps: ProgressStep[] = [];
	/** 步骤元素映射 */
	private stepElements: Map<string, HTMLElement> = new Map();
	/** 进度容器元素 */
	private progressContainer: HTMLElement | null = null;
	/** 模态框标题 */
	private modalTitle: string;
	/** 进度更新定时器 */
	private progressUpdateInterval: number | null = null;

	/**
	 * 构造函数
	 * @param {App} app - Obsidian应用实例
	 * @param {string} [title='处理进度'] - 模态框标题
	 */
	constructor(app: App, title: string = '处理进度') {
		super(app);
		this.modalTitle = title;
	}

	/**
	 * 模态框打开时的初始化
	 * 
	 * @returns {void}
	 */
	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('bookmark-progress-modal');

		// 添加标题
		contentEl.createEl('h2', { text: this.modalTitle });

		// 添加自定义样式
		this.addCustomStyles(contentEl);

		// 创建进度容器
		this.progressContainer = contentEl.createDiv('progress-steps-container');
	}

	/**
	 * 添加自定义样式
	 * @private
	 * @param {HTMLElement} contentEl - 内容元素
	 * @returns {void}
	 */
	private addCustomStyles(contentEl: HTMLElement): void {
		contentEl.createEl('style', { text: `
			.bookmark-progress-modal {
				padding: 20px;
			}
			
			.bookmark-progress-modal h2 {
				margin-bottom: 20px;
				text-align: center;
				color: var(--text-normal);
			}
			
			.progress-steps-container {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}
			
			.progress-step {
				display: flex;
				align-items: center;
				padding: 8px 12px;
				border-radius: 4px;
				transition: all 0.3s ease;
			}
			
			/* 状态文字颜色变化 */
			.progress-step.processing .step-name {
				color: #007acc; /* 蓝色 */
			}
			
			.progress-step.completed .step-name {
				color: #28a745; /* 绿色 */
			}
			
			.progress-step.failed .step-name {
				color: #dc3545; /* 红色 */
			}
			
			.progress-step.pending .step-name {
				color: #6c757d; /* 浅灰色 */
			}
			
			.step-icon {
				width: 20px;
				height: 20px;
				margin-right: 10px;
				display: flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
			}
			
			.step-icon svg {
				width: 14px;
				height: 14px;
			}
			
			.step-content {
				flex: 1;
				display: flex;
				flex-direction: column;
				gap: 2px;
			}
			
			.step-name {
				font-weight: normal;
				color: var(--text-normal);
				transition: color 0.3s ease;
				font-size: 14px;
				line-height: 1.4;
			}
			
			.step-description {
				font-size: 12px;
				color: var(--text-muted);
				line-height: 1.3;
			}
			
			.step-progress {
				display: flex;
				align-items: center;
				gap: 8px;
				margin-left: auto;
				flex-shrink: 0;
			}
			
			.progress-percentage {
				font-size: 0.9em;
				color: var(--text-muted);
				min-width: 40px;
				text-align: right;
			}
			
			/* 加载动画 */
			.loading-spinner {
				width: 16px;
				height: 16px;
				border: 2px solid var(--background-modifier-border);
				border-top: 2px solid var(--interactive-accent);
				border-radius: 50%;
				animation: spin 1s linear infinite;
			}
			
			@keyframes spin {
				0% { transform: rotate(0deg); }
				100% { transform: rotate(360deg); }
			}
			
			/* 完成图标 */
			.check-icon {
				color: var(--interactive-success);
			}
			
			/* 失败图标 */
			.error-icon {
				color: var(--interactive-failure);
			}
		`, type: 'text/css' });
	}

	/**
	 * 设置进度步骤
	 * @param {ProgressStep[]} steps - 步骤列表
	 * @returns {void}
	 */
	setSteps(steps: ProgressStep[]): void {
		this.steps = steps;
		this.renderSteps();
	}

	/**
	 * 渲染步骤列表
	 * @private
	 * @returns {void}
	 */
	private renderSteps(): void {
		if (!this.progressContainer) return;

		this.progressContainer.empty();
		this.stepElements.clear();

		this.steps.forEach(step => {
			const stepElement = this.createStepElement(step);
			this.progressContainer!.appendChild(stepElement);
			this.stepElements.set(step.id, stepElement);
		});
	}

	/**
	 * 创建步骤元素
	 * @private
	 * @param {ProgressStep} step - 步骤数据
	 * @returns {HTMLElement} 步骤DOM元素
	 */
	private createStepElement(step: ProgressStep): HTMLElement {
		const stepDiv = document.createElement('div');
		stepDiv.className = `progress-step ${step.status}`;
		stepDiv.id = `step-${step.id}`;

		// 图标
		const iconDiv = stepDiv.createDiv('step-icon');
		this.updateStepIcon(iconDiv, step.status);

		// 内容
		const contentDiv = stepDiv.createDiv('step-content');
		contentDiv.createDiv('step-name').setText(step.name);
		if (step.description) {
			contentDiv.createDiv('step-description').setText(step.description);
		}

		// 进度信息 - 为所有状态显示百分比
		const progressDiv = stepDiv.createDiv('step-progress');
		if (step.status === ProgressStatus.PROCESSING) {
			progressDiv.createDiv('loading-spinner');
		}
		const progressPercentage = this.calculateProgress(step);
		progressDiv.createDiv('progress-percentage').setText(`${progressPercentage}%`);

		return stepDiv;
	}

	/**
	 * 更新步骤图标
	 * @private
	 * @param {HTMLElement} iconDiv - 图标容器
	 * @param {ProgressStatus} status - 状态
	 * @returns {void}
	 */
	private updateStepIcon(iconDiv: HTMLElement, status: ProgressStatus): void {
		iconDiv.empty();

		switch (status) {
			case ProgressStatus.PENDING:
				iconDiv.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>';
				break;
			case ProgressStatus.PROCESSING:
				iconDiv.innerHTML = '<div class="loading-spinner"></div>';
				break;
			case ProgressStatus.COMPLETED:
				iconDiv.innerHTML = '<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"></path></svg>';
				break;
			case ProgressStatus.FAILED:
				iconDiv.innerHTML = '<svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
				break;
		}
	}

	/**
	 * 更新步骤状态
	 * @param {string} stepId - 步骤ID
	 * @param {ProgressStatus} status - 新状态
	 * @param {number} [progress] - 进度百分比（可选）
	 * @param {string} [description] - 描述（可选）
	 * @returns {void}
	 */
	updateStep(stepId: string, status: ProgressStatus, progress?: number, description?: string): void {
		const step = this.steps.find(s => s.id === stepId);
		if (!step) return;

		step.status = status;
		if (progress !== undefined) step.progress = progress;
		if (description !== undefined) step.description = description;

		// 记录开始时间
		if (status === ProgressStatus.PROCESSING && !step.startTime) {
			step.startTime = Date.now();
			// 开始实时更新进度
			this.startProgressUpdate();
		} else if (status !== ProgressStatus.PROCESSING && step.startTime) {
			// 停止实时更新进度
			this.stopProgressUpdate();
		}

		const stepElement = this.stepElements.get(stepId);
		if (!stepElement) return;

		// 更新状态类
		stepElement.className = `progress-step ${status}`;

		// 更新图标
		const iconDiv = stepElement.querySelector('.step-icon') as HTMLElement;
		if (iconDiv) {
			this.updateStepIcon(iconDiv, status);
		}

		// 更新进度信息
		this.updateStepProgress(stepElement, step);

		// 更新描述
		if (description !== undefined) {
			const descriptionDiv = stepElement.querySelector('.step-description') as HTMLElement;
			if (descriptionDiv) {
				descriptionDiv.textContent = description;
			} else {
				const contentDiv = stepElement.querySelector('.step-content') as HTMLElement;
				if (contentDiv) {
					contentDiv.createDiv('step-description').setText(description);
				}
			}
		}
	}

	/**
	 * 更新步骤进度显示
	 * @private
	 * @param {HTMLElement} stepElement - 步骤元素
	 * @param {ProgressStep} step - 步骤数据
	 * @returns {void}
	 */
	private updateStepProgress(stepElement: HTMLElement, step: ProgressStep): void {
		let progressDiv = stepElement.querySelector('.step-progress') as HTMLElement;
		
		// 如果进度div不存在，创建它
		if (!progressDiv) {
			progressDiv = stepElement.createDiv('step-progress');
		}

		progressDiv.empty();

		// 根据状态显示不同的进度信息
		if (step.status === ProgressStatus.PROCESSING) {
			// 处理中状态：显示加载动画和百分比
			progressDiv.createDiv('loading-spinner');
			const progress = this.calculateProgress(step);
			progressDiv.createDiv('progress-percentage').setText(`${progress}%`);
		} else if (step.status === ProgressStatus.COMPLETED) {
			// 完成状态：显示100%
			progressDiv.createDiv('progress-percentage').setText('100%');
		} else if (step.status === ProgressStatus.FAILED) {
			// 失败状态：显示0%或之前的进度
			const progress = step.progress || 0;
			progressDiv.createDiv('progress-percentage').setText(`${progress}%`);
		} else {
			// 待处理状态：显示0%
			progressDiv.createDiv('progress-percentage').setText('0%');
		}
	}

	/**
	 * 计算进度百分比
	 * @private
	 * @param {ProgressStep} step - 步骤数据
	 * @returns {number} 进度百分比
	 */
	private calculateProgress(step: ProgressStep): number {
		// 如果提供了明确的进度值，直接使用
		if (step.progress !== undefined) {
			return step.progress;
		}

		// 如果有预估时间和开始时间，基于时间计算进度
		if (step.estimatedTime && step.startTime) {
			const elapsed = (Date.now() - step.startTime) / 1000; // 已过去的时间（秒）
			const progress = Math.min(Math.round((elapsed / step.estimatedTime) * 100), 99); // 最多99%，留1%给完成
			return progress;
		}

		// 默认返回0%
		return 0;
	}

	/**
	 * 更新步骤进度
	 * @param {string} stepId - 步骤ID
	 * @param {number} progress - 进度百分比
	 * @param {string} [description] - 描述（可选）
	 * @returns {void}
	 */
	updateProgress(stepId: string, progress: number, description?: string): void {
		this.updateStep(stepId, ProgressStatus.PROCESSING, progress, description);
	}

	/**
	 * 设置步骤的预估时间
	 * @param {string} stepId - 步骤ID
	 * @param {number} estimatedTime - 预估时间（秒）
	 * @returns {void}
	 */
	setStepEstimatedTime(stepId: string, estimatedTime: number): void {
		const step = this.steps.find(s => s.id === stepId);
		if (step) {
			step.estimatedTime = estimatedTime;
		}
	}

	/**
	 * 完成步骤
	 * @param {string} stepId - 步骤ID
	 * @param {string} [description] - 描述（可选）
	 * @returns {void}
	 */
	completeStep(stepId: string, description?: string): void {
		this.updateStep(stepId, ProgressStatus.COMPLETED, 100, description);
	}

	/**
	 * 失败步骤
	 * @param {string} stepId - 步骤ID
	 * @param {string} error - 错误信息
	 * @returns {void}
	 */
	failStep(stepId: string, error: string): void {
		this.updateStep(stepId, ProgressStatus.FAILED, undefined, error);
	}

	/**
	 * 开始实时更新进度
	 * @private
	 * @returns {void}
	 */
	private startProgressUpdate(): void {
		// 如果已经有定时器在运行，先停止它
		this.stopProgressUpdate();
		
		// 创建新的定时器，每500ms更新一次
		this.progressUpdateInterval = window.setInterval(() => {
			this.updateProcessingStepsProgress();
		}, 500);
	}

	/**
	 * 停止实时更新进度
	 * @private
	 * @returns {void}
	 */
	private stopProgressUpdate(): void {
		if (this.progressUpdateInterval) {
			window.clearInterval(this.progressUpdateInterval);
			this.progressUpdateInterval = null;
		}
	}

	/**
	 * 更新所有处理中步骤的进度
	 * @private
	 * @returns {void}
	 */
	private updateProcessingStepsProgress(): void {
		this.steps.forEach(step => {
			if (step.status === ProgressStatus.PROCESSING) {
				const stepElement = this.stepElements.get(step.id);
				if (stepElement) {
					this.updateStepProgress(stepElement, step);
				}
			}
		});
	}

	/**
	 * 模态框关闭时的清理
	 * 
	 * @returns {void}
	 */
	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.stepElements.clear();
		this.stopProgressUpdate(); // 确保停止定时器
	}
}
