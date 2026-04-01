# 关键接口兼容矩阵

## 目的
- 为 Python 与未来 TS 实现建立逐项对照标准。
- 明确哪些字段必须完全等价，哪些字段允许内部实现不同但语义一致。

## 工具级兼容要求

| 工具名 | 输入兼容要求 | 输出兼容要求 | 迁移优先级 |
|---|---|---|---|
| `lanhu_resolve_invite_link` | 接受蓝湖邀请链接 | 返回 `status`、`resolved_url`、`parsed_params` 或错误信息 | P1 |
| `lanhu_list_pages` | 接受带 `docId` 的原型链接 | 返回 `status`、`pages`、页面名/文件名/索引等基础信息 | P2 |
| `lanhu_analyze_pages` | 接受原型链接 + 页面名列表 | 返回文本内容、样式摘要、图片资源引用；不依赖截图 | P2 |
| `lanhu_list_designs` | 接受设计稿链接 | 返回设计图列表、名称、尺寸、URL、更新时间 | P1 |
| `lanhu_analyze_designs` | 接受设计稿链接 + 名称/索引 | 返回图片、HTML、layout summary、design tokens、资源映射 | P1 |
| `lanhu_get_slices` | 接受设计稿链接 + 精确名称 | 返回切图列表与下载地址 | P1 |

## 关键链路兼容矩阵

### 1. 单图提取链路
链路：
- `detailDetach URL`
- `parse_url`
- `/api/project/image`
- `result.url / data.url`
- `XDCoverPNGORG`

| 校验项 | Python 当前行为 | TS 目标行为 | 兼容级别 |
|---|---|---|---|
| URL 参数解析 | 从 fragment 中提取 `tid/pid/image_id` | 行为一致 | 必须一致 |
| 请求接口 | `GET /api/project/image` | 行为一致 | 必须一致 |
| 成功判定 | 接受 `0` / `00000` | 行为一致 | 必须一致 |
| 截图来源 | 使用接口返回 `url` 直链下载 | 行为一致 | 必须一致 |
| Cookie 依赖 | 请求详情接口需要 Cookie，CDN 图不需要 | 行为一致 | 必须一致 |

### 2. 设计稿分析链路
链路：
- `/api/project/images`
- 选中目标 design
- 下载封面图
- `multi_info -> version_id`
- `store_schema_revise -> data_resource_url`
- XDJSON 转 HTML
- Sketch JSON 补 token / fallback

| 校验项 | Python 当前行为 | TS 目标行为 | 兼容级别 |
|---|---|---|---|
| `design_names` 解析 | 支持 `all` / 序号 / 精确名称 / URL 中 image_id | 保持一致 | 必须一致 |
| 图片保存 | 下载为本地 PNG | 保持一致 | 建议一致 |
| HTML 输出 | 返回压缩后的 HTML | 保持一致 | 必须一致 |
| `layout_summary` | 独立输出布局摘要文本 | 保持一致 | 必须一致 |
| `design_tokens` | 从 Sketch JSON 提取 | 保持一致 | 必须一致 |
| fallback | schema 失败时走 Sketch fallback | 保持一致 | 必须一致 |

### 3. 原型页分析链路
链路：
- `/api/project/image`
- `multi_info`
- 项目 mapping
- HTML / page mapping 下载
- 本地静态 HTML 提取

| 校验项 | Python 当前行为 | TS 目标行为 | 兼容级别 |
|---|---|---|---|
| 页面列表来源 | sitemap + project info 组合 | 保持一致 | 必须一致 |
| 资源缓存 | 基于 `version_id` 复用缓存 | 保持一致 | 建议一致 |
| 文本提取 | 静态解析 HTML，输出 title/body 文本 | 保持一致 | 必须一致 |
| 样式摘要 | 输出 `textColors/bgColors/fontSpecs/images` | 保持一致 | 必须一致 |
| 输出模式 | `text_only` 与 `full` 都保留 | 保持一致 | 必须一致 |
| 截图 | 当前不返回浏览器截图 | 不引入截图 | 必须一致 |

## 数据结构兼容重点

### `lanhu_analyze_designs`
- `summary_text` 保留现有结构顺序：
  - 全局统计
  - 设计图列表说明
  - 每张图的 HTML
  - layout summary
  - 资源下载映射
  - layer tree
  - design tokens
- 图片输出顺序与设计图顺序一致。

### `lanhu_analyze_pages`
- 顶部 header 文案保留“模式 + 版本 + 数量”结构。
- `full` 模式下返回：
  - 头部说明
  - 文本 section
  - 每页文本与样式摘要
- 不依赖图像对象。

## 测试对照建议

| 测试类别 | Python 基线 | TS 对照 |
|---|---|---|
| URL 解析 | `parse_url` 样例集合 | 同样例断言 |
| CSS 数值格式化 | `_format_css_value` | 等价输出断言 |
| padding 合并 | `_merge_padding` | 等价输出断言 |
| 原型页静态提取 | `_extract_page_content_from_html` | 同输入 HTML 对照输出 |
| 单图提取 | 真实 `detailDetach` 链接 | 验证拿到同域名 XDCover URL |
| 设计稿 HTML | 真实 schema 样本 | 对照关键片段与映射数量 |

## 允许差异
- 内部模块命名与目录结构可以改变。
- HTTP 客户端、缓存实现方式可以改变。
- 文本中的少量空白、换行格式允许轻微差异。

## 不允许差异
- 关键字段名缺失。
- 设计稿 HTML 缺失。
- `layout_summary`、`design_tokens`、图片资源映射缺失。
- 原型页分析重新依赖浏览器截图。
- 设计稿单图链路不能从 `detailDetach` 拿到 `XDCover` 直链。
