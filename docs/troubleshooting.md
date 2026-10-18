# 故障排查

## 下载或安装失败

从终端运行 `windows.bat setup` / `sh linux.sh setup` 查看实际错误。
确认网络、可写目录和可用磁盘空间；建议预留至少 1 GiB。
代理可用 `HTTPS_PROXY` 设置。下载校验失败会生成 `.bad` 文件，不会使用它。

安装中断后，如果提示锁目录存在，先确认没有安装进程，再删除提示中的 `.node-lock` 或 `state/.setup-lock`，重新执行 setup。

## 浏览器打不开或端口占用

使用终端 `dsh web:` 打印的完整 URL，不要只输入 `127.0.0.1:3080`。
端口被占用时运行：
```bat
windows.bat web --port 3081
```
便携层不会关闭占用端口的其他程序。

## 程序文件损坏

运行 `repair` 重新安装运行时，保留 `data/`。
`reset` 会删除全部会话、设置和凭据，不作为普通修复的第一步。

## Windows 安全软件拦截

不要仅凭程序未签名就判定为误报。核对下载来源、具体检测名称和文件。
使用 Release 附带的 `checksums.txt` 核对下载包：
```powershell
Get-FileHash .\deepseek-harness-portable-1.0.1.zip -Algorithm SHA256
```
保留检测信息，通过仓库 Issue 反馈；确认来源与文件可信后再决定是否恢复被隔离文件。
不要为了运行而整体关闭安全防护。

## 中文、空格路径与 U 盘

入口使用相对位置定位，支持中文和空格。Unix 可用 `sh linux.sh`，不依赖启动脚本的可执行位。
运行时所在卷仍须允许执行 Node；noexec 卷请改用可执行的目录。

核心安装会省略 Node 包里的 CLI 链接，但第三方插件可能另有文件系统要求。
Windows 推荐 NTFS，Linux 推荐 ext4，macOS 推荐 APFS。
如果提示凭据权限无法设为 0600，Linux 请将整个文件夹移到支持 Unix 权限的文件系统。
WSL 默认 Windows 挂载可能将文件报告为 777，即使 chmod 也不改变；请使用 WSL 的 Linux 目录。
官方权限检查保持原样。Windows exFAT 实盘尚未验证。
运行时拔盘可能丢失尚未落盘的数据，务必先停止服务。

## 迁移后找不到项目

`data/workspace/` 内的项目随文件夹移动，首次启动会重写内部会话路径。
外部项目不会复制，也不会被替换成空目录。请把源码另行复制并在工作台选择真实位置。
迁移报错时保留原件与 `.portable-backup`，不要手工批量改写会话文件。

## 更新失败

手动更新错误会返回非零退出码。归档校验失败不会替换现有程序；
文件替换阶段出错会恢复已替换文件，备份留在 `temp/update-*/`。
网络异常不阻止当前已安装版本启动。稍后可重新运行 `portable-update`。
