# 工作区与外围预留说明

## 目的
- 记录为 TS 重构提前完成的外围准备项。
- 明确哪些入口仍以 Python 为准，避免误把预留配置当成已切换方案。

## 当前状态

| 项目 | 状态 | 说明 |
|---|---|---|
| 默认服务入口 | 保持 Python | 继续使用 `python lanhu_mcp_server.py` |
| TS 骨架目录 | 已创建 | 当前直接落在仓库根目录的 `src/`、`tests-ts/`、`package.json` |
| 根目录 npm helper | 已启用 | 用于显示当前 TS 状态并代理根目录 npm 脚本 |
| Docker 默认行为 | 保持 Python | 当前不引入 Node 构建阶段 |

## 已落地文件
- `package.json`：根目录 TS 依赖与脚本。
- `tsconfig.json`：根目录 TS 编译配置。
- `src/`：第一版 TS 源码骨架。
- `scripts/ts-workspace-status.mjs`：显示当前 TS 状态并代理 `install/dev/build/test`。
- `.gitignore` / `.dockerignore`：补充 Node/TS 产物忽略规则。

## 约定目录
```text
lanhu-mcp/
├── lanhu_mcp_server.py
├── package.json
├── tsconfig.json
├── src/
├── scripts/
│   └── ts-workspace-status.mjs
├── docs/
│   └── ts-rewrite/
└── tests-ts/
```

## npm helper 用法
```bash
npm run ts:status
```

当前会输出 `ready` 状态，并提示默认运行栈仍是 Python。

可用命令：
- `npm run ts:install`
- `npm run ts:dev`
- `npm run ts:build`
- `npm run ts:test`

这些命令会代理到仓库根目录的 TS 脚本。

## Docker 与脚本策略
- 现有 `quickstart`、`easy-install`、`setup-env` 仍只服务 Python 入口。
- 在 TS 服务真正可运行前，不修改这些脚本的默认启动目标。
- Docker 镜像继续以 Python 运行时为默认行为，等切换阶段再接入 TS 构建。
