# Windows 环境使用 free-code 指南 (含 OpenAI 兼容模式)

本指南介绍如何在 Windows 环境下配置并使用 `free-code`，包括如何直接对接第三方 OpenAI 格式的接口。

## 1. 基础环境安装

1. **安装 Bun (Windows 原生版)**:
   在 PowerShell 中运行：

   ```powershell
   powershell -c "irm bun.sh/install.ps1 | iex"
   ```

2. **安装依赖与编译**:
   在项目根目录下运行：

   ```powershell
   bun install
   bun run build:dev:full
   ```

   编译完成后会生成 `cli-dev.exe`。
   
   3 开发模式
   
   ```ini
   开发模式启动: bun run dev
   实时看日志: 加上 --debug-to-stderr 或 -D 参数
   更详细日志: 设置环境变量 CLAUDE_CODE_DEBUG_LOG_LEVEL=verbose
   
   即使没有在终端输出（即不带 -D 运行），系统也会自动将日志记录在本地文件中。你可以通过以下路径查看：
   
   实时查看最新日志: 在另一个终端运行 Get-Content -Path "$HOME\.claude\debug\latest" -Wait (PowerShell)
   日志保存目录: %USERPROFILE%\.claude\debug\
   ```
   
   

## 2. 配置与运行

### 方式 A：直接对接 Anthropic 官方或兼容接口

1. 设置 API Key: `$env:ANTHROPIC_API_KEY="your-key"`
2. 运行: `./cli-dev.exe`

### 方式 B：对接通用 OpenAI 格式接口 (免代理模式)

新版本已在系统中内置了协议转换层，您无需使用 LiteLLM 即可直接对接 gemini/openai 等第三方接口。

**配置示例 (PowerShell):**

```powershell
# 1. 开启内置 OpenAI 兼容模式
$env:CLAUDE_CODE_USE_OPENAI_COMPAT="1"

# 2. 设置您的第三方接口地址 (指向 /v1 目录即可)
$env:ANTHROPIC_BASE_URL="https://xxx.xxx.com"

# 3. 设置 API Key
$env:ANTHROPIC_API_KEY="AIzaSy..."

# 4. 指定模型名称
$env:ANTHROPIC_MODEL="gemini-2.5-flash"

# 5. 启动
./cli-dev.exe
```

## 3. 注意事项

- **地区限制**: 系统已解除了 api.anthropic.com 的强制网络前置检查，您可以在任何网络环境下启动。
- **自定义模型**: 如果您使用的是非 Claude 模型，请务必通过环境变量指定 `ANTHROPIC_MODEL`。
- **重新编译**: 如果您修改了源码，请务必重新运行 `bun run build:dev:full` 以生成最新的 `.exe` 文件。
