# 模块映射清单

## 映射原则
- 不再保留单文件实现，按“工具层 / 蓝湖接入层 / 转换层 / 共享层”拆分。
- 一条链路的请求、转换、返回格式分别落在不同模块，避免工具函数继续膨胀。
- 先按当前 Python 边界映射，再逐步细化内部实现。

## Python 到 TS 模块映射

| Python 位置 | 当前职责 | TS 目标文件 | 说明 |
|---|---|---|---|
| `lanhu_mcp_server.py` 顶部配置与常量 | 环境变量、常量、全局目录 | `src/config.ts` | 统一做 schema 校验与默认值 |
| `class LanhuExtractor` | 蓝湖 HTTP 访问与资源下载 | `src/lanhu/client.ts` + `src/lanhu/pages.ts` + `src/lanhu/designs.ts` | 按领域拆开，避免超大类 |
| `get_document_info()` | 单图/单文档详情 | `src/lanhu/client.ts` | 作为最基础详情 API |
| `get_pages_list()` | 原型页列表 | `src/lanhu/pages.ts` | 包含 sitemap 解析 |
| `download_resources()` | 原型页资源下载 | `src/lanhu/pages.ts` | 包括 HTML、mapping、静态资源落盘 |
| `_extract_page_content_from_html()` | 原型页静态提取 | `src/transform/page-static-extractor.ts` | 保留静态解析路线 |
| `_get_designs_internal()` | 设计稿列表 | `src/lanhu/designs.ts` | 作为设计稿领域基础 API |
| `get_design_schema_json()` | DDS schema 获取 | `src/lanhu/designs.ts` | 封装 multi_info + DDS |
| `get_sketch_json()` | Sketch JSON 获取 | `src/lanhu/designs.ts` | 与 schema 分开暴露 |
| `convert_lanhu_to_html()` | Schema 转 HTML/CSS | `src/transform/schema-to-html.ts` | 保留纯函数风格 |
| `_extract_layout_from_schema()` | 布局摘要提取 | `src/transform/layout-summary.ts` | 与 HTML 转换解耦 |
| `_extract_design_tokens()` | 设计 token 提取 | `src/transform/design-tokens.ts` | 独立维护可测试 |
| `convert_sketch_to_html()` | Sketch fallback HTML | `src/transform/sketch-to-html.ts` | 与 token/annotation 同领域 |
| `_extract_full_annotations_from_sketch()` | 详细标注提取 | `src/transform/sketch-to-html.ts` | 可拆为子函数 |
| `MessageStore` | 团队留言板 / 协作者记录 | `src/infra/message-store.ts` | 若继续保留则独立模块 |
| `normalize_role()` / `get_user_info()` | 角色归一化 / 上下文解析 | `src/shared/user-context.ts` | 工具层共用 |

## MCP 工具映射

| MCP 工具 | TS 目标文件 | 依赖模块 |
|---|---|---|
| `lanhu_resolve_invite_link` | `src/tools/resolve-invite.ts` | `lanhu/invite.ts`, `lanhu/client.ts` |
| `lanhu_list_pages` | `src/tools/list-pages.ts` | `lanhu/pages.ts`, `shared/user-context.ts` |
| `lanhu_analyze_pages` | `src/tools/analyze-pages.ts` | `lanhu/pages.ts`, `transform/page-static-extractor.ts`, `shared/user-context.ts` |
| `lanhu_list_designs` | `src/tools/list-designs.ts` | `lanhu/designs.ts`, `shared/user-context.ts` |
| `lanhu_analyze_designs` | `src/tools/analyze-designs.ts` | `lanhu/designs.ts`, `transform/schema-to-html.ts`, `transform/layout-summary.ts`, `transform/design-tokens.ts` |
| `lanhu_get_slices` | `src/tools/get-slices.ts` | `lanhu/designs.ts`, `shared/user-context.ts` |

## 建议类型定义

### 核心领域类型
- `LanhuUrlParams`
- `LanhuProjectImageInfo`
- `LanhuVersionInfo`
- `LanhuPagesListResult`
- `LanhuDesignListResult`
- `AnalyzePagesResult`
- `AnalyzeDesignsResult`
- `ImageUrlMapping`
- `LayoutSummaryLine`
- `DesignTokenEntry`

### 返回值分层
- API 原始响应类型：只用于 `lanhu/*`
- 领域规范类型：供 `tools/*` 和 `transform/*` 使用
- MCP 输出类型：只在 `tools/*` 中组装

## 文件级拆分建议

### `src/lanhu/client.ts`
- 创建 HTTP client
- 公共 headers
- URL 解析
- `getDocumentInfo`
- `getProjectMultiInfo`

### `src/lanhu/designs.ts`
- `listDesigns`
- `getDesignSchemaJson`
- `getSketchJson`
- `getSlices`
- 单图 XDCover 提取

### `src/lanhu/pages.ts`
- `listPages`
- `downloadResources`
- mapping 资源下载
- 页面缓存元数据处理

### `src/transform/page-static-extractor.ts`
- 内联样式解析
- 文本聚合
- 图片引用识别
- 样式摘要生成

### `src/transform/schema-to-html.ts`
- CSS 规则生成
- HTML 树生成
- 本地资源路径替换
- HTML 压缩

## 不建议直接迁移的内容
- Python 风格的大量全局常量与全局缓存写法。
- 将所有工具继续塞回一个 `server.ts`。
- 直接把 `LanhuExtractor` 原样翻译成一个超大类。

## 推荐落地顺序
1. `config.ts` + `shared/types.ts`
2. `lanhu/client.ts`
3. `lanhu/designs.ts`
4. `transform/schema-to-html.ts` / `layout-summary.ts`
5. `tools/list-designs.ts` / `tools/analyze-designs.ts`
6. `lanhu/pages.ts`
7. `transform/page-static-extractor.ts`
8. `tools/list-pages.ts` / `tools/analyze-pages.ts`
