# 实现progressMode函数计划

## 1. 在BookmarkModal类中添加私有属性
- 添加`private stepEls: Map<string, HTMLElement>`用于存储步骤元素映射
- 添加`private stepStatusUpdateListeners: Set<(stepName: string, status: stepStatus) => void>`用于管理步骤状态更新监听器

## 2. 完成progressMode函数
- 根据`full`参数选择对应的步骤列表（full或simple）
- 创建进度模式的UI，包括标题和步骤列表
- 为每个步骤创建对应的DOM元素，并设置初始状态
- 存储步骤元素到`stepEls`映射中

## 3. 添加状态更新方法
- 添加`updateStepStatus(stepName: string, status: stepStatus): void`方法
- 该方法负责更新指定步骤的状态和样式类
- 触发所有注册的状态更新监听器

## 4. 添加监听器管理方法
- 添加`onStepStatusUpdate(listener: (stepName: string, status: stepStatus) => void): void`方法用于添加监听器
- 添加`offStepStatusUpdate(listener: (stepName: string, status: stepStatus) => void): void`方法用于移除监听器

## 5. 更新onClose方法
- 在`onClose`方法中清空所有监听器，防止内存泄漏

## 6. 添加样式定义
- 在`createStyle`方法中添加进度模式的CSS样式，包括不同状态的样式类

## 7. 实现状态样式映射
- 为每种状态（pending、processing、completed、failed）定义对应的CSS类
- 在状态更新时动态切换这些类

## 8. 确保类型安全
- 正确导入和使用`stepStatus`类型
- 确保所有步骤名称和状态值符合类型定义

## 9. 测试实现
- 确保进度模式能正确显示
- 确保状态更新能正确反映到UI上
- 确保监听器能正确触发和移除