## 改动说明

<!-- 说明改了什么、为什么改，以及用户可观察的行为变化。 -->

关联 Issue：<!-- Closes # -->

## 测试事实

<!-- 列出真实执行过的命令与结果，不要只写“测试通过”。例如： -->
<!-- .\runtimes\windows-x64\node\node.exe --test tests/*.test.mjs — 6 项通过 -->
<!-- node scripts/check.mjs — 通过 -->

## 检查清单

- [ ] 行为变更已同步更新 README / docs 与 CHANGELOG
- [ ] `node scripts/check.mjs` 通过
- [ ] 相关测试通过，且测试覆盖真实用户可见行为（未为内部防御分支新增测试）
- [ ] 未包含凭据、会话、日志、个人数据或本机绝对路径
- [ ] 提交信息符合 Conventional Commits（见 CONTRIBUTING.md）
- [ ] 涉及启动器或更新逻辑时，已在 Windows 上通过真实入口启动验证

## 备注

<!-- 升级影响、兼容性、回退方式等；没有可删除本节。 -->
