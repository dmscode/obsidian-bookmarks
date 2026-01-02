import { stepStatus } from "./types";

/** 单个步骤的类型定义 */
export interface Step {
  /** 步骤标题 */
  title: string;
  /** 步骤描述 */
  desc: string;
  /** 步骤名称标识符 */
  name: string;
  /** 预估完成时间（可选） */
  estimatedTime?: number;
  /** 步骤状态 */
  status?: stepStatus;
}

/** 步骤集合的类型定义 */
interface StepsCollection {
  /** 完整步骤列表 */
  full: Step[];
  /** 简化步骤列表（跳过前3个步骤） */
  simple: Step[];
}

const allSteps: Step[] = [
    {
        "title": "获取网页内容",
        "desc": "使用 Jina 从目标网址获取内容",
        "name": "get-web-content",
        "estimatedTime": 30
    },
    {
        "title": "获取网站评价",
        "desc": "使用 Jina 搜索目标网址获取相关评价",
        "name": "get-web-rating",
        "estimatedTime": 60
    },
    {
        "title": "生成书签信息",
        "desc": "使用 AI 根据获取的内容生成书签信息",
        "name": "generate-bookmark-info",
        "estimatedTime": 60
    },
    {
        "title": "下载网站截图",
        "desc": "使用 Thum.io 下载目标网址的截图",
        "name": "download-web-screenshot",
        "estimatedTime": 60
    },
    {
        "title": "创建书签笔记",
        "desc": "根据生成的书签信息创建 Obsidian 笔记",
        "name": "create-bookmark-note",
        "estimatedTime": 10
    },
];

export const steps: StepsCollection = {
    "full": allSteps,
    "simple": allSteps.slice(3),
}

export const statusIcons: Record<stepStatus, string> = {
    "pending": "circle",
    "processing": "loader-circle",
    "completed": "circle-check-big",
    "failed": "circle-alert",
}
