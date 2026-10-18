# DeepSeek Harness Portable

把官方 DeepSeek Harness 放进一个可移动文件夹：解压、启动，工作区与会话一起带走。
无需预装 Node.js，不修改系统 PATH；便携层只负责引导、目录隔离与迁移，官方 Web、插件与模型配置保持原样。

[![CI](https://github.com/Tsungloong/deepseek-harness-portable/actions/workflows/ci.yml/badge.svg)](https://github.com/Tsungloong/deepseek-harness-portable/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Tsungloong/deepseek-harness-portable)](https://github.com/Tsungloong/deepseek-harness-portable/releases/latest)
[![License](https://img.shields.io/github/license/Tsungloong/deepseek-harness-portable)](LICENSE)

[English](README.en.md) · [下载最新版本](https://github.com/Tsungloong/deepseek-harness-portable/releases/latest) · [使用指南](docs/user-guide.md)

当前版本：便携层 **1.0.2** / 官方 Harness **0.2.1-rc.2**（Node.js 24.21.0、pnpm 11.28.0）。

![工作台截图](docs/screenshots/workbench.png)

## 快速开始

- **Windows 10/11 x64**：解压后双击 `windows.bat`。
- **Linux x64（glibc）**：`sh linux.sh`
- **macOS Apple Silicon**：`sh mac.sh`

首次运行会下载并校验锁定版本的 Node.js 与官方 Harness，之后复用。启动后使用终端中 **`dsh web:` 打印的完整地址**（含访问令牌），按 **Ctrl+C** 停止。
首次安装需要联网；之后界面可离线启动，云端推理仍需网络与相应凭据。在工作台中配置模型和 API 地址，沿用官方方式。

## 常用命令

以下以 Windows 为例；Linux/macOS 换成 `sh linux.sh` / `sh mac.sh`。

| 命令 | 用途 |
|---|---|
| `windows.bat` | 启动 Web 工作台 |
| `windows.bat setup` | 安装锁定运行时；重复执行复用已有安装 |
| `windows.bat doctor` | 逐项诊断环境，报告 OK/WARN/FAIL（WARN 表示需注意） |
| `windows.bat repair` | 重装 Node 与 Harness，保留 `data/` |
| `windows.bat reset` | 确认后删除数据与运行时，保留 `models/` 和源码 |
| `windows.bat portable-update` | 校验并更新便携版源码；下次启动安装对应运行时 |
| `windows.bat --version` | 查看便携层与官方 Harness 版本 |
| `windows.bat -- <参数>` | 原样传给官方 CLI，如 `-- --help` |
| `windows.bat web --port 3081` | 指定端口启动 |

启动时每 24 小时最多检查一次更新，只提示、不在运行中替换文件；设置 `DSH_PORTABLE_NO_AUTO_UPDATE=1` 可关闭检查。
`windows.bat portable-update --manifest <清单地址>` 可指定更新源，清单需提供完整源码归档地址及其 SHA-256。

## 数据与迁移

```text
deepseek-harness-portable/
├── windows.bat / linux.sh / mac.sh
├── scripts/                 启动器、版本清单、依赖锁与仓库检查
├── tests/                   事实型测试（安装后的真实运行检查）
├── docs/                    使用指南、故障排查与验证记录
├── models/                  用户自备文件，reset 保留
├── data/
│   ├── dsh-home/            会话、配置、插件与凭据
│   ├── agents-home/         共享 Agent / Skills 数据
│   ├── portable-home/       子进程 HOME 与应用缓存配置
│   └── workspace/           Web 启动目录，可放便携项目
├── runtimes/<平台>/         Node.js、Harness、pnpm
├── packages/                下载缓存
├── state/                   安装与运行状态
├── logs/
└── temp/                    安装与更新暂存
```

- 完整退出（Ctrl+C 等待服务结束）后复制整个文件夹即可换目录或换电脑；内部会话路径、工作区登记与投影缓存会一起迁移，改写前保留 `.portable-backup`。
- 官方自动创建的默认工作区也可能位于 `data/portable-home/Documents/deepseek-harness/default-workspace/`，同样随文件夹携带。
- 外部项目不随便携文件夹复制，请在新机器的工作台选择实际位置；跨系统需要安装对应平台运行时。
- `models/` 只是保留目录，不提供本地推理能力。

## 平台与验证

支持 Windows 10/11 x64、Linux x64（glibc）、macOS Apple Silicon；不支持 Windows ARM64、Linux ARM64、Intel macOS 和 musl/Alpine。

Windows 建议 NTFS，Linux 使用支持 Unix 权限的文件系统（如 ext4），macOS 建议 APFS；至少预留 1 GiB。Unix 下官方要求凭据权限为 `0600`；WSL 请将整个文件夹放在 Linux 目录内，exFAT 与未启用 metadata 的 Windows 挂载不满足要求。

发布前要求 Windows、Linux、macOS 三平台 CI 全部通过，对应记录见 Release 说明。本地实测范围与未验证项见[验证记录](docs/validation.md)；macOS 桌面交互尚未走查。

## 安全

凭据以文件形式保存在 `data/`，便携层不额外加密。**持有整个文件夹可能获得其中账号或 API Key 的使用权。**
不要公开分享含 `data/` 的安装目录；借出前退出登录并清除个人数据，丢失设备后撤销或轮换凭据。漏洞报告方式见 [SECURITY.md](SECURITY.md)。

## 文档索引

- [使用指南](docs/user-guide.md)：启动与停止、工作区、CLI 透传、修复与重置、迁移、更新与升级说明。
- [故障排查](docs/troubleshooting.md)：安装、端口、安全软件、路径与迁移、更新失败。
- [验证记录](docs/validation.md)：实测范围、CI 覆盖与未验证项。
- [文档索引](docs/README.md) · [更新日志](CHANGELOG.md)

## 贡献与许可

维护者 **Tsungloong**。欢迎提交 Issue 与 PR，流程见[贡献指南](CONTRIBUTING.md)；参与前请阅读[行为准则](CODE_OF_CONDUCT.md)，安全问题按[安全政策](SECURITY.md)私密报告。

便携引导层采用 Apache-2.0；官方 Harness 原样安装，适用其自身许可。第三方组件与商标说明见 [NOTICE.md](NOTICE.md)。本项目是独立社区项目，DeepSeek 名称与标志归其权利人所有。
