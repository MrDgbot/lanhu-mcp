<div align="center">

# 🎨 Lanhu MCP Server

**lanhumcp | lanhu-mcp | Lanhu AI Integration | MCP Server for Lanhu**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 20+](https://img.shields.io/badge/node-20+-339933.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub Stars](https://img.shields.io/github/stars/MrDgbot/lanhu-mcp?style=social)](https://github.com/MrDgbot/lanhu-mcp/stargazers)

English | [简体中文](../README.md)

[Quick Start](#-quick-start) • [Features](#-key-features) • [Usage](#-usage-guide) • [Contributing](#-contributing)

</div>

---

## 🌟 Highlights

A powerful [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for the Lanhu design collaboration platform, built with TypeScript.

🔥 **Core Innovations**:
- 📋 **Smart Requirement Analysis**: Auto-extract Axure prototypes, three analysis modes (Developer/Tester/Explorer), >95% accuracy
- 🌳 **Design Structure Tree**: Extract full design hierarchy from Sketch/XD (layer names/types/sizes/positions/fonts/colors)
- 🎨 **UI Design Support**: Auto-download designs, smart slice extraction, semantic naming; get precise font-size/spacing/color/font parameters with HTML+CSS code output
- ⚡ **Performance**: Version-based smart caching, incremental updates, concurrent processing

🎯 **Works with**:
- ✅ Cursor + Lanhu
- ✅ Windsurf + Lanhu
- ✅ Claude Code + Lanhu
- ✅ Any MCP-compatible AI development tool

---

## ✨ Key Features

### 📋 Requirement Document Analysis
- **Smart Extraction**: Auto-download and parse all Axure prototype pages, resources, and interactions
- **Three Modes**:
  - 🔧 **Developer**: Detailed field rules, business logic, global flowcharts
  - 🧪 **Tester**: Test scenarios, test cases, boundary values, validation rules
  - 🚀 **Explorer**: Core function overview, module dependencies, review points

### 🎨 UI Design Support
- **Design Viewing**: Batch download and display UI designs
- **Schema → HTML+CSS**: Auto-convert design Schema to code, matching Lanhu export quality
- **Sketch Annotation Fallback**: When Schema is unavailable, auto-extract full annotations from Sketch JSON
- **Design Structure Tree**: Extract full design hierarchy from Sketch/XD JSON
- **Slice Extraction**: Auto-identify and export design slices and icon assets
- **Design Tokens**: Auto-extract colors, fonts, gradients, shadows

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** (required)
- Lanhu account and Cookie (required)

### 1. Install

```bash
git clone https://github.com/MrDgbot/lanhu-mcp.git
cd lanhu-mcp
npm install
npm run build
```

### 2. Configure

```bash
cp config.example.env .env
# Edit .env and set your Lanhu Cookie
```

Required environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `LANHU_COOKIE` | Lanhu web Cookie | ✅ |
| `DDS_COOKIE` | DDS Cookie (defaults to LANHU_COOKIE) | No |

> 💡 Get Cookie: Log in to [Lanhu web](https://lanhuapp.com), open browser DevTools (F12), copy Cookie from request headers

### 3. Run

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm run build && npm start
```

### 4. Connect AI Client

The server uses **stdio transport**. Configure in your AI client:

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "lanhu": {
      "command": "node",
      "args": ["dist/server.js"],
      "cwd": "/path/to/lanhu-mcp",
      "env": {
        "LANHU_COOKIE": "your_cookie_here"
      }
    }
  }
}
```

### Docker

```bash
docker build -t lanhu-mcp .
docker run -e LANHU_COOKIE="your_cookie" lanhu-mcp
```

---

## 📖 Usage Guide

### Requirement Document Analysis

```
Please analyze this requirement document:
https://lanhuapp.com/web/#/item/project/product?tid=xxx&pid=xxx&docId=xxx
```

### UI Design Viewing

```
Please analyze this design:
https://lanhuapp.com/web/#/item/project/stage?tid=xxx&pid=xxx
```

### Slice Download

```
Download all slices from "Homepage Design"
```

---

## 🛠️ Available Tools

| Tool | Description |
|------|-------------|
| `lanhu_resolve_invite_link` | Parse invite/share links |
| `lanhu_list_pages` | Get PRD/prototype page list |
| `lanhu_analyze_pages` | Analyze prototype page content |
| `lanhu_list_designs` | Get UI design list |
| `lanhu_analyze_designs` | Analyze UI designs (HTML+CSS + Design Tokens) |
| `lanhu_get_slices` | Get slice/asset info |

---

## 📁 Project Structure

```
lanhu-mcp/
├── src/                          # TypeScript source
│   ├── server.ts                 # MCP server entry
│   ├── config.ts                 # Configuration
│   ├── lanhu/                    # Lanhu API client
│   ├── tools/                    # MCP tool registration
│   ├── transform/                # Data transformation
│   └── shared/                   # Shared modules
├── tests-ts/                     # Vitest tests
├── dist/                         # Build output (gitignored)
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── config.example.env            # Environment template
├── Dockerfile                    # Docker image
└── README.md
```

---

## 🧪 Development

```bash
npm run check    # Type check
npm test         # Run tests
npm run dev      # Dev mode
```

---

## 🔒 Security

- ⚠️ **Cookie Security**: Never commit `.env` files to public repos
- 🔐 **Access Control**: Deploy in private network recommended
- 📝 **Data Privacy**: Cache stored locally, keep it safe

---

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 📄 License

MIT License - see [LICENSE](../LICENSE) file

---

## 📞 Contact

- GitHub Issues: [Submit Issue](https://github.com/MrDgbot/lanhu-mcp/issues)
- GitHub Discussions: [Discussions](https://github.com/MrDgbot/lanhu-mcp/discussions)

---

## ⚠️ Disclaimer

This project is a **third-party open source project**, independently developed and maintained by community developers, and **is NOT an official Lanhu product**.

- No official affiliation with Lanhu (蓝湖)
- Interacts through public web interfaces only
- Requires a legitimate Lanhu account
- For learning and research purposes; users assume all risks
- Data processed locally; credentials stored in your environment only
- MIT Licensed, provided "as is" without warranty
