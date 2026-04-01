<div align="center">

# Lanhu MCP Server

让 AI 直接读取蓝湖设计稿和需求文档

[![npm](https://img.shields.io/npm/v/mcp-lanhu)](https://www.npmjs.com/package/mcp-lanhu)
[![MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

## 安装

无需 clone 代码，直接在 AI 客户端配置中使用 `npx` 自动安装运行。

**Cursor / Windsurf**：编辑 `.cursor/mcp.json`

**方式 A（推荐，零安装）**：把 Cookie 写在 `env` 里（不要用 `NODE_OPTIONS=--env-file`，Node 会拒绝）。

```json
{
  "mcpServers": {
    "lanhu": {
      "command": "npx",
      "args": ["-y", "mcp-lanhu"],
      "env": { "LANHU_COOKIE": "你的Cookie" }
    }
  }
}
```

**方式 B（本地 clone + 用 `.env`）**：把 `--env-file` 放在 **`node` 的参数里**，不要放进 `NODE_OPTIONS`。

```json
{
  "mcpServers": {
    "lanhu": {
      "command": "node",
      "args": [
        "--env-file=/绝对路径/lanhu-mcp/.env",
        "/绝对路径/lanhu-mcp/dist/server.js"
      ],
      "cwd": "/绝对路径/lanhu-mcp"
    }
  }
}
```

先在本仓库执行 `npm run build` 生成 `dist/`。可选配置项（日志级别、超时等）见 `config.example.env`。

**Claude Code**：

```bash
claude mcp add lanhu -- npx -y mcp-lanhu
```

> Cookie 获取：登录 [蓝湖](https://lanhuapp.com) → F12 → Network → 复制任意请求的 Cookie

重启客户端后，对话中发蓝湖链接即可使用。

## 功能

| 工具 | 说明 |
|------|------|
| `lanhu_analyze_designs` | 设计图 → HTML+CSS + Design Tokens |
| `lanhu_analyze_pages` | PRD/原型 → 结构化分析 |
| `lanhu_list_designs` / `lanhu_list_pages` | 列出设计图/页面 |
| `lanhu_get_slices` | 提取切图资源 |
| `lanhu_resolve_invite_link` | 解析邀请链接 |

## 开发

```bash
git clone https://github.com/MrDgbot/lanhu-mcp.git && cd lanhu-mcp
npm install && cp config.example.env .env  # 填 LANHU_COOKIE
npm run dev
```

[MIT](LICENSE)
