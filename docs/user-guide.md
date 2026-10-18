# 使用指南

## 启动和停止

解压后双击 `windows.bat`；Linux 使用 `sh linux.sh`，macOS 使用 `sh mac.sh`。
首次自动安装 Node 与官方依赖，后续复用。

浏览器使用启动日志 `dsh web:` 的完整 URL。它包含本次启动的访问令牌，不应分享给他人。
按 Ctrl+C 停止，等终端退出后再移动目录或拔出设备。

## 工作区和模型

可以将需要随盘携带的项目放在 `data/workspace/`，它也是 Web 的启动目录。
官方界面会恢复已登记的工作区；自动创建的默认工作区也可能位于 `data/portable-home/Documents/deepseek-harness/default-workspace/`。便携层保留官方选择，两处内部路径均参与迁移。
也可以在官方界面打开外部项目。外部项目源码不随便携文件夹复制。

在官方工作台配置模型、API 地址和凭据；便携层不更改这些入口。
`models/` 只用于保留用户文件，不提供本地推理能力。

## 使用官方 CLI

```sh
# 查看当前锁定版本的命令
sh linux.sh -- --help

# 查看官方插件管理帮助
sh linux.sh -- plugin --help

# 不自动打开浏览器，指定端口
sh linux.sh web --no-open --port 3081
```

`--` 后的参数原样传递，当前目录也保持不变。Web 启动则以 `data/workspace/` 为当前目录，界面中的工作区由官方登记决定。

## 修复与重置

`doctor` 的 WARN 表示缺少配置或需注意的状态，FAIL 表示实际检查失败。
`repair` 重装 Node 与 Harness，不删除会话、设置或凭据；失败时保留原 Harness 目录。

`reset` 无需 Node，确认后删除 `data runtimes packages logs state temp`。
`models/`、源码和文档保留。删除不可撤销，请先备份需要的数据。

## 移动与备份

完整退出后复制整个文件夹。同系统、同架构无需重新下载核心运行时。
文件夹内的路径自动迁移，修改文件旁保留 `.portable-backup`。
外部项目保持原路径；目标机器上路径不同，需要在工作台选择真实位置。

跨系统重新运行对应入口以安装平台依赖。第三方插件和外部项目另行确认兼容性。
不要让两台机器同时写入同步中的 `data/`。

## 更新

`portable-update` 校验完整源码包，更新启动器和依赖锁，不覆盖数据、模型或 Git 历史。
下次启动按新清单安装对应运行时。自动检查只提示更新，每 24 小时最多一次。

## 升级到 0.2.1-rc.2

便携层 1.0.1 固定使用官方 `@deepseek-ai/dsh@0.2.1-rc.2`，Node.js 24.21.0 和 pnpm 11.28.0 不变。官方 Web 不打补丁，不增加前端外壳或后台服务。

升级前停止工作台，备份 `data/`、旧源码与对应 `runtimes/`、`state/`；再更新源码并运行 `setup`。若需回退，停止新版后一起恢复升级前的数据、源码、运行时和安装状态，避免用旧程序直接写入新版已处理的数据。

从 0.2.0-rc.2 升级时注意：

- **凭据优先级**：Web 中已保存的凭据优先于环境变量。改了环境变量却未切换账号或 API 地址时，检查官方设置中的已保存配置。headless 默认只使用环境变量或 `.env`，不会自动取用 Web 保存的凭据。
- **Profile 覆盖**：官方 `--from-default-profile` 现在会删除并重建已有的同名 profile；它不再是“存在就直接使用”。便携启动器没有使用这个选项。
- **插件要求**：插件的 `engines.dsh` 优先于 `peerDependencies` 进行兼容性判断；能力要求由 `requirements` 声明。遇到拒绝加载应升级插件或核对声明，不绕过官方检查。
- **定时任务**：功能已并入 Web，旧实验性 schedule 组合包由官方迁移清理；不要为了恢复入口重新安装旧包。

本次已用官方旧版实际保存的会话验证升级续聊与中文、空格路径搬迁；覆盖范围及平台结果见[验证记录](validation.md)。官方变更详情见 [0.2.1-rc.1 汇总](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.1)与 [0.2.1-rc.2](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.2)。

## 下载代理

```sh
# 当前终端生效，不改系统配置
export HTTPS_PROXY=http://127.0.0.1:7890
sh linux.sh setup
```

Windows 命令提示符使用 `set HTTPS_PROXY=http://127.0.0.1:7890`。
Node 下载失败后会尝试清单中的镜像；npm 缓存和下载归档保存在便携目录。
发布包不包含任何用户数据，分享前也请检查自己的文件夹。
