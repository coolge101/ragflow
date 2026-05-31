# TBOX Console（5180）镜像重建

**何时需要**：`web-tbox/` 有 UI 变更（Phase 16 Citation、Phase 17 检索高亮等）后，5180 上的静态页不会自动更新，须重建 **`ragflow-tbox-console:local`** 并 **force-recreate** 容器。

---

## 一键重建

```bash
cd <REPO>
bash scripts/tbox_rebuild_console.sh
```

步骤：

1. 宿主机 **`tbox_web_tbox_check.sh`**（typecheck + 12 tests + build）
2. **`docker compose … build tbox-console`**
3. **`--force-recreate tbox-console`**
4. 探测 **`http://127.0.0.1:5180/login`**
5. **`tbox_console_bundle_smoke.sh`** — 确认 bundle 含 Phase 16–17 特征串

跳过宿主机检查（仅验证 Docker 构建）：`TBOX_SKIP_WEB_TBOX_CHECK=1 bash scripts/tbox_rebuild_console.sh`

---

## 自动化 bundle 检查

```bash
bash scripts/tbox_console_bundle_smoke.sh
```

检测 5180 所服务 JS 是否含 Citation（`kind:"cite"`）、ChunkListPanel（`scrollIntoView`、引用 regex）等 minified marker。旧镜像在未重建前 **应 FAIL**。

---

## 手测（Phase 16–17）

重建后在 5180 验证：

| 路径 | 要点 |
|------|------|
| **`/`** | 绑定知识库的应用提问 → 点击 `[ID:n]` ↔ 右侧引用侧栏高亮 |
| **`/search`** | 检索有结果 → 点击条目高亮 |

通过后更新 **`docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md`** §5「Phase 16–17 UI」为 ☑。

一键辅助（先 bundle smoke，再打印清单）：

```bash
bash scripts/tbox_phase16_17_handtest.sh
# 手测完成后：
TBOX_PHASE16_17_HANDTEST_DONE=1 bash scripts/tbox_record_vm_acceptance.sh
```

---

## 相关

- 部署：`docs/TBOX_DEPLOY_RUNBOOK.md` §7.3
- VM 验收：`bash scripts/tbox_vm_production_acceptance.sh`
- 开发联调（5174，无需重建镜像）：`cd web-tbox && npm run dev`

**Plan:** `docs/superpowers/plans/2026-05-31-tbox-phase26-plan.md`
