# 🎉 Lanhu MCP Server v1.0.0

## 首个正式版本发布！

让所有 AI 助手共享团队知识，打破 AI IDE 孤岛。

---

## 🌟 核心特性

### 📋 AI 直接读取蓝湖需求文档
- ✅ 给个 URL，AI 自动提取 Axure 原型
- ✅ 三种分析模式：开发视角、测试视角、快速探索
- ✅ 四阶段零遗漏工作流
- ✅ 自动生成流程图和需求文档

### 🎨 UI 设计支持
- ✅ 设计稿批量下载和展示
- ✅ 切图自动提取和智能命名
- ✅ 元数据提取（颜色、透明度、阴影）

### ⚡ 性能优化
- ✅ 基于版本号的智能缓存
- ✅ 增量更新，避免重复下载
- ✅ 并发处理，页面截图 ~2秒/页

---

## 📦 安装方式

### 方式一：让 AI 帮你（推荐）
在 Cursor 中对 AI 说：
```
"帮我克隆并安装 https://github.com/MrDgbot/lanhu-mcp 项目"
```

### 方式二：Docker 部署
```bash
git clone https://github.com/MrDgbot/lanhu-mcp.git
cd lanhu-mcp
bash scripts/setup-env.sh
docker-compose up -d
```

### 方式三：源码运行
```bash
git clone https://github.com/MrDgbot/lanhu-mcp.git
cd lanhu-mcp
bash scripts/easy-install.sh
```

---

## 🎯 使用场景

✅ **适合你，如果：**
- 公司用蓝湖管理需求文档和 UI 设计
- 团队使用 Cursor/Windsurf/Claude Desktop 等 AI IDE
- 需要多角色协作（后端、前端、测试、产品）

---

## 📊 技术栈

- **协议**: Model Context Protocol (MCP)
- **框架**: FastMCP (Python)
- **浏览器**: Playwright
- **要求**: Python 3.10+

---

## 📖 文档

- [中文文档](https://github.com/MrDgbot/lanhu-mcp/blob/main/README.md)
- [English Docs](https://github.com/MrDgbot/lanhu-mcp/blob/main/docs/README_EN.md)
- [贡献指南](https://github.com/MrDgbot/lanhu-mcp/blob/main/docs/CONTRIBUTING.md)
- [Cookie 获取教程](https://github.com/MrDgbot/lanhu-mcp/blob/main/docs/GET-COOKIE-TUTORIAL.md)
- [Docker 部署指南](https://github.com/MrDgbot/lanhu-mcp/blob/main/docs/DEPLOY.md)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License

---

## ⭐ Star History

如果这个项目对你有帮助，请给个 Star ⭐！

---

**完整更新日志**: [CHANGELOG.md](https://github.com/MrDgbot/lanhu-mcp/blob/main/docs/CHANGELOG.md)

















