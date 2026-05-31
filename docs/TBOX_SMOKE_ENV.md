# TBOX 冒烟环境变量

**模板**：[`scripts/tbox_smoke.env.example`](../scripts/tbox_smoke.env.example)

```bash
cp scripts/tbox_smoke.env.example scripts/tbox_smoke.env
# 或一键初始化：
bash scripts/tbox_setup_smoke_env.sh
# 编辑 scripts/tbox_smoke.env（已 gitignore，勿提交密码）
# example 内注释含 pre_release / 双账号 / Phase 16–17 变量说明
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

## 一键套件

```bash
bash scripts/tbox_smoke_suite.sh
# 跳过 5180 bundle：TBOX_SKIP_CONSOLE_BUNDLE_SMOKE=1 bash scripts/tbox_smoke_suite.sh
```

顺序：**console bundle** → **login** → **release smoke**（含 permissions）。

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
bash scripts/tbox_dual_account_check.sh   # 仅检查 env 是否已填
```

**须同时设置** EMAIL 与 PASSWORD；只填一项会报错。

**准生产强制双账号**（VM 验收 §3 D 全自动化）：

```bash
bash scripts/tbox_dual_account_check.sh
# scripts/tbox_smoke.env 已填 TBOX_SMOKE_NORMAL_* 后：
TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_vm_production_acceptance.sh
# 或一键套件：
TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_smoke_suite.sh
# 或单独 permissions：
TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_permissions_smoke.sh
```

未配置双账号时 `TBOX_REQUIRE_DUAL_ACCOUNT=1` 会失败并提示填写 `scripts/tbox_smoke.env`。

统一门禁脚本（suite / VM / pre_release 入口均会调用）：

```bash
bash scripts/tbox_require_dual_account_gate.sh   # 仅当 TBOX_REQUIRE_DUAL_ACCOUNT=1 时校验
```

### `TBOX_REQUIRE_DUAL_ACCOUNT` 矩阵

| 场景 | 命令 | 双账号 |
|------|------|--------|
| 默认 admin-only | `bash scripts/tbox_smoke_suite.sh` | 可选 |
| 准生产全量 | `TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_vm_production_acceptance.sh` | **必填** |
| 发版前（suite + §5） | `TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_pre_release.sh` | **必填** |
| S6 merge 后 | `TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_post_upstream_merge.sh` | **必填**（若设 env） |

初始化 env：`bash scripts/tbox_setup_smoke_env.sh` → 编辑 `TBOX_SMOKE_NORMAL_*` → `bash scripts/tbox_setup_smoke_env.sh --check-only`

---

## 发版门禁环境变量（与 pre_release 矩阵）

完整模式表：**[`TBOX_SMOKE_SCRIPTS.md`](./TBOX_SMOKE_SCRIPTS.md)** · 终端 **`bash scripts/tbox_pre_release.sh --help`**

| 变量 | 用途 | 默认 |
|------|------|------|
| `TBOX_PRE_RELEASE_VM` | `1` = pre_release 第 2 步跑 **VM 7 步**（非 suite） | `0` |
| `TBOX_SKIP_HOST_CHECK` | `1` = 跳过 web-tbox + scripts unit | `0` |
| `TBOX_REQUIRE_DUAL_ACCOUNT` | `1` = 须完整 `TBOX_SMOKE_NORMAL_*`（见上矩阵） | `0` |
| `TBOX_SKIP_WEB_TBOX_CHECK` | post-merge 内 pre_release 已跑 host 时使用 | `0` |
| `TBOX_SKIP_CONSOLE_BUNDLE_SMOKE` | 跳过 5180 bundle（仅 API 栈时） | `0` |
| `TBOX_PHASE16_17_CONFIRM` | `1` = 等同 archive **`--confirm`** | `0` |

典型组合：

```bash
bash scripts/tbox_pre_release.sh
TBOX_PRE_RELEASE_VM=1 bash scripts/tbox_pre_release.sh
TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_pre_release.sh
TBOX_SKIP_HOST_CHECK=1 TBOX_PRE_RELEASE_VM=1 bash scripts/tbox_pre_release.sh
```

浏览器 Phase 16–17 通过后：**`bash scripts/tbox_phase16_17_finish.sh --archive`**

当 `--run-suite` 或 `--run-smoke` 已执行对应检查时，不会重复跑相同 probe。

---

## 相关文档

- 脚本索引：**[`TBOX_SMOKE_SCRIPTS.md`](./TBOX_SMOKE_SCRIPTS.md)**（pre_release **`--help`**）
- 发版脚本链：**[`TBOX_DEPLOY_RUNBOOK.md`](./TBOX_DEPLOY_RUNBOOK.md)** §8.1
- [`TBOX_VM_PRODUCTION_ACCEPTANCE.md`](./TBOX_VM_PRODUCTION_ACCEPTANCE.md) §2
- Phase 18 plan：`docs/superpowers/plans/2026-05-30-tbox-phase18-plan.md`
