# opencodeplus

## windows使用方法

使用 Windows PowerShell 原生编译

因为我们分析了您项目中的 `package.json` 和 `scripts/build.ts`，实际上并没有极度依赖 Linux 的特有宏，所以也可以尝试使用 Windows 版的 Bun 进行原生编译运行。

### **1. 安装 Bun for Windows** 

在 PowerShell 中运行以下命令安装原生版 Bun：

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"

```

### **2. 进入项目并安装依赖** 

在您当前的项目目录下(`f:\git\gitea20250909\freecodeplus`)，执行：

```powershell
# 安装依赖
bun install

```

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all my-2 rounded-lg bg-list-hover-subtle border border-gray-500/20"><div class="min-h-7 relative box-border flex flex-row items-center justify-between rounded-t border-b border-gray-500/20 px-2 py-0.5"><div class="font-sans text-sm text-ide-text-color opacity-60">powershell</div><div class="flex flex-row gap-2 justify-end"></div></div><div class="p-3"><div class="w-full h-full text-xs cursor-text"><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk8"># 安装依赖</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk1">bun install</span></div></div></div></div></div></div></pre>

### **3. 编译二进制版本** 

通过项目内置的脚本，构建包含所有实验性功能(dev:full)的可执行文件：

```
bun run build:dev:full
```



编译成功后，应该会在项目根目录生成名为 `cli-dev.exe` 的可执行产物。

### **4. 在 PowerShell 中运行** 

您可以设置环境变量并启动：

```powershell
# 设置环境变量
$env:ANTHROPIC_API_KEY="sk-ant-xxx"

# 或者设置使用其他平台，比如 OpenAI
# $env:CLAUDE_CODE_USE_OPENAI="1"

# 启动 (直接运行生成的二进制文件，或通过 dev 模式启动)
bun run dev

```

## 使用第三方接口

通常 `xxx.com/v1/chat/completions` 这种形式的第三方接口，大多数是由 `OneAPI` 或 `NewAPI` 等开源系统搭建的。这类代理系统通常内置了极为强大的兼容层： **它允许客户端发送基于 Anthropic 协议的内容给它，它会自动帮您转换成 OpenAI 格式发送给底层的模型** 。

所以您可以直接把 `free-code` 指向它，试试看是否自动生效。在您的 PowerShell 工具中运行：

```powershell
# 1. 拦截 Base_URL，只保留到域名（甚至不用加 /v1，根据情况加），SDK 后面会自动追加特定的路由（/v1/messages）
$env:ANTHROPIC_BASE_URL="https://xxx.xx.com"

# 2. 设置您的 Authorization Token
$env:ANTHROPIC_API_KEY="AIzaSyxxxxkWTF7Ee6LOsW0M"

# 3. 指定默认使用哪个模型来发送
$env:ANTHROPIC_MODEL="gemini-2.5-flash"
$env:ANTHROPIC_DEFAULT_OPUS_MODEL="gemini-2.5-flash"
$env:ANTHROPIC_DEFAULT_SONNET_MODEL="gemini-2.5-flash"
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL="gemini-2.5-flash"

# 开始调用编译好的程序（或者直接 bun run dev 运行源码）
bun run dev --model gemini-2.5-flash

```



> **效果说明** ：如果对方服务端兼容格式无盲区，那么这就已经调通了，可以直接开始使用
