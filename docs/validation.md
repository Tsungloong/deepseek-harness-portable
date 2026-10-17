# 验证记录

验证日期：2026-10-18。测试直接使用项目生产代码与锁定的官方运行时。

## 已执行

- **Windows x64 原生安装**：Node 下载、SHA-256 校验、解压、537 个 npm 包安装和原生依赖脚本完成。再次 repair 安装成功，数据文件保留。
- **Linux x64 / WSL2 安装**：无需系统 Node 完成引导，542 个 npm 包安装成功；CLI、koffi 与真实 PTY 执行通过。
- **单元与集成 fixture**：Linux 21 项通过；Windows 19 项通过、2 项 Unix 符号链接测试跳过。包括实际命令分发、透传参数、中文和空格路径、目录别名入口、移动后的 pnpm wrapper、安装失败回滚、四处会话路径迁移、多帧 zstd 内容保留、reset、完整源码更新、校验失败隔离及 24 小时检查间隔。
- **Windows Web**：未认证访问返回 401；使用启动令牌后返回 200 HTML。另通过原生 ConPTY 运行 `windows.bat`，发送控制台 Ctrl+C，确认批处理退出、端口释放、运行标记清除。
- **WSL2 / ext4 Web**：将已安装的运行时放到 Linux 文件系统后，连续两次启动通过认证 HTTP 200、原生 PTY 和停止释放端口检查；凭据文件实际权限为 0600，退出后无运行标记。
- **浏览器走查**：用 Chrome 实际打开 Windows 工作台，关闭首次说明，打开设置与模型页面，再返回主界面。无页面脚本异常，未发送模型请求。[工作台截图](screenshots/workbench.png)。
- **脚本**：POSIX shell 语法检查、Windows PowerShell 解析检查通过。
- **GitHub Actions**：[三平台安装与运行检查](https://github.com/Tsungloong/deepseek-harness-portable/actions/workflows/ci.yml)。Ubuntu 24.04 x64、Windows Server 2022 x64、macOS 14 arm64 均从清单安装依赖，完成单元测试及官方 CLI、原生 PTY、带认证 Web、停止释放端口的运行检查。

## 已发现的平台条件

默认 WSL Windows 挂载把凭据文件报告为 777，chmod 无法落实 0600，官方凭据插件因此拒绝后续启动。
Linux 应使用支持 Unix 权限的文件系统，WSL 应在 Linux 目录运行；便携层不修改官方权限检查。

## 未验证范围

外部模型推理、macOS 桌面交互、Windows exFAT 实盘、无开发工具的全新 Windows 系统，以及第三方插件的任意跨平台迁移。
CI 运行时检查不替代未执行的平台桌面交互和实际移动介质验证。
