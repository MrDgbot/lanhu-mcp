<div align="center">

# 🎨 蓝湖 MCP Server

**让 AI 编程助手直接读取蓝湖设计稿、提取代码、解析需求文档**

[![npm version](https://img.shields.io/npm/v/mcp-lanhu)](https://www.npmjs.com/package/mcp-lanhu)
[![npm downloads](https://img.shields.io/npm/dm/mcp-lanhu)](https://www.npmjs.com/package/mcp-lanhu)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

[English](docs/README_EN.md)

</div>

---

## 这是什么

`mcp-lanhu` 是蓝湖的 [MCP](https://modelcontextprotocol.io/) 服务器，装上之后 **Cursor、Windsurf、Claude Desktop、Claude Code** 都能直接连接蓝湖。AI 可以读取设计稿、提取 HTML/CSS、解析 PRD、下载切图，全程不用离开编辑器。

> **一行命令，零配置** — `npx -y mcp-lanhu`，粘贴蓝湖链接就能用。

### 核心能力

- **设计稿 → 代码**：生成像素级 HTML + CSS，含完整 Design Tokens（颜色、字体、阴影、渐变）
- **结构化 Design Tokens**：提取所有颜色、字体族/字号/字重、阴影、边框、圆角，按使用频率排序
- **PRD 驱动开发**：将 PRD 或 Axure 原型交给 AI，需求感知编码
- **自动切图**：直接从蓝湖提取切图、图标和图片，无需手动导出
- **并发 + 重试**：多设计稿并行分析，网络异常自动重试
- **MCP Resources & Prompts**：内置前端开发和设计走查 Prompt 模板

---

## 安装

### 最快方式：让 AI 帮你装

复制下面这段话，发给你的 AI 助手（Cursor / Claude Code / Windsurf）：

> 帮我安装蓝湖 MCP 服务器：https://github.com/MrDgbot/lanhu-mcp

AI 会自动读取仓库说明并完成配置，你只需要提供蓝湖 Cookie。

---

### 手动配置

无需 clone 代码，`npx` 自动安装。

**Cursor / Windsurf** — 编辑 `.cursor/mcp.json`（或 `.windsurf/mcp.json`）：

```json
{
  "mcpServers": {
    "lanhu": {
      "command": "npx",
      "args": ["-y", "mcp-lanhu"],
      "env": { "LANHU_COOKIE": "your_cookie_here" }
    }
  }
}
```

**Claude Desktop** — 编辑 `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "lanhu": {
      "command": "npx",
      "args": ["-y", "mcp-lanhu"],
      "env": { "LANHU_COOKIE": "your_cookie_here" }
    }
  }
}
```

**Claude Code**：

```bash
claude mcp add lanhu -- npx -y mcp-lanhu
```

然后设置环境变量 `LANHU_COOKIE`。

### 获取 Cookie

1. 登录 [蓝湖](https://lanhuapp.com)
2. F12 打开开发者工具 → Network 标签
3. 复制任意请求的 `Cookie` 请求头

配置完成后重启客户端，粘贴蓝湖链接即可使用。

---

## 工具

### `lanhu_design` — 设计稿

通过 `mode` 参数切换功能：

| Mode | 说明 |
|------|------|
| `list` | 列出项目所有设计图 |
| `analyze` | 设计图 → HTML+CSS + Design Tokens（默认） |
| `tokens` | 仅提取 Design Tokens（字体、颜色、阴影等） |
| `slices` | 提取切图资源 |

`analyze` 模式支持 `include` 参数按需选择输出：`html`、`image`、`tokens`、`layout`、`layers`、`slices`。默认 `["html", "tokens", "layers", "image"]`。请求 `layers` 时可用 `layer_depth` 控制嵌套深度：默认 `4`，`0` 仅返回顶层，`"all"` 返回完整图层树。每个设计会按请求项返回 `success`、`partial_success` 或 `error`，结构化图层标注位于 `layer_annotations`。

**Design Tokens 输出示例：**

```
=== Design Tokens ===

Colors (12 unique):
  rgba(140,140,140,1) x48
  rgba(255,255,255,1) x28
  rgba(51,51,51,1) x12
  ...

Fonts (7 unique):
  Source Han Sans CN / Regular / 14px x25
  PingFang SC / Bold / 10px x3
  ...

Shadows (3 unique):
  rgba(0,81,187,0.03) 0px 0px 0px 1px x3
  ...
```

### `lanhu_page` — PRD / 原型

| Mode | 说明 |
|------|------|
| `list` | 列出 PRD 所有页面 |
| `analyze` | PRD/原型 → 结构化分析（默认） |

### `lanhu_resolve_invite` — 解析邀请链接

将蓝湖分享链接解析为可用的项目 URL。

---

## MCP Resources & Prompts

| 类型 | 名称 | 说明 |
|------|------|------|
| Resource | `project-designs` | 项目设计稿列表（`lanhu://project/{pid}/designs?tid={tid}`） |
| Prompt | `frontend-dev` | 根据设计稿生成像素级前端代码 |
| Prompt | `design-review` | 审查设计一致性和可实现性 |

---

## 使用场景

- **前端开发**：粘贴蓝湖链接 → AI 生成与设计稿匹配的组件代码
- **设计走查**：对比实现与 Design Tokens（间距、颜色、字体）
- **需求实现**：将 PRD 交给 AI，需求驱动的功能开发
- **资源导出**：批量提取图标和图片

---

## 兼容性

| 客户端 | 支持 | 传输 |
|--------|------|------|
| Cursor | ✅ | stdio |
| Windsurf | ✅ | stdio |
| Claude Desktop | ✅ | stdio |
| Claude Code | ✅ | stdio |
| 其他 MCP 兼容 IDE | ✅ | stdio |

---

## 开发

```bash
git clone https://github.com/MrDgbot/lanhu-mcp.git && cd lanhu-mcp
npm install && cp config.example.env .env  # 填入 LANHU_COOKIE
npm run dev    # 开发模式
npm run build  # 构建
npm test       # 测试
```

---

## FAQ

**Q: 什么是 MCP？**
A: [Model Context Protocol](https://modelcontextprotocol.io/)，让 AI 助手安全连接外部工具的开放标准。

**Q: 支持哪些蓝湖套餐？**
A: 任何可网页访问的蓝湖账号，通过浏览器 Cookie 认证。

**Q: `analyze` 返回太大怎么办？**
A: 用 `include` 参数，如 `["tokens"]` 只返回 Design Tokens；不需要 base64 图片时请不要包含 `image`。

**Q: 不用 Cursor 也能用？**
A: 能。支持所有 MCP 客户端。

---

## License

[MIT](LICENSE) © [MrDgbot](https://github.com/MrDgbot)
