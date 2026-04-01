# Security Policy / 安全政策

## Supported Versions / 支持的版本

We release patches for security vulnerabilities for the following versions:

我们为以下版本发布安全漏洞补丁：

| Version | Supported          | 支持状态 |
| ------- | ------------------ | -------- |
| 1.x.x   | :white_check_mark: | ✅ 支持  |
| < 1.0   | :x:                | ❌ 不支持 |

## Reporting a Vulnerability / 报告漏洞

We take the security of Lanhu MCP Server seriously. If you believe you have found a security vulnerability, please report it to us as described below.

我们非常重视 Lanhu MCP Server 的安全性。如果您认为发现了安全漏洞，请按照以下方式向我们报告。

### Please Do Not / 请勿

- **Do not** open a public GitHub issue for security vulnerabilities
  **不要**为安全漏洞创建公开的 GitHub Issue
- **Do not** disclose the vulnerability publicly until we have had a chance to address it
  **不要**在我们有机会解决之前公开披露漏洞

### How to Report / 如何报告

**Email**: youngjimmy8305@gmail.com

Please include the following information in your report:

请在报告中包含以下信息：

- **Type of vulnerability**: (e.g., XSS, SQL injection, authentication bypass)
  **漏洞类型**：（例如：XSS、SQL 注入、身份验证绕过）
- **Full paths of source file(s)** related to the vulnerability
  与漏洞相关的**源文件的完整路径**
- **Location of the affected source code** (tag/branch/commit or direct URL)
  **受影响源代码的位置**（标签/分支/提交或直接 URL）
- **Step-by-step instructions** to reproduce the issue
  重现问题的**分步说明**
- **Proof-of-concept or exploit code** (if possible)
  **概念验证或漏洞利用代码**（如果可能）
- **Impact of the issue**, including how an attacker might exploit it
  **问题的影响**，包括攻击者如何利用它
- **Your name/handle** for acknowledgment (optional)
  用于致谢的**您的姓名/昵称**（可选）

### What to Expect / 您可以期待

After you submit a report, here's what will happen:

提交报告后，将发生以下情况：

1. **Within 48 hours**: We will acknowledge receipt of your report
   **48 小时内**：我们将确认收到您的报告
2. **Within 7 days**: We will provide a detailed response indicating the next steps
   **7 天内**：我们将提供详细的响应，说明后续步骤
3. **Regular updates**: We will keep you informed about our progress
   **定期更新**：我们将随时告知您我们的进展
4. **Fix and disclosure**: Once the vulnerability is fixed, we will:
   **修复和披露**：一旦漏洞修复，我们将：
   - Release a security patch
     发布安全补丁
   - Publish a security advisory
     发布安全公告
   - Credit you for the discovery (if you wish)
     为您的发现署名（如果您愿意）

### Preferred Languages / 首选语言

We prefer all communications to be in English or Chinese (Simplified).

我们希望所有通信使用英语或中文（简体）。

## Security Best Practices / 安全最佳实践

When using Lanhu MCP Server, please follow these security best practices:

使用 Lanhu MCP Server 时，请遵循以下安全最佳实践：

### 1. Cookie Management / Cookie 管理

- **Never commit** your `LANHU_COOKIE` to version control
  **永远不要**将您的 `LANHU_COOKIE` 提交到版本控制
- **Store cookies securely** using environment variables or secure secret management
  使用环境变量或安全的密钥管理**安全地存储 cookie**
- **Rotate cookies regularly** to minimize exposure risk
  **定期轮换 cookie** 以最小化暴露风险
- **Use separate cookies** for development and production environments
  为开发和生产环境**使用单独的 cookie**

### 2. Network Security / 网络安全

- **Deploy in a trusted network** or use VPN/firewall rules
  **部署在受信任的网络中**或使用 VPN/防火墙规则
- **Use HTTPS** when deploying in production
  在生产环境中部署时**使用 HTTPS**
- **Limit access** to the MCP server port (default: 8000)
  **限制对** MCP 服务器端口的访问（默认：8000）
- **Consider using authentication** for the MCP endpoint
  **考虑为** MCP 端点使用身份验证

### 3. Data Protection / 数据保护

- **Secure the data directory** (`./data/`) which contains:
  **保护数据目录**（`./data/`），其中包含：
  - Team messages with potentially sensitive information
    可能包含敏感信息的团队消息
  - Cached design files and screenshots
    缓存的设计文件和截图
  - Project metadata
    项目元数据
- **Implement backup strategies** for important data
  为重要数据**实施备份策略**
- **Use encryption** for sensitive data at rest
  对静态敏感数据**使用加密**

### 4. Access Control / 访问控制

- **Implement role-based access** if deploying for a team
  如果为团队部署，**实施基于角色的访问控制**
- **Monitor access logs** regularly
  定期**监控访问日志**
- **Revoke access** for departed team members
  **撤销**离职团队成员的访问权限

### 5. Dependency Management / 依赖管理

- **Keep dependencies up to date** to receive security patches
  **保持依赖项最新**以接收安全补丁
- **Review dependency changes** before updating
  更新前**审查依赖项更改**
- **Use virtual environments** to isolate dependencies
  **使用虚拟环境**隔离依赖项

### 6. Docker Security / Docker 安全

When using Docker:

使用 Docker 时：

- **Don't run as root** inside containers
  **不要在**容器内以 root 身份运行
- **Scan images** for vulnerabilities regularly
  定期**扫描镜像**以查找漏洞
- **Use specific version tags** instead of `latest`
  **使用特定版本标签**而不是 `latest`
- **Limit container resources** (CPU, memory)
  **限制容器资源**（CPU、内存）


## Known Security Considerations / 已知安全注意事项

### Cookie-Based Authentication / 基于 Cookie 的身份验证

This project uses Lanhu cookies for authentication. Be aware that:

本项目使用蓝湖 cookie 进行身份验证。请注意：

- Cookies can expire and need to be refreshed
  Cookie 可能会过期，需要刷新
- Cookies grant access to your Lanhu account
  Cookie 授予对您的蓝湖帐户的访问权限
- Anyone with your cookie can access your Lanhu data
  任何拥有您的 cookie 的人都可以访问您的蓝湖数据

### Task Type Messages / 任务类型消息

Task-type messages have security restrictions:

任务类型消息具有安全限制：

- ✅ **Allowed**: Read-only queries (code, database, tests)
  ✅ **允许**：只读查询（代码、数据库、测试）
- ❌ **Forbidden**: Code modifications, file deletions, command execution
  ❌ **禁止**：代码修改、文件删除、命令执行

### Data Storage / 数据存储

- Message data is stored locally in JSON files
  消息数据以 JSON 文件形式存储在本地
- No encryption is applied by default
  默认情况下不应用加密
- Consider implementing encryption for sensitive deployments
  考虑为敏感部署实施加密

## Security Updates / 安全更新

We will announce security updates through:

我们将通过以下方式宣布安全更新：

- GitHub Security Advisories
  GitHub 安全公告
- Release notes with `[SECURITY]` tag
  带有 `[SECURITY]` 标签的发布说明
- Email to reporters (for disclosed vulnerabilities)
  向报告者发送电子邮件（针对已披露的漏洞）

## Bug Bounty Program / 漏洞赏金计划

We currently do not have a formal bug bounty program. However, we deeply appreciate security researchers who responsibly disclose vulnerabilities and will:

我们目前没有正式的漏洞赏金计划。但是，我们非常感谢负责任地披露漏洞的安全研究人员，我们将：

- Publicly acknowledge your contribution (with your permission)
  公开承认您的贡献（经您许可）
- List you in our security hall of fame
  将您列入我们的安全名人堂
- Provide a detailed thank you in release notes
  在发布说明中提供详细的感谢

## Contact / 联系方式

For security-related questions or concerns:

有关安全相关的问题或疑虑：

- **Email**: youngjimmy8305@gmail.com
- **Subject line**: `[SECURITY] Your subject here`
  **主题行**：`[SECURITY] 您的主题`

For general questions, please use [GitHub Issues](https://github.com/MrDgbot/lanhu-mcp/issues).

对于一般问题，请使用 [GitHub Issues](https://github.com/MrDgbot/lanhu-mcp/issues)。

---

**Last Updated / 最后更新**: 2025-12-17

Thank you for helping keep Lanhu MCP Server and its users safe!

感谢您帮助保护 Lanhu MCP Server 及其用户的安全！

