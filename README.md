<div align="center">

# 🎨 Lanhu MCP Server | 蓝湖MCP服务器

**让所有 AI 助手共享团队知识，打破 AI IDE 孤岛**

**lanhumcp | 蓝湖mcp | lanhu-mcp | 蓝湖AI助手 | 蓝湖skills | Lanhu AI Integration**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 20+](https://img.shields.io/badge/node-20+-339933.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](docs/CONTRIBUTING.md)
[![GitHub Stars](https://img.shields.io/github/stars/MrDgbot/lanhu-mcp?style=social)](https://github.com/MrDgbot/lanhu-mcp/stargazers)

[English](docs/README_EN.md) | 简体中文

[快速开始](#-快速开始) • [功能特性](#-核心特性) • [使用指南](#-使用指南) • [贡献指南](docs/CONTRIBUTING.md)

</div>

---

## 🌟 项目亮点

一个功能强大的 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 服务器，专为 AI 编程时代设计，完美支持蓝湖（Lanhu）设计协作平台。

🔥 **核心创新**：
- 📋 **智能需求分析**：自动提取 Axure 原型，三种分析模式（开发/测试/探索），需求分析准确率>95%
- 🌳 **设计结构树**：从 Sketch/XD 提取完整设计层级（图层名/类型/尺寸/位置/字体/颜色），不仅仅是截图
- 🎨 **UI设计支持**：自动下载设计稿，智能提取切图，语义化命名；设计图分析可获取尺寸/间距/颜色/字体等精确参数，并得到转换后的 HTML+CSS 代码参考
- ⚡ **性能优化**：基于版本号的智能缓存，增量更新，并发处理

🎯 **适用场景**：
- ✅ Cursor + 蓝湖：让 Cursor AI 直接读取蓝湖需求文档和设计稿
- ✅ Windsurf + 蓝湖：Windsurf Cascade AI 直接读取蓝湖需求文档和设计稿
- ✅ Claude Code + 蓝湖：Claude AI 直接读取蓝湖需求文档和设计稿
- ✅ 任何支持 MCP 协议的 AI 开发工具

---

## ✨ 核心特性

### 📋 需求文档分析
- **智能文档提取**：自动下载和解析 Axure 原型的所有页面、资源和交互
- **三种分析模式**：
  - 🔧 **开发视角**：详细字段规则、业务逻辑、全局流程图
  - 🧪 **测试视角**：测试场景、用例、边界值、校验规则
  - 🚀 **快速探索**：核心功能概览、模块依赖、评审要点

### 🎨 UI设计支持
- **设计稿查看**：批量下载和展示 UI 设计图
- **Schema 转 HTML+CSS**：自动将设计 Schema 转为代码，与蓝湖导出效果一致
- **Sketch 标注回退**：Schema 不可用时自动从 Sketch JSON 提取完整标注（底图叠加+文字图层+CSS 标注）
- **设计层级结构树**：从 Sketch/XD JSON 中提取完整设计层级
- **切图提取**：自动识别和导出设计切图、图标资源
- **Design Tokens**：自动提取颜色、字体、渐变、阴影等设计令牌

---

## 🚀 快速开始

### 前置要求

- **Node.js 20+**（必需）
- 蓝湖账号和 Cookie（必需）

### 1. 安装

```bash
# 克隆项目
git clone https://github.com/MrDgbot/lanhu-mcp.git
cd lanhu-mcp

# 安装依赖
npm install

# 构建
npm run build
```

### 2. 配置

```bash
# 从模板创建 .env 配置文件
cp config.example.env .env

# 编辑 .env 填入你的蓝湖 Cookie
```

必需环境变量：

| 变量 | 说明 | 必需 |
|------|------|------|
| `LANHU_COOKIE` | 蓝湖网页版 Cookie | ✅ |
| `DDS_COOKIE` | DDS Cookie（默认同 LANHU_COOKIE） | 否 |

> 💡 获取 Cookie：登录 [蓝湖网页版](https://lanhuapp.com)，打开浏览器开发者工具（F12），从请求头中复制 Cookie

### 3. 运行

```bash
# 开发模式（自动重载）
npm run dev

# 生产模式
npm run build && npm start
```

### 4. 连接 AI 客户端

服务器使用 **stdio 传输**，在 AI 客户端（Cursor、Claude Code 等）中配置：

**推荐方式（npx，无需 clone）**：
```json
{
  "mcpServers": {
    "lanhu": {
      "command": "npx",
      "args": ["-y", "lanhu-mcp"],
      "env": {
        "LANHU_COOKIE": "your_cookie_here"
      }
    }
  }
}
```

**本地开发配置**（clone 后）：
```json
{
  "mcpServers": {
    "lanhu": {
      "command": "npx",
      "args": ["tsx", "src/server.ts"],
      "cwd": "/path/to/lanhu-mcp",
      "env": {
        "LANHU_COOKIE": "your_cookie_here"
      }
    }
  }
}
```

### Docker 部署

```bash
# 构建镜像
docker build -t lanhu-mcp .

# 运行
docker run -e LANHU_COOKIE="your_cookie" lanhu-mcp
```

---

## 📖 使用指南

### 需求文档分析

```
请帮我分析这个需求文档：
https://lanhuapp.com/web/#/item/project/product?tid=xxx&pid=xxx&docId=xxx
```

### UI 设计稿查看

```
请帮我分析这个设计稿：
https://lanhuapp.com/web/#/item/project/stage?tid=xxx&pid=xxx
```

### 切图下载

```
帮我下载"首页设计"的所有切图
```

---

## 🛠️ 可用工具列表

| 工具名称 | 功能描述 |
|---------|---------|
| `lanhu_resolve_invite_link` | 解析蓝湖邀请/分享链接 |
| `lanhu_list_pages` | 获取 PRD/原型页面列表 |
| `lanhu_analyze_pages` | 分析原型页面内容 |
| `lanhu_list_designs` | 获取 UI 设计图列表 |
| `lanhu_analyze_designs` | 分析 UI 设计图（HTML+CSS + Design Tokens） |
| `lanhu_get_slices` | 获取切图/资源信息 |

---

## 📁 项目结构

```
lanhu-mcp/
├── src/                          # TypeScript 源码
│   ├── server.ts                 # MCP 服务器入口
│   ├── config.ts                 # 配置管理
│   ├── lanhu/                    # 蓝湖 API 客户端
│   │   ├── client.ts             # HTTP 客户端
│   │   ├── designs.ts            # 设计图 API
│   │   └── pages.ts              # 页面 API
│   ├── tools/                    # MCP 工具注册
│   │   ├── analyze-designs.ts    # 设计图分析
│   │   ├── analyze-pages.ts      # 页面分析
│   │   ├── list-designs.ts       # 设计图列表
│   │   ├── list-pages.ts         # 页面列表
│   │   ├── get-slices.ts         # 切图获取
│   │   └── resolve-invite.ts     # 链接解析
│   ├── transform/                # 数据转换
│   │   ├── schema-to-html.ts     # Schema → HTML+CSS
│   │   ├── sketch-to-html.ts     # Sketch → HTML+CSS（标注模式）
│   │   ├── sketch-annotations.ts # Sketch → 结构化标注文本
│   │   ├── layout-summary.ts     # 布局摘要
│   │   └── design-tokens.ts      # Design Tokens 提取
│   └── shared/                   # 公共模块
│       ├── types.ts              # 类型定义
│       ├── html.ts               # HTML 工具函数
│       ├── errors.ts             # 错误处理
│       └── fs.ts                 # 文件系统工具
├── tests-ts/                     # Vitest 测试
├── archive/python/               # 归档的 Python 原版
├── dist/                         # 编译输出（git 忽略）
├── package.json                  # 依赖管理
├── tsconfig.json                 # TypeScript 配置
├── config.example.env            # 环境变量模板
├── Dockerfile                    # Docker 镜像
└── README.md                     # 本文件
```

---

## 🧪 开发

```bash
# 类型检查
npm run check

# 运行测试
npm test

# 开发模式
npm run dev
```

> **注意**：修改源码后需执行 `npm run build` 并在 Cursor / Claude Code 等客户端中重启 MCP 服务，新代码才会生效。

---

## 🔒 安全说明

- ⚠️ **Cookie 安全**：请勿将含有 Cookie 的 `.env` 文件提交到公开仓库
- 🔐 **访问控制**：建议在内网环境部署
- 📝 **数据隐私**：缓存数据存储在本地，请妥善保管

---

## 🤝 贡献指南

欢迎贡献代码！详见 [CONTRIBUTING.md](docs/CONTRIBUTING.md)

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 📞 联系方式

- GitHub Issues: [提交问题](https://github.com/MrDgbot/lanhu-mcp/issues)
- GitHub Discussions: [讨论区](https://github.com/MrDgbot/lanhu-mcp/discussions)
