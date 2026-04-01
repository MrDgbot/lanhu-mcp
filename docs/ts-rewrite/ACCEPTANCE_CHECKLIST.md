# 验收清单

## P0：基础可运行
- [ ] TS 服务可启动。
- [ ] MCP 工具全部注册成功。
- [ ] 配置项可从环境变量正确读取。
- [ ] 本地启动脚本与 Docker 启动方式一致。

## P1：设计稿基础链路
- [ ] `detailDetach` 链接可解析出 `tid/pid/image_id`。
- [ ] `GET /api/project/image` 能拿到单图详情。
- [ ] 能从详情拿到 `XDCover` 图片 URL。
- [ ] 能成功下载并保存设计稿图片。
- [ ] `lanhu_list_designs` 返回列表数量与 Python 一致。

## P1：设计稿深度分析
- [ ] `multi_info -> version_id` 正常。
- [ ] `store_schema_revise -> data_resource_url` 正常。
- [ ] XDJSON 转 HTML 正常。
- [ ] `layout_summary` 正常生成。
- [ ] `design_tokens` 正常生成。
- [ ] schema 失败时 fallback 生效。
- [ ] `lanhu_get_slices` 能返回切图 URL 与元数据。

## P1：原型页链路
- [ ] `lanhu_list_pages` 返回页面列表。
- [ ] 原型资源下载正常。
- [ ] 静态 HTML 文本提取正常。
- [ ] 样式摘要包含 `textColors`、`bgColors`、`fontSpecs`、`images`。
- [ ] `text_only` 模式正常。
- [ ] `full` 模式正常。
- [ ] 不依赖浏览器运行时。

## P2：外围一致性
- [ ] Docker 可以构建与运行。
- [ ] README 启动方式正确。
- [ ] 安装脚本不引用 Python 专属依赖。
- [ ] issue 模板、部署文档和实际行为一致。

## 对照样本建议
- 样本 1：真实 `detailDetach` 设计稿链接。
- 样本 2：至少一张可成功生成 schema HTML 的设计稿。
- 样本 3：至少一张只能走 Sketch fallback 的设计稿。
- 样本 4：至少一份 Axure 原型页文档。

## 通过标准
- P0 全通过。
- 所有 P1 项通过。
- P2 至少完成 Docker、README、脚本三项。
- 与 Python 对照时，不出现关键字段缺失。

## 不通过即阻塞上线
- 设计稿图片无法提取。
- `lanhu_analyze_designs` 无 HTML 或无 `layout_summary`。
- `lanhu_analyze_pages` 无页面文本或无样式摘要。
- 任一核心工具签名与现有客户端使用方式不兼容。
