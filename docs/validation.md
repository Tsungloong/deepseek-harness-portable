# 验证记录

## 当前基线：便携层 1.0.2 / Harness 0.2.1-rc.2

验证日期：2026-10-19。1.0.2 只改仓库治理、工具链、测试组织与启动器精简；官方运行时基线与依赖闭包保持不变：`@deepseek-ai/dsh` 0.2.1-rc.2、Node.js 24.21.0、pnpm 11.28.0。`scripts/locks/` 与 `manifest.dependencyLock` 未变更，从 1.0.1 升级不会触发依赖重装。

### Windows x64 本机事实

- **版本**：`windows.bat --version` → `DeepSeek Harness Portable v1.0.2 / dsh 0.2.1-rc.2`。
- **诊断**：`windows.bat doctor` 共 10 项：8 OK、2 WARN、0 FAIL。WARN 为设计内两项：Windows ACL 未检查（Windows 无 Unix 权限位）；本机 3080 端口被外部进程占用（可用 `web --port` 换端口）。
- **真实运行**：`tests/runtime-smoke.mjs` 通过——官方 CLI `--help`、上游 projectKey 实现对照、koffi、真实 PTY；Web 未认证访问返回 401，启动令牌 URL 返回 200 HTML；停止后端口释放。
- **单元测试**：`runtimes\windows-x64\node\node.exe --test tests/*.test.mjs` → 11 项通过、0 失败、0 跳过。覆盖依赖锁校验和、默认启动的数据隔离与参数透传、损坏 Node 归档隔离、reset 经启动器保留 `models/` 与 `scripts/`、真实更新包的白名单替换、真实会话文件迁移。
- **仓库一致性**：`node scripts/check.mjs` 通过（版本与 CHANGELOG 段、依赖锁 SHA-256、相对 Markdown 链接、隐私与本机路径、`.mjs` / `.json` 语法）。

### 跨版本会话

同版本持久化续聊、中文与空格目录搬迁由 CI `sessions` job 覆盖。跨版本测试需在本地传入旧版 dsh 运行时目录：`node tests/session-upgrade-smoke.mjs <旧版 dsh 运行时目录>`；CI 只验证同版本持久化，不声称覆盖跨版本。1.0.1 基线曾实测官方 0.2.0-rc.2 保存的会话在 0.2.1-rc.2 上继续对话。

### 三平台 CI

Windows Server 2022 x64、Ubuntu 24.04 x64、macOS 14 arm64 的安装与运行检查由 GitHub Actions 执行，各平台跑真实安装与 `tests/runtime-smoke.mjs`。具体运行记录见 GitHub Release 页面，本文不复制 run URL。

### 验收限制

外部模型推理、新版 Search / Fetch API、第三方插件安装 / 更新 / 热重载、实际定时任务执行、macOS 桌面交互、Windows exFAT 实盘和无开发工具的全新 Windows 系统未验证；macOS 运行时结果以 CI 记录为准。

## 历史基线（1.0.1 / 1.0.0）

- 1.0.1：官方 Harness 由 0.2.0-rc.2 升级到 0.2.1-rc.2；Windows 20 项测试通过、2 项 Unix 符号链接测试跳过。浏览器走查（设置、模型、插件、自动化页面）与旧会话续聊、中文 / 空格目录搬迁通过，截图见[设置页](screenshots/rc2-settings.jpg)。
- 1.0.0：Windows / Linux 安装、官方 CLI、koffi、真实 PTY、Web 401/200 与停止释放端口通过，截图见[工作台](screenshots/workbench.png)。

## 平台条件

WSL 默认把 Windows 挂载上的凭据文件报告为 777，chmod 无法落实 0600，官方凭据插件因此拒绝启动。Linux 请使用支持 Unix 权限的文件系统，WSL 应在 Linux 目录运行；便携层不修改官方权限检查。
