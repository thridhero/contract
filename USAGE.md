# Electron 双面板应用 - 使用说明

## 项目简介
这是一个基于 Electron 的桌面应用程序，具有独特的双面板布局：
- 左侧面板：网页浏览器，可浏览任意网站
- 右侧面板：聊天界面，支持消息发送和接收

## 如何运行

### 1. 环境准备
确保您已安装 Node.js (版本 >= 14)

### 2. 安装依赖
```bash
npm install
```

如果在中国大陆地区遇到网络问题，可以尝试使用镜像源：
```bash
npm config set registry https://registry.npmmirror.com
npm install
```

### 3. 构建项目
```bash
npm run build
```

### 4. 启动应用
```bash
npm start
```

或者直接运行提供的批处理文件（Windows）：
```
start.bat
```

## 功能说明

### 左侧浏览器面板
- 地址栏：输入网址并按回车或点击“Go”按钮访问
- 导航按钮：
  - Home：返回默认页面 (GitHub)
  - Go：访问输入的网址
  - Reload：刷新当前页面
- 网页内容显示区域

### 右侧聊天面板
- 消息历史：显示发送和接收的消息
- 消息输入框：输入要发送的内容
- Send按钮：发送消息
- 按Enter键也可以发送消息
- 发送消息后会收到自动回复

## 开发说明

### 项目结构
- `src/main/`: 主进程代码
- `src/renderer/`: 渲染进程代码（包括React组件）
- `src/renderer/components/`: 功能组件（Browser和Chat）

### 主要文件
- `src/renderer/components/Browser.tsx`: 浏览器功能实现
- `src/renderer/components/Chat.tsx`: 聊天功能实现
- `src/renderer/App.tsx`: 双面板布局整合

### 开发命令
- `npm run build`: 构建项目
- `npm start`: 启动应用
- `npm run dev`: 开发模式（需额外配置）

## 注意事项
1. 由于网络原因，在安装 Electron 时可能需要配置镜像源
2. 应用使用 iframe 嵌入网页，某些网站可能因安全策略无法加载
3. 聊天功能目前是模拟实现，没有实际的后端服务
4. 可以根据需要扩展更多功能，如真实聊天服务、标签页浏览等

## 扩展建议
- 集成真实的聊天后端服务
- 添加网页标签页功能
- 实现消息持久化存储
- 添加主题切换功能
- 增加更多浏览器功能（收藏夹、历史记录等）