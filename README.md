# DeepSeek Harness Portable

把官方 DeepSeek Harness 放进一个文件夹：解压、启动，带着工作区和数据一起走。

[下载最新版本](https://github.com/Tsungloong/deepseek-harness-portable/releases/latest) · [English](README.en.md) · [使用指南](docs/user-guide.md)

## 开始使用

**Windows x64**：解压后双击 `windows.bat`。

**Linux x64（glibc）**：
```sh
sh linux.sh
```

**macOS Apple Silicon**：
```sh
sh mac.sh
```

首次运行会下载经过校验的 Node.js 和锁定版本的官方 Harness。无需预装 Node，也不修改系统 PATH。
工作台启动后，使用终端中 **`dsh web:` 打印的完整地址**；官方程序会尝试打开浏览器。按 **Ctrl+C** 停止。

在工作台中配置模型和 API 地址，沿用官方配置方式。首次安装需要联网；之后可以离线启动界面，云端推理仍需网络与相应凭据。

## 常用命令

以下以 Windows 为例；Linux/macOS 换成 `sh linux.sh` / `sh mac.sh`。

| 命令 | 用途 |
|---|---|
| `windows.bat` | 启动 Web 工作台 |
| `windows.bat setup` | 安装锁定运行时；重复执行复用已有安装 |
| `windows.bat doctor` | 检查运行时、依赖、凭据状态和端口 |
| `windows.bat repair` | 重装 Node 与 Harness，保留 `data/` |
| `windows.bat reset` | 确认后删除数据与运行时，保留 `models/` 和源码 |
| `windows.bat portable-update` | 下载并更新便携启动器，下次启动安装对应运行时 |
| `windows.bat --version` | 查看便携版与 Harness 版本 |
| `windows.bat -- --help` | 查看官方 CLI 帮助 |
| `windows.bat -- <参数>` | 原样传给官方 CLI |

端口冲突时指定另一个端口：
```bat
windows.bat web --port 3081
```

启动时每 24 小时最多检查一次新版本，只提示，不在运行中替换文件。设置 `DSH_PORTABLE_NO_AUTO_UPDATE=1` 可关闭检查。
更新源可用 `portable-update --manifest URL` 指定，需同时提供完整源码归档及其 SHA-256。

## 数据放在哪里

```text
deepseek-harness-portable/
├── windows.bat / linux.sh / mac.sh
├── scripts/                 便携引导、版本清单与依赖锁
├── docs/                    使用指南和验证记录
├── models/                  用户自备文件，reset 保留
├── data/
│   ├── dsh-home/            会话、配置、插件与凭据
│   ├── agents-home/         共享 Agent / Skills 数据
│   ├── portable-home/       子进程的 HOME 与应用缓存配置
│   └── workspace/           默认工作区
├── runtimes/<平台>/         Node.js、Harness、pnpm
├── packages/                下载缓存
├── state/                   安装与运行状态
├── logs/
└── temp/                    安装暂存
```

默认 Web 工作区位于 `data/workspace/`。命令行透传保留调用时的当前目录，便于处理外部项目。
`models/` 只是保留目录，不会自动下载或启动本地模型。

## 换目录、换电脑

1. 按 Ctrl+C，等服务退出后再复制整个文件夹。
2. 在另一台相同系统与架构的机器运行对应入口。
3. 文件夹内部工作区的会话目录、日志头、工作区登记与投影缓存会一起迁移；修改前保存 `.portable-backup`。

**外部项目不会随便携文件夹复制。** 原来的路径会保留；如果新机器路径不同，请在工作台选择实际项目位置。
跨系统需要安装对应平台运行时；任意第三方插件及外部项目的跨系统兼容性未作保证。

Windows 建议 NTFS，Linux 使用支持 Unix 文件权限的文件系统（如 ext4），macOS 建议 APFS。预留至少 1 GiB；实际占用取决于官方依赖及插件。
官方 Harness 在 Unix 下要求凭据权限为 `0600`；Linux 的 exFAT 或未启用 metadata 的 WSL Windows 挂载不满足这个条件。WSL 请将整个文件夹放在 Linux 目录内。Windows exFAT 实盘及第三方插件仍未验证。

## 平台与验证

目标平台：Windows 10/11 x64、Linux x64（glibc）、macOS Apple Silicon。
不支持 Windows ARM64、Linux ARM64、Intel macOS 和 musl/Alpine。

本次实测范围和限制见 [验证记录](docs/validation.md)。macOS arm64 已通过 CI 运行时验证，尚未进行桌面交互走查。

## 数据与凭据

凭据以文件形式保存在 `data/`，便携层不额外加密。**持有文件夹可能获得其中账号或 API Key 的使用权。**
不要公开上传含 `data/` 的安装目录；借出前退出登录并清除个人数据。丢失设备后撤销或轮换相应凭据。

## 维护与许可

维护者：**Tsungloong**。便携引导层采用 Apache-2.0；官方 Harness 保持原样，适用其自身许可。
这是独立社区项目，DeepSeek 名称和标志归其权利人所有。第三方来源见 [NOTICE.md](NOTICE.md)。
