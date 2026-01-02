/**
 * 等待队列状态管理模块
 * 用于管理待处理的网址队列，支持两种处理类型：full（完整处理）和 simple（简单处理）
 */

import { steps } from "./steps";
import { stepStatus } from "./types";

/** 处理类型枚举 */
export type ProcessType = 'full' | 'simple';

/** 处理步骤状态 */
interface StepStatus {
  /** 步骤名称 */
  step: string;
  /** 步骤状态：pending（待处理）、processing（处理中）、completed（已完成）、failed（失败） */
  status: stepStatus;
}

/** 等待队列项 */
export interface WaitlistItem {
  /** 网址，作为唯一标识符 */
  url: string;
  /** 状态对象，记录每个步骤的状态 */
  status: Record<string, StepStatus>;
}

/** 事件监听器类型 */
type EventListener<T = any> = (data: T) => void;

/** 事件类型枚举 */
type EventType = 'add' | 'read' | 'remove' | 'clear' | 'update';

/** 等待队列管理类 */
class WaitlistManager {
  /** 等待队列数组 */
  private waitlist: WaitlistItem[] = [];
  
  /** 事件监听器映射 */
  private listeners: Map<EventType, Set<EventListener>> = new Map();

  /**
   * 向等待队列中添加新项
   * @param url - 网址
   * @param type - 处理类型，默认为 'full'
   */
  add(url: string, type: ProcessType = 'full'): number {
    const status: Record<string, StepStatus> = {};
    // Todo:
    // 根据类型初始化不同的步骤
    if (type === 'full') {
      steps.full.forEach(step => {
        status[step.name] = { step: step.name, status: 'pending' };
      });
    } else {
      steps.simple.forEach(step => {
        status[step.name] = { step: step.name, status: 'pending' };
      });
    }
    
    const item: WaitlistItem = { url, status };
    this.waitlist.push(item);
    this.emit('add', { url, type, item, count: this.waitlist.length });
    return this.waitlist.length;
  }

  /**
   * 读取队列中的第n个元素
   * @param n - 元素索引，默认为 0
   * @returns 第n个元素，如果索引超出范围则返回 null
   */
  read(n:number=0): WaitlistItem | null {
    const item = this.waitlist[n] || null;
    this.emit('read', { item, count: this.waitlist.length, index: n });
    return item;
  }

  /**
   * 删除队列中的第一个元素
   * @returns 被删除的元素，如果队列为空则返回 null
   */
  remove(): WaitlistItem | null {
    const item = this.waitlist.shift() || null;
    if (item) {
      this.emit('remove', { item, count: this.waitlist.length });
    }
    return item;
  }

  /**
   * 清空等待队列
   */
  clear(): void {
    this.waitlist = [];
    this.emit('clear', { count: 0 });
  }

  /**
   * 更新队列中第n个元素的状态
   * @param step - 要更新的步骤名称
   * @param status - 新的状态值
   * @param n - 元素索引，默认为 0
   */
  update(step: string, status: 'pending' | 'processing' | 'completed' | 'failed', n:number=0): void {
    const item = this.waitlist[n];
    if (item && item.status[step]) {
      const oldStatus = item.status[step].status;
      item.status[step].status = status;
      this.emit('update', { url: item.url, step, oldStatus, newStatus: status, index: n, count: this.waitlist.length });
    }
  }

  /**
   * 订阅事件
   * @param event - 事件类型
   * @param listener - 事件监听器
   */
  subscribe(event: EventType, listener: EventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /**
   * 取消订阅事件
   * @param event - 事件类型
   * @param listener - 事件监听器
   */
  unsubscribe(event: EventType, listener: EventListener): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * 触发事件
   * @param event - 事件类型
   * @param data - 事件数据
   */
  private emit(event: EventType, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  /**
   * 获取当前队列长度
   */
  get length(): number {
    return this.waitlist.length;
  }

  /**
   * 获取队列副本（防止外部修改）
   */
  get items(): WaitlistItem[] {
    return [...this.waitlist];
  }
}

/** 导出等待队列管理器实例 */
export const waitlist = new WaitlistManager();