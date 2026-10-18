# 验证记录

## 当前基线：便携层 1.0.1 / Harness 0.2.1-rc.2

验证日期：2026-10-18。使用锁定的官方 npm 包，不修改 Web 或内核代码；Node.js 24.21.0、pnpm 11.28.0 保持不变。

- **安装和依赖锁**：Windows x64 安装 612 个包，WSL2 / Ubuntu 24.04 x64 安装 614 个包；均完成清单允许的原生依赖构建。版本、包 integrity、锁文件校验和及 lifecycle 白名单一致。
- **单元测试**：Windows 20 项通过、2 项 Unix 符号链接测试跳过；Linux 22 项全部通过。新增发布版本一致性与安装脚本白名单检查。
- **两平台运行时**：官方 CLI、上游 projectKey 编码对照、koffi、真实 PTY 均通过；Web 未认证返回 401，启动令牌访问返回 200，停止后端口释放。
- **真实跨版本会话与搬迁**：在隔离目录用官方 0.2.0-rc.2 完成并保存一次 AgentLoop；0.2.1-rc.2 按相同 session ID 续聊，发出的历史包含旧消息；再搬到含中文、空格的路径，调用生产迁移函数后继续相同会话，历史保留前两轮。Windows 和 Linux 均通过。响应来自本机回环 Messages SSE fixture，未调用外部模型。
- **Windows 浏览器走查**：通过真实 `windows.bat` 启动，在 Codex 内置浏览器打开旧会话副本、设置、模型、插件和自动化页面；设置显示 0.2.1-rc.2；内置终端执行 `echo PORTABLE_WEB_TERMINAL_OK` 并显示输出。浏览器错误日志为空。未配置新凭据、安装插件或创建自动化任务。
- **Windows 正式运行目录**：隔离验证后切换已安装运行时；`setup` 复用安装，`--version` 显示便携层 1.0.1 / dsh 0.2.1-rc.2；`doctor` 为 15 OK、1 WARN、0 FAIL，唯一 WARN 是未检查 Windows ACL。升级前保留数据、旧源码、安装状态及 Windows 旧运行时备份。
- **启动与停止**：原生控制台 Ctrl+C 后批处理退出，Web 端口释放、运行标记清除。
- **CI 覆盖**：三平台 workflow 已加入持久化续聊与搬迁 smoke；CI 默认以同一锁定版本生成并恢复会话，跨版本检查需额外传入旧运行时目录。发布要求同一提交在 Windows Server 2022 x64、Ubuntu 24.04 x64、macOS 14 arm64 全部通过；对应运行记录链接保存在 Release 说明中。本节其余项目记录本地验证结果。

浏览器证据：[版本与设置](screenshots/rc2-settings.jpg)。

回归入口：`npm test`、`npm run test:runtime`、`npm run test:upgrade -- <旧版 dsh 运行时目录>`。使用便携 Node 执行；跨版本测试要求新旧运行时属于当前平台。自动化续聊测试使用独立临时目录，不读取个人会话或模型凭据文件。

### 当前验收限制

外部模型推理、新版 Search / Fetch API、第三方插件安装/更新/热重载、实际定时任务执行、macOS 桌面交互、Windows exFAT 实盘和无开发工具的全新 Windows 系统均未验证。macOS 运行时结果以对应 Release 的 CI 记录为准。旧会话兼容性实测源版本为 0.2.0-rc.2。

## 历史基线：便携层 1.0.0 / Harness 0.2.0-rc.2

以下为升级前已记录的检查，不能替代新基线的平台验证。

### 已执行

- **Windows x64 原生安装**：Node 下载、SHA-256 校验、解压、537 个 npm 包安装和原生依赖脚本完成。再次 repair 安装成功，数据文件保留。
- **Linux x64 / WSL2 安装**：无需系统 Node 完成引导，542 个 npm 包安装成功；CLI、koffi 与真实 PTY 执行通过。
- **单元与集成 fixture**：Linux 21 项通过；Windows 19 项通过、2 项 Unix 符号链接测试跳过。包括实际命令分发、透传参数、中文和空格路径、目录别名入口、移动后的 pnpm wrapper、安装失败回滚、四处会话路径迁移、多帧 zstd 内容保留、reset、完整源码更新、校验失败隔离及 24 小时检查间隔。
- **Windows Web**：未认证访问返回 401；使用启动令牌后返回 200 HTML。另通过原生 ConPTY 运行 `windows.bat`，发送控制台 Ctrl+C，确认批处理退出、端口释放、运行标记清除。
- **WSL2 / ext4 Web**：将已安装的运行时放到 Linux 文件系统后，连续两次启动通过认证 HTTP 200、原生 PTY 和停止释放端口检查；凭据文件实际权限为 0600，退出后无运行标记。
- **浏览器走查**：用 Chrome 实际打开 Windows 工作台，关闭首次说明，打开设置与模型页面，再返回主界面。无页面脚本异常，未发送模型请求。[工作台截图](screenshots/workbench.png)。
- **脚本**：POSIX shell 语法检查、Windows PowerShell 解析检查通过。
- **GitHub Actions**：[三平台安装与运行检查](https://github.com/Tsungloong/deepseek-harness-portable/actions/workflows/ci.yml)。Ubuntu 24.04 x64、Windows Server 2022 x64、macOS 14 arm64 均从清单安装依赖，完成单元测试及官方 CLI、原生 PTY、带认证 Web、停止释放端口的运行检查。

## 平台条件

默认 WSL Windows 挂载把凭据文件报告为 777，chmod 无法落实 0600，官方凭据插件因此拒绝后续启动。
Linux 应使用支持 Unix 权限的文件系统，WSL 应在 Linux 目录运行；便携层不修改官方权限检查。
