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
- **Structured Design Tokens**: Extract all colors, font families/sizes/weights, shadows, borders, border radii — sorted by usage frequency

### ⚡ Performance & Integration
- **Concurrent Processing**: Multiple designs analyzed in parallel (5 concurrent) with automatic retry
- **MCP Resources**: Design lists exposed as MCP Resource templates for discovery
- **MCP Prompts**: Built-in `frontend-dev` and `design-review` prompt templates

---

## 🚀 Quick Start

### Fastest Way: Let AI Install It

Copy this and send it to your AI assistant (Cursor / Claude Code / Windsurf):

> Install the Lanhu MCP server for me: https://github.com/MrDgbot/lanhu-mcp

The AI will read the repo and configure everything automatically. You just need to provide your Lanhu Cookie.

---

### Manual Setup

### Prerequisites

- **Node.js 20+** (required)
- Lanhu account and Cookie (required)

> 💡 Get Cookie: Log in to [Lanhu web](https://lanhuapp.com), open browser DevTools (F12), copy Cookie from request headers. See [GET-COOKIE-TUTORIAL.md](GET-COOKIE-TUTORIAL.md) for details.

### Zero-Install (npx)

No cloning or building needed. Just configure your AI client:

**Cursor / Windsurf** (`.cursor/mcp.json` or `.windsurf/mcp.json`):
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

**Claude Desktop** (`claude_desktop_config.json`):
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

**Claude Code**:
```bash
claude mcp add lanhu -- npx -y mcp-lanhu
```

### Local Development

```bash
git clone https://github.com/MrDgbot/lanhu-mcp.git
cd lanhu-mcp
npm install
npm run build
npm start
```

| Variable | Description | Required |
|----------|-------------|----------|
| `LANHU_COOKIE` | Lanhu web Cookie | Yes |
| `DDS_COOKIE` | DDS Cookie (defaults to LANHU_COOKIE) | No |

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

### `lanhu_design` — Design Analysis

Unified design tool with `mode` parameter:

| Mode | Description |
|------|-------------|
| `list` | List all design images in a project |
| `analyze` | Design → HTML + CSS + Design Tokens (default) |
| `tokens` | Extract design tokens only (fonts, colors, shadows) |
| `slices` | Extract icon & image assets for download |

The `analyze` mode supports an `include` parameter to control output: `html`, `image`, `tokens`, `layout`, `layers`, `slices`. Default: `["html", "tokens", "layers", "image"]`. For `layers`, set `layer_depth` to `4` (default), `0` for top-level layers only, or `"all"` for the complete tree. Each design reports `success`, `partial_success`, or `error`, and structured layer annotations are returned in `layer_annotations`.

### `lanhu_page` — PRD / Prototype Analysis

| Mode | Description |
|------|-------------|
| `list` | List all pages in a PRD document |
| `analyze` | PRD / Axure → Structured analysis (default) |

### `lanhu_resolve_invite` — Resolve Invite Links

Parse Lanhu invite/share links into usable project URLs.

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
