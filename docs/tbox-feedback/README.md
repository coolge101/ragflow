# TBOX 使用反馈记录

在 **准生产 / 内网** 真实使用过程中发现的问题，请按下面模板记录，便于在 `~/ragflow` 修复后 push，再在 `/srv/tbox/ragflow` 更新部署。

## 记录模板

| 字段 | 说明 |
|------|------|
| 日期 / 操作者 | |
| 页面或 API | 如 `/documents`、`POST /api/v1/...` |
| 期望 | |
| 实际 | 截图 / 日志片段 |
| 环境 | `/srv/tbox/ragflow` 的 `git log -1`、相关容器日志 |
| 严重性 | blocker / major / minor |

## 建议文件名

`YYYY-MM-DD-<简短标题>.md`（本目录下新建即可，勿提交敏感密码）。

## 更新部署（修复后）

```bash
cd /srv/tbox/ragflow
git pull --ff-only
TBOX_BUILD_RAGFLOW=1 TBOX_CONSOLE=1 bash docker/tbox-compose-up.sh
```

## 相关文档

- [准生产 Spec](../superpowers/specs/2026-05-21-tbox-vm-quasi-production-design.md)
- [Implementation Plan](../superpowers/plans/2026-05-21-tbox-vm-quasi-production.md)
- [使用说明书](../TBOX_SYSTEM_USER_MANUAL.md)
