# 安全政策

## 支持的版本

只有最新发布版本接受安全修复，请先升级到最新的 1.0.x。

| 版本 | 支持 |
|---|---|
| 最新 1.0.x 发布版本 | ✅ |
| 更早版本（含 1.0.0 / 1.0.1） | ❌（仅建议升级） |

## 报告漏洞

请通过 GitHub Private Vulnerability Reporting 私密提交：

<https://github.com/Tsungloong/deepseek-harness-portable/security/advisories/new>

不要在公开 Issue、讨论或 PR 中披露未修复的安全问题。报告中请包含：

- 受影响的便携层版本（`windows.bat --version` 或 `sh linux.sh --version`）与平台；
- 复现步骤、影响范围与最小复现；
- 脱敏后的日志。**不要**附带 API Key、登录凭据、会话内容或完整的 `data/` 目录。

维护者会尽快确认、评估并修复；修复发布后可在 advisory 中致谢（经你同意）。

## 安全边界

本仓库只包含便携引导层：下载并校验官方运行时、隔离数据目录、启动与迁移，不修改官方 DeepSeek Harness 程序。

- 官方 `@deepseek-ai/dsh` 及其依赖（Web 服务、内核、插件系统等）的漏洞，请报告给 DeepSeek Harness 上游项目或 npm 包维护者。
- 本仓库的下载校验、更新流程、CI / 发布流水线与脚本问题，请按上面的私密渠道报告。

## 凭据与本地数据

- `data/` 保存会话、配置与凭据（以明文文件形式），便携层不额外加密；持有整个文件夹可能获得其中账号或 API Key 的使用权。
- 不要公开上传含 `data/` 的安装目录；借出或转交前退出登录、清理个人数据；丢失设备后立即撤销或轮换凭据。
- 报告问题时请先脱敏：删除真实令牌、API Key、会话文本与本机绝对路径。
