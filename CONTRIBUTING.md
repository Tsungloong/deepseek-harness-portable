# 贡献指南

本仓库是 DeepSeek Harness 的便携引导层：下载并校验官方运行时、隔离数据目录、启动与迁移，不修改官方程序。
欢迎提交 Issue 与 PR。参与前请阅读[安全政策](SECURITY.md)与[行为准则](CODE_OF_CONDUCT.md)。

## 环境

测试与发布统一使用运行时基线：Node.js **24.21.0**、pnpm **11.28.0**、官方 Harness **0.2.1-rc.2**。
不要用系统里其他 Node 版本跑测试；先执行一次 setup 准备 `runtimes/`：

```bat
windows.bat setup
```

```sh
sh linux.sh setup
```

macOS 使用 `sh mac.sh setup`。已有安装可跳过，直接使用 `runtimes/` 中的锁定 Node。

## 常用命令

| 命令 | 用途 |
|---|---|
| `node --test tests/*.test.mjs` | 单元与集成测试 |
| `node tests/runtime-smoke.mjs` | 真实安装、官方 CLI、原生模块、Web 认证与端口释放 |
| `node tests/session-upgrade-smoke.mjs <旧版 dsh 运行时目录>` | 真实会话持久化、续聊与目录搬迁 |
| `node scripts/check.mjs` | 版本、依赖锁、文档链接、隐私与语法一致性检查 |
| `npm run release` | 打包发布附件（维护者使用） |

Windows 上统一用便携 Node 执行：

```powershell
.\runtimes\windows-x64\node\node.exe --test tests/*.test.mjs
.\runtimes\windows-x64\node\node.exe scripts/check.mjs
```

Linux / macOS：

```sh
runtimes/linux-x64/node/bin/node --test tests/*.test.mjs
runtimes/linux-x64/node/bin/node scripts/check.mjs
```

## 测试哲学：只测事实

测试只验证用户可观察的真实行为，而不是实现细节。可以写的事实例如：

- 真实安装后官方 CLI、koffi、node-pty、Web 401/200 与退出释放端口可用；
- 更新包校验失败不替换源码；正常更新保留 `data/`、`models/`、`runtimes/` 等受保护目录；
- 会话升级与中文 / 空格目录搬迁后历史与工作区登记正确；
- 版本、依赖锁与文档链接一致。

不要为内部防御分支、错误处理路径、私有函数边界或状态文件细节写测试（例如安装回滚中间状态、marker 恢复、版本比较边界、环境变量逐项断言）。这类测试锁死实现、重构即失效，也不证明用户可见行为。新增测试前先回答：它对应哪条真实用户可见的事实？回答不了就不要加。

测试使用临时目录与本地 fixture，不读取个人数据、真实凭据，不调用外部模型。临时目录名使用 ASCII。

## 代码风格

- UTF-8、LF 行尾、文件末尾一个换行；JSON 2 空格缩进。详见 `.editorconfig` 与 `.gitattributes`。
- 文档中英并用：中文为主，关键处英文括注；相对链接必须能解析。
- 只做与当前任务相关的改动，不新增无关文件、依赖或文档。

## 提交信息

采用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：`type(scope): summary`，例如 `fix(launcher): clean stale running marker`。
常用 type：`feat`、`fix`、`docs`、`test`、`build`、`ci`、`chore`、`refactor`。一次提交聚焦一件事。

## 提交前检查清单

- [ ] `node scripts/check.mjs` 通过
- [ ] 相关测试通过（见上），且没有为内部实现新增测试
- [ ] 行为变更同步更新 README / docs / CHANGELOG
- [ ] 未包含本机绝对路径、凭据、会话、日志、运行时目录或其他个人数据
- [ ] 涉及启动器或更新逻辑时，在 Windows 上通过真实入口启动验证

## 发布流程（维护者）

1. 改版本：`package.json` 与 `scripts/manifest.json` 的版本保持一致，并在 `CHANGELOG.md` 写入 `## [x.y.z] - YYYY-MM-DD` 段。
2. 合并到 `main`，等待三平台 CI（checks / runtime / sessions）全部通过。
3. 打 annotated tag，并在 tag 消息中粘贴 `CHANGELOG.md` 对应版本的正文：
   ```sh
   git tag -a v1.0.2
   git push origin v1.0.2
   ```
4. Release workflow 校验 tag 与版本一致、复用 CI、打包附件并创建 GitHub Release；发布说明直接取自 tag 正文。
5. 只有运行时基线或依赖闭包变化时才更新 `scripts/locks/` 与 `manifest.dependencyLock`；否则保持不动，避免用户升级时被迫重装依赖。

## 安全问题

不要公开披露漏洞，请按 [SECURITY.md](SECURITY.md) 的方式私密报告。
