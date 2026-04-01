# 🤖 AI 助手安装指南

> **专为 AI 助手设计的安装指导文档**  
> AI 可以根据这个文档一步步引导用户完成安装

---

## 📝 安装检查清单

在开始之前，AI 需要确认用户的系统环境：

```
[ ] 操作系统：Windows / Mac / Linux
[ ] 是否安装了 Python？(python --version 或 python3 --version)
[ ] 是否安装了 Git？(git --version)
[ ] 是否有蓝湖账号？
```

---

## 🚀 安装流程（3种方式，由简到难）

### 方式1：一键安装（推荐小白）⭐⭐⭐⭐⭐

**步骤1：下载项目**
```bash
# AI 可以执行这个命令
git clone https://github.com/MrDgbot/lanhu-mcp.git
cd lanhu-mcp
```

**步骤2：运行交互式安装脚本**
```bash
# Linux/Mac
bash scripts/easy-install.sh

# Windows
scripts\easy-install.bat
```

脚本会自动：
- ✅ 检查环境
- ✅ 安装依赖
- ✅ 交互式获取 Cookie（有图文教程）
- ✅ 自动配置
- ✅ 启动服务

**AI 引导话术示例**：
```
我现在帮你安装 Lanhu MCP Server，非常简单！

1. 我先帮你下载项目（正在执行...）
2. 接下来需要运行安装脚本，我会一步步告诉你怎么做
3. 有一个步骤需要你配合：获取蓝湖的 Cookie
   不用担心，我会给你看图片，跟着做就行！
   
准备好了吗？我们开始吧！
```

---

### 方式2：快速启动（有基础的用户）⭐⭐⭐⭐

使用现有的 `scripts/quickstart.sh`：

```bash
# Linux/Mac
bash scripts/quickstart.sh

# Windows
scripts\quickstart.bat
```

需要手动：
1. 获取 Cookie
2. 编辑 `.env` 文件

**AI 引导话术示例**：
```
我看你对命令行有一定了解，那我们用快速安装方式：

1. 执行 scripts/quickstart.sh（正在运行...）
2. 脚本会提示你获取 Cookie，请按照以下步骤：
   - 打开 https://lanhuapp.com 并登录
   - 按 F12 打开开发者工具
   - 点击 "Network" 标签
   - 刷新页面
   - 在请求列表中点击任意请求
   - 找到 "Request Headers" 下的 "Cookie"
   - 复制整个 Cookie 值
3. 把 Cookie 粘贴到 .env 文件中

我可以帮你自动打开 .env 文件吗？
```

---

### 方式3：Docker 部署（高级用户）⭐⭐⭐

详见 `DEPLOY.md`

---

## 🍪 Cookie 获取详细指南

### 方法1：Chrome/Edge（推荐）

1. **打开蓝湖并登录**
   ```
   https://lanhuapp.com
   ```

2. **打开开发者工具**
   - Windows/Linux: 按 `F12` 键
   - Mac: 按 `Command + Option + I`
   - 或者：右键点击页面 → 选择"检查"

3. **切换到 Network 标签**
   - 在开发者工具顶部找到 "Network"（网络）标签
   - 点击它

4. **刷新页面**
   - 按 `F5` 或点击浏览器的刷新按钮

5. **找到并复制 Cookie**
   - 在请求列表中点击任意一个请求（通常是第一个）
   - 右侧会显示请求详情
   - 找到 "Request Headers"（请求头）部分
   - 找到 "Cookie:" 开头的那一行
   - 选中并复制整个 Cookie 值（可能很长）

### 方法2：开发者工具 Application 面板

1. 打开开发者工具（F12）
2. 切换到 "Application"（应用程序）标签
3. 左侧找到 "Cookies" → "https://lanhuapp.com"
4. 右侧会显示所有 Cookie
5. 手动拼接成一个字符串：`name1=value1; name2=value2; ...`

---

## 🤖 AI 自动化安装能力

### AI 可以做的：
- ✅ 执行命令下载项目
- ✅ 运行安装脚本
- ✅ 检查环境
- ✅ 安装依赖
- ✅ 修改配置文件
- ✅ 启动服务
- ✅ 提供图文教程链接

### AI 无法做的（需要用户配合）：
- ❌ 自动获取 Cookie（浏览器安全限制）
- ❌ 自动登录蓝湖账号

### AI 引导流程示例：

```
AI: "我现在帮你安装 Lanhu MCP Server，整个过程大约需要 3-5 分钟。"

AI: "步骤1：下载项目（执行 git clone...）"
AI: "✅ 下载完成！"

AI: "步骤2：安装依赖（执行 pip install...）"
AI: "✅ 依赖安装完成！"

AI: "步骤3：获取 Cookie（这一步需要你的配合）"
AI: "我打开了一个图文教程，跟着做就行，非常简单！"
AI: "（展示截图或教程链接）"

用户: "我复制好了"

AI: "太棒了！把 Cookie 发给我，我帮你配置。"

用户: "（粘贴 Cookie）"

AI: "收到！我正在配置...（修改 .env 文件）"
AI: "✅ 配置完成！"

AI: "步骤4：启动服务"
AI: "🚀 服务已启动！地址是 http://localhost:8000/mcp"

AI: "最后一步：在 Cursor 中配置 MCP"
AI: "我帮你生成配置文件：（展示配置）"
```

---

## 🎯 简化版安装步骤（给小白看的）

### 只需3步：

**第1步：运行安装命令**
```bash
git clone https://github.com/MrDgbot/lanhu-mcp.git
cd lanhu-mcp
bash scripts/easy-install.sh  # Windows 用户用 scripts\easy-install.bat
```

**第2步：获取 Cookie**
- 打开 https://lanhuapp.com 并登录
- 按 F12 键
- 点击 "Network" 标签
- 刷新页面（按F5）
- 点击任意请求，找到 "Cookie"，复制

**第3步：粘贴 Cookie**
- 按照脚本提示，粘贴你的 Cookie
- 完成！

---

## 📸 可视化教程（截图）

AI 可以引导用户访问这些教程：

1. **Cookie 获取教程（带截图）**
   - 创建：`docs/get-cookie-tutorial.md`
   - 包含每一步的截图

2. **视频教程（可选）**
   - 3分钟安装视频
   - 上传到 B站/YouTube

---

## 🆘 常见问题

### Q1: 我不知道怎么打开终端/命令行？

**Windows:**
- 按 `Win + R` 键
- 输入 `cmd` 回车

**Mac:**
- 按 `Command + 空格`
- 输入 `terminal` 回车

**AI 可以：** 引导用户打开终端

### Q2: 提示 Python 未安装？

AI 引导：
```
看起来你的电脑还没有安装 Python，我帮你安装：

Windows: 
  访问 https://www.python.org/downloads/
  下载并安装最新版本（记得勾选 "Add Python to PATH"）

Mac:
  在终端执行：brew install python3
  （如果没有 brew，先安装 Homebrew）
```

### Q3: Cookie 在哪里粘贴？

AI 会自动打开 `.env` 文件，告诉用户：
```
我已经打开了配置文件，你只需要：
1. 找到这一行：LANHU_COOKIE="your_lanhu_cookie_here"
2. 把引号里的内容替换成你复制的 Cookie
3. 保存文件（Ctrl+S 或 Command+S）
```

---

## 🎁 优化建议

为了让项目更小白友好，建议添加：

1. ✨ **交互式安装脚本** `scripts/easy-install.sh`
   - 逐步提示
   - 自动检测问题
   - 交互式输入 Cookie

2. 📸 **带截图的教程** `docs/get-cookie-tutorial.md`
   - 每一步都有截图
   - 常见错误的解决方案

3. 🎥 **3分钟视频教程**
   - 从0到运行的完整过程
   - 适合视觉学习者

4. 🤖 **AI 安装助手**
   - 在 README 首页就说明"可以让 AI 帮你安装"
   - 提供 AI 友好的命令

---

## ✅ 安装成功标志

当看到以下输出，说明安装成功：

```
🚀 正在启动蓝湖 MCP 服务器...
==================================

服务器地址：http://localhost:8000/mcp

✅ 服务器启动成功！
```

下一步：在 Cursor 中配置 MCP（AI 会继续指导）

