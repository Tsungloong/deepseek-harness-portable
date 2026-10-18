# 使用指南

便携层 1.0.2 固定官方 `@deepseek-ai/dsh@0.2.1-rc.2`、Node.js 24.21.0 与 pnpm 11.28.0。官方 Web 不打补丁，不增加前端外壳或后台服务；本文只说明便携层的操作。

## 启动和停止

Windows 双击 `windows.bat`；Linux 用 `sh linux.sh`，macOS 用 `sh mac.sh`。首次运行自动安装 Node 与官方依赖，后续复用。

浏览器使用启动日志 `dsh web:` 的完整 URL，它包含本次启动的访问令牌，不要分享给他人。按 Ctrl+C 停止，等终端退出后再移动目录或拔出设备。

## 工作区和模型

可以把需要随盘携带的项目放在 `data/workspace/`，它也是 Web 的启动目录。官方界面会恢复已登记的工作区；自动创建的默认工作区也可能位于 `data/portable-home/Documents/deepseek-harness/default-workspace/`，两处内部路径都参与迁移。外部项目不会被复制。
在官方工作台配置模型、API 地址和凭据；`models/` 只用于保留用户文件，不提供本地推理能力。

## 使用官方 CLI

```sh
sh linux.sh -- --help                    # 锁定版本的官方命令
sh linux.sh -- plugin --help             # 官方插件管理帮助
sh linux.sh web --no-open --port 3081    # 不自动打开浏览器，指定端口
```

`--` 后的参数原样传递，调用时的当前目录保持不变；Web 启动则以 `data/workspace/` 为当前目录，界面中的工作区由官方登记决定。

## 诊断、修复与重置

`doctor` 逐项报告 OK / WARN / FAIL：WARN 表示需注意的状态，FAIL 表示实际检查失败。
`repair` 重装 Node 与 Harness，不删除会话、设置或凭据。
`reset` 无需 Node，确认后删除 `data runtimes packages logs state temp`，保留 `models/`、源码与文档。删除不可撤销，请先备份需要的数据。

## 移动与备份

完整退出后复制整个文件夹；同系统、同架构无需重新下载核心运行时。文件夹内的路径自动迁移，改写前在文件旁保留 `.portable-backup`。
外部项目保持原路径，新机器上请在官方工作台选择真实位置。跨系统需重新运行对应入口安装平台依赖；第三方插件和外部项目另行确认兼容性。不要让两台机器同时写入同步中的 `data/`。

## 更新

`portable-update` 校验完整源码包，替换启动器、脚本、文档等源码内容与依赖锁，不覆盖 `data/`、`models/`、`runtimes/` 等受保护目录，也不改写 Git 历史。
下次启动按新清单安装对应运行时。自动检查只提示更新，每 24 小时最多一次，不阻止当前版本启动。

## 升级到 0.2.1-rc.2

当前锁定官方 0.2.1-rc.2；1.0.2 的运行时基线与依赖闭包不变。升级前停止工作台，备份 `data/`、旧源码与对应 `runtimes/`、`state/`，再更新源码并运行一次 `setup`。需要回退时，停止新版后一起恢复升级前的数据、源码、运行时和安装状态，避免用旧程序直接写入新版已处理的数据。

从 0.2.0-rc.2 升级时注意：

- **凭据优先级**：Web 中已保存的凭据优先于环境变量。改了环境变量却未切换账号或 API 地址时，检查官方设置中的已保存配置；headless 默认只使用环境变量或 `.env`。
- **Profile 覆盖**：官方 `--from-default-profile` 现在会删除并重建已有的同名 profile，不再是“存在就直接使用”；便携启动器未使用该选项。
- **插件要求**：插件兼容性优先按 `engines.dsh` 判断，能力要求由 `requirements` 声明。遇到拒绝加载应升级插件或核对声明，不绕过官方检查。
- **定时任务**：功能已并入 Web，旧实验性 schedule 组合包由官方迁移清理；不要为恢复入口重新安装旧包。

升级后的续聊与中文、空格路径搬迁已用官方旧版实际保存的会话验证，覆盖范围见[验证记录](validation.md)。官方变更详情见 [0.2.1-rc.1 汇总](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.1)与 [0.2.1-rc.2](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.2)。

## 下载代理

```sh
export HTTPS_PROXY=http://127.0.0.1:7890   # 仅当前终端生效
sh linux.sh setup
```

Windows 命令提示符使用 `set HTTPS_PROXY=http://127.0.0.1:7890`。Node 下载失败后会尝试清单中的镜像；npm 缓存与下载归档保存在便携目录。发布包不包含任何用户数据，分享前仍请检查自己的文件夹。
