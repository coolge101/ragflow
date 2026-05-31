# TBOX 冒烟环境变量

**模板**：[`scripts/tbox_smoke.env.example`](../scripts/tbox_smoke.env.example)

```bash
cp scripts/tbox_smoke.env.example scripts/tbox_smoke.env
# 编辑 scripts/tbox_smoke.env（已 gitignore，勿提交密码）
```

各 `scripts/tbox_*_smoke.sh` 启动时会自动 `source scripts/tbox_smoke.env`（若存在）。

---

## 常用变量

| 变量 | 用途 | 默认 |
|------|------|------|
| `TBOX_SMOKE_BASE_URL` | API 基址 | `http://127.0.0.1:9380` |
| `TBOX_CONSOLE_URL` | 5180 控制台（登录 smoke） | `http://127.0.0.1:5180` |
| `TBOX_LOGIN_EMAIL` / `TBOX_LOGIN_PASSWORD` | admin 登录 | `admin@ragflow.io` / `admin` |
| `TBOX_SMOKE_NORMAL_EMAIL` / `TBOX_SMOKE_NORMAL_PASSWORD` | **双账号权限**（§3 D） | 未设则只测 admin |
| `TBOX_SMOKE_RUNNER` | `docker` 时在容器内跑 Python | 检测到 ragflow-cpu 时自动 |
| `TBOX_SMOKE_DEEPSEEK_API_KEY` | G3 live chat 冒烟 | 可选 |

---

## 双账号权限（VM §3 D 自动化）

1. 在 **`/users`** 创建普通用户（或已有 `coolge101@163.com` 等）。
2. 写入 `scripts/tbox_smoke.env`：

```bash
TBOX_SMOKE_NORMAL_EMAIL=coolge101@163.com
TBOX_SMOKE_NORMAL_PASSWORD=你的密码
```

3. 运行：

```bash
bash scripts/tbox_permissions_smoke.sh
```

**须同时设置** EMAIL 与 PASSWORD；只填一项会报错。

---

## 相关文档

- [`TBOX_VM_PRODUCTION_ACCEPTANCE.md`](./TBOX_VM_PRODUCTION_ACCEPTANCE.md) §2
- [`TBOX_DEPLOY_RUNBOOK.md`](./TBOX_DEPLOY_RUNBOOK.md) §9（冒烟）
- Phase 18 plan：`docs/superpowers/plans/2026-05-30-tbox-phase18-plan.md`
