# AgentID UI Demo

这是一个基于React + TypeScript + Ant Design的AgentID管理系统演示项目。

## 项目特性

- 🎨 现代化的UI设计
- 🔐 完整的用户认证流程
- 🤖 Agent管理系统
- ⛓️ 区块链集成演示
- 📊 数据可视化仪表板
- 📱 响应式设计

## 演示视频

### 功能演示

[查看视频](./vedio/录屏2026-07-10%2011.17.48.mov)

<video src="./vedio/录屏2026-07-10 11.17.48.mov" controls width="720"></video>

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI组件库**: Ant Design 5.x
- **状态管理**: Zustand
- **样式**: Tailwind CSS
- **路由**: React Router v6
- **图表**: Recharts

## 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

项目将在 http://localhost:5173 启动

### 构建项目
```bash
npm run build
```

## 项目结构

```
src/
├── components/          # 可复用组件
│   ├── ui/             # 基础UI组件
│   ├── layout/         # 布局组件
│   └── ...
├── pages/              # 页面组件
│   ├── auth/           # 认证相关页面
│   ├── dashboard/      # 仪表板
│   ├── agents/         # Agent管理
│   └── ...
├── hooks/              # 自定义hooks
├── services/           # API服务
├── store/              # 状态管理
├── types/              # TypeScript类型
├── utils/              # 工具函数
└── mocks/              # Mock数据
```

## 功能模块

### 1. 用户认证
- 用户注册（多步骤流程）
- 登录/登出
- 生物特征绑定演示

### 2. 仪表板
- 统计数据展示
- 系统状态监控
- 最近活动记录
- 快速操作入口

### 3. Agent管理
- Agent列表查看
- Agent创建和配置
- Agent详情展示
- Agent状态监控

### 4. 认证流程演示
- 多步骤认证流程
- 生物特征验证
- 零知识证明生成
- 区块链合约验证

## 开发说明

本项目使用Mock数据模拟后端API，无需真实的后端服务即可运行所有功能。

### 状态管理
使用Zustand进行状态管理，主要包含：
- `authStore`: 用户认证状态
- `agentStore`: Agent数据管理
- `uiStore`: UI状态管理

### 组件开发
遵循原子化设计原则，组件分为：
- 原子组件：基础UI元素
- 分子组件：复合组件
- 有机组件：业务模块

## 部署

### 静态部署
```bash
npm run build
# 构建后的文件在 dist/ 目录
```

### 环境变量
创建 `.env` 文件配置环境变量：
```env
VITE_API_BASE_URL=http://localhost:3000
```

## 许可证

MIT License

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
# AgentIDDemo
