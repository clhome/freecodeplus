# FreeCodePlus 开发任务清单

## 项目整体描述
FreeCodePlus 是一个基于 Bun 的 CLI 工作区，旨在提供类似 Claude Code 的功能。它使用 React (Ink) 构建命令行界面，并包含各种 AI 服务对接（如 OpenAI 适配器）。

## 开发规范描述
- 遵循 KISS 原则，保持代码简洁可维护。
- 使用 Bun 进行脚本运行和编译。
- 使用 TypeScript 进行开发。
- 日志系统通常依赖于特定环境变量或配置。

## 当前任务清单
- [x] 确定开发模式启动方式并开启日志输出 <!-- id: 0 -->
    - [x] 检查 `src/entrypoints/cli.tsx` 中的启动逻辑 <!-- id: 1 -->
    - [x] 查找项目中关于日志的配置（环境变量或命令行参数） <!-- id: 2 -->
    - [x] 验证 `bun run dev` 或其他命令是否能正常带日志启动 <!-- id: 3 -->
- [x] 修复启动报错 `Could not resolve authentication method` 和 JSON Parse error
    - [x] 修复 `.env` 文件格式，使其符合标准 dotenv 规范
    - [x] 优化 `sessionTitle.ts` 中的 `safeParseJSON` 调用，避免打印解析报错日志
- [x] 补充 OpenAI 兼容层工具调用（Tool Calls）逆向解析
    - [x] 在 `translateOpenAIStreamToAnthropic` 函数中增加状态追踪变量 `activeTools`
    - [x] 完善针对 `delta?.tool_calls` 的处理，触发 `tool_use` 对应的 `content_block_start`
    - [x] 完善针对 JSON 参数分块的处理，触发 `input_json_delta` 对应的 `content_block_delta`
    - [x] 在流末尾发送每个 activeTool 的 `content_block_stop` 并修正 `stop_reason` 为 `tool_use`
