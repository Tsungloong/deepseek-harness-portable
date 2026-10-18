# Changelog

本文件记录项目的所有重要变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/spec/v2.0.0.html)。

## [Unreleased]

### Fixed

- Release workflow 从 annotated tag 正文读取发布说明，不再回退到提交信息。

## [1.0.2] - 2026-10-19

仓库治理、CI / 发布自动化、启动器精简与测试重组。官方运行时基线与依赖闭包保持不变。

### Added

- 补齐仓库治理文件：`CONTRIBUTING.md`、`SECURITY.md`、`CODE_OF_CONDUCT.md`、`CHANGELOG.md`、`.editorconfig`。
- 添加 Issue 表单、PR 模板、`.github/CODEOWNERS` 与只更新 `github-actions` 的 Dependabot 配置。
- 新增 `scripts/check.mjs`：只读检查版本一致性、依赖锁 SHA-256、文档相对链接、隐私与语法。
- 新增 `.github/workflows/release.yml`：annotated tag `v*.*.*` 触发校验、复用 CI、打包并创建 GitHub Release。
- CI 按职责拆分：`checks`（版本 / 链接 / 单元测试）、`runtime`（三平台真实安装与运行检查）、`sessions`（会话升级与搬迁）。

### Changed

- 精简启动器（`scripts/portable.mjs`、`portable-update.mjs`、`portable.sh`、`portable.ps1`、`reset.sh`、`reset.bat`）：
  删除安装失败回滚与 `previous` 备份恢复逻辑、npm / npx wrapper、Node 版 reset、符号链接检查；
  `doctor` 删除安装路径、可写目录、凭据存在性、数据目录等重复检查项。
- 更新流程收敛为“`scripts` / `docs` / `tests` 目录整体替换 + 根文件白名单”，用户自建顶层文件与 `data/`、`models/`、`runtimes/` 等目录不覆盖；保留 SHA-256、tar 路径穿越与依赖锁校验和校验。
- 测试迁移到 `tests/` 并重写为事实型：只验证真实安装、官方 CLI、Web 认证、会话升级、文件迁移与更新包行为。
- 文档精简与索引化：README 瘦身，`docs/` 补充索引，使用指南、故障排查与验证记录对齐 1.0.2 事实。

### Removed

- 安装回滚与安装标记恢复逻辑、`node.previous` 备份恢复、不可达的 Node 版 `reset`、npm / npx wrapper。
- 针对实现细节与内部防御分支的测试（回滚、marker、版本比较边界、环境变量逐项断言等）。

### Fixed

- 强制结束进程后残留的运行标记会在下次启动时清理，不再误判为“正在运行”。
- `LICENSE` 恢复 Apache-2.0 标准全文（含 APPENDIX），修复 GitHub 将许可证识别为 `NOASSERTION`；版权信息保留在 [NOTICE.md](NOTICE.md)。

### 运行时基线（不变）

- 官方 Harness `@deepseek-ai/dsh` **0.2.1-rc.2**、Node.js **24.21.0**、pnpm **11.28.0**。
- `scripts/locks/` 与 `manifest.dependencyLock` 未变更：运行时依赖闭包不变，从 1.0.1 升级**不会触发重新安装**依赖包。

## [1.0.1] - 2026-10-18

### Changed

- 官方 Harness 基线由 0.2.0-rc.2 升级至 **0.2.1-rc.2**；锁定官方 npm 包与完整依赖，更新版本、integrity、依赖锁校验和与安装脚本白名单。
- Node.js 24.21.0、pnpm 11.28.0 保持不变。

### Added

- 真实会话持久化、恢复及中文 / 空格目录搬迁回归测试，并接入三平台 CI。
- 补充凭据优先级、profile 覆盖、插件兼容性与定时任务迁移说明。

### 验证

- Windows Server 2022 x64、Ubuntu 24.04 x64、macOS 14 arm64 三平台 CI 通过，覆盖官方 CLI、koffi、真实 PTY、Web 401/200 认证、停止释放端口与会话恢复 / 搬迁。

## [1.0.0] - 2026-10-17

### Added

- Windows x64、Linux x64（glibc）、macOS Apple Silicon 入口，无需预装 Node。
- 固定 Node.js 24.21.0、官方 Harness 0.2.0-rc.2 与依赖锁，不修改官方程序。
- 便携数据与工作区、内部会话路径迁移，以及 `doctor` / `repair` / `reset`。
- 完整源码更新校验；自动检查仅通知，保留用户数据与 `models/` 目录。

[Unreleased]: https://github.com/Tsungloong/deepseek-harness-portable/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/Tsungloong/deepseek-harness-portable/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/Tsungloong/deepseek-harness-portable/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Tsungloong/deepseek-harness-portable/releases/tag/v1.0.0
