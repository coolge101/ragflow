import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ApiErrorBanner } from "../components/ApiErrorBanner";
import {
  createManagedUser,
  deleteManagedUser,
  listManagedUsers,
  patchManagedUser,
  type ManagedUserRow,
} from "../api/tboxManagedUsers";
import { TBOX_PERMISSIONS, type TboxPermission } from "../constants/permissions";
import {
  TENANT_ASSIGNABLE_ROLES,
  isTenantAssignableRole,
  tenantRoleLabel,
  type TenantAssignableRole,
} from "../constants/tenantRoles";
import { useAuth } from "../context/AuthContext";
import { rsaEncryptPassword } from "../utils/rsaPassword";
import {
  canManageTenantUsers,
  canShowManagedUserActions,
  firstWorkspaceWhere,
  isMemberOfWorkspace,
  tenantIdsEqual,
  workspaceIdsFromMe,
} from "../utils/tenantWorkspace";

function normalizeRole(r: unknown): string {
  return String(r ?? "").trim().toLowerCase();
}

function formatMemberStatus(status: unknown): string {
  if (status === undefined || status === null || status === "") {
    return "—";
  }
  const s = String(status);
  if (s === "1") {
    return "有效";
  }
  if (s === "0") {
    return "无效";
  }
  return s;
}

function formatLastActive(row: ManagedUserRow): string {
  const ds = row.delta_seconds;
  if (ds != null && Number.isFinite(ds)) {
    const sec = Math.max(0, Math.floor(ds));
    if (sec < 60) {
      return `${sec} 秒内`;
    }
    if (sec < 3600) {
      return `${Math.floor(sec / 60)} 分钟前`;
    }
    if (sec < 86400) {
      return `${Math.floor(sec / 3600)} 小时前`;
    }
    return `${Math.floor(sec / 86400)} 天前`;
  }
  if (row.update_date) {
    return String(row.update_date);
  }
  return "—";
}

/** Align with backend `_single_role_permissions` bundles in `tbox_app.py`. */
function defaultPermissionsForRole(role: TenantAssignableRole): TboxPermission[] {
  if (role === "admin") {
    return [...TBOX_PERMISSIONS];
  }
  if (role === "invite") {
    return ["chat.use", "search.use", "doc.view"];
  }
  return TBOX_PERMISSIONS.filter((p) => p !== "kb.dangerous");
}

/** RAGFlow `UserTenantRole.OWNER` — team 的 `tenant_id` 通常不等于所有者 `user_id`，不能用 user_id===tenant_id 判断。 */
function isTenantOwnerMembership(row: ManagedUserRow): boolean {
  return normalizeRole(row.role) === "owner";
}

export function UsersPage() {
  const { me, permissions } = useAuth();
  const [workspaceId, setWorkspaceId] = useState("");
  const [members, setMembers] = useState<ManagedUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const [cEmail, setCEmail] = useState("");
  const [cNickname, setCNickname] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [cRole, setCRole] = useState<TenantAssignableRole>("normal");
  const [cCustomPerms, setCCustomPerms] = useState(false);
  const [cPerms, setCPerms] = useState<Set<TboxPermission>>(() => new Set(defaultPermissionsForRole("normal")));

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<ManagedUserRow | null>(null);
  const [eNickname, setENickname] = useState("");
  const [eEmail, setEEmail] = useState("");
  const [eRole, setERole] = useState<TenantAssignableRole>("normal");
  const [ePassword, setEPassword] = useState("");
  const [eCustom, setECustom] = useState(false);
  const [ePerms, setEPerms] = useState<Set<TboxPermission>>(new Set());

  const workspaceOptions = useMemo(() => workspaceIdsFromMe(me), [me]);
  const canManage = useMemo(
    () => canShowManagedUserActions(me, workspaceId, permissions),
    [me, workspaceId, permissions],
  );
  const canViewMembers = useMemo(() => isMemberOfWorkspace(me, workspaceId), [me, workspaceId]);

  useEffect(() => {
    setWorkspaceId((cur) => {
      const opts = workspaceOptions;
      const inList = (id: string) => Boolean(id) && opts.some((o) => tenantIdsEqual(o, id));
      if (cur && inList(cur)) {
        return cur;
      }
      const preferredManage = firstWorkspaceWhere(me, (wid) => canManageTenantUsers(me, wid));
      if (preferredManage && inList(preferredManage)) {
        return preferredManage;
      }
      if (me?.user_id) {
        const uid = String(me.user_id);
        if (inList(uid)) {
          return uid;
        }
      }
      return opts[0] ?? "";
    });
  }, [me, workspaceOptions]);

  useEffect(() => {
    setCPerms(new Set(defaultPermissionsForRole(cRole)));
  }, [cRole]);

  const load = useCallback(async () => {
    if (!workspaceId || !canViewMembers) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { res, body } = await listManagedUsers(workspaceId);
      if (res.status === 401 || body.code === 401) {
        setError("未授权");
        setMembers([]);
        return;
      }
      if (body.code !== 0) {
        setError(body.message || `错误码 ${body.code}`);
        setMembers([]);
        return;
      }
      setMembers(Array.isArray(body.data) ? body.data : []);
      setRowMsg({});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, canViewMembers]);

  useEffect(() => {
    if (!canViewMembers) {
      setMembers([]);
      setError(null);
      setLoading(false);
      return;
    }
    void load();
  }, [load, canViewMembers]);

  const onCreate = useCallback(async () => {
    if (!workspaceId || !canManage) {
      return;
    }
    const email = cEmail.trim();
    if (!email || !cPassword) {
      setFormMsg("请填写邮箱与初始密码");
      return;
    }
    setBusy("create");
    setFormMsg(null);
    try {
      const password = rsaEncryptPassword(cPassword);
      const body: Parameters<typeof createManagedUser>[1] = {
        email,
        nickname: cNickname.trim(),
        password,
        role: cRole,
      };
      if (cCustomPerms) {
        body.permissions = [...cPerms];
      }
      const { res, body: b } = await createManagedUser(workspaceId, body);
      if (res.status === 401 || b.code === 401) {
        setFormMsg("未授权");
        return;
      }
      if (b.code !== 0) {
        setFormMsg(b.message || `错误码 ${b.code}`);
        return;
      }
      setCEmail("");
      setCNickname("");
      setCPassword("");
      setCRole("normal");
      setCCustomPerms(false);
      setCPerms(new Set(defaultPermissionsForRole("normal")));
      await load();
    } catch (e) {
      setFormMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [workspaceId, canManage, cEmail, cNickname, cPassword, cRole, cCustomPerms, cPerms, load]);

  const openEdit = (row: ManagedUserRow) => {
    if (!canManage) {
      return;
    }
    if (isTenantOwnerMembership(row) && me?.user_id !== row.user_id) {
      return;
    }
    setEditRow(row);
    setENickname(String(row.nickname ?? ""));
    setEEmail(String(row.email ?? ""));
    if (isTenantOwnerMembership(row)) {
      setERole("admin");
      setECustom(false);
      setEPerms(new Set());
    } else {
      setERole((normalizeRole(row.role) as TenantAssignableRole) || "normal");
      const hasO = Boolean(row.uses_permission_override && row.permissions?.length);
      setECustom(hasO);
      setEPerms(new Set((row.permissions ?? []) as TboxPermission[]));
    }
    setEPassword("");
    setEditOpen(true);
  };

  const onSaveEdit = useCallback(async () => {
    if (!workspaceId || !editRow?.user_id) {
      return;
    }
    const uid = String(editRow.user_id);
    setBusy(`edit:${uid}`);
    setRowMsg((m) => ({ ...m, [uid]: "" }));
    try {
      const ownerSelf = editRow ? isTenantOwnerMembership(editRow) && me?.user_id === editRow.user_id : false;
      const payload: Record<string, unknown> = {
        nickname: eNickname.trim(),
        email: eEmail.trim(),
      };
      if (ePassword.trim()) {
        payload.password = rsaEncryptPassword(ePassword.trim());
      }
      if (!ownerSelf) {
        payload.role = eRole;
        if (eCustom) {
          payload.permissions = [...ePerms];
        } else {
          payload.permissions = null;
        }
      }
      const { res, body } = await patchManagedUser(workspaceId, uid, payload);
      if (res.status === 401 || body.code === 401) {
        setRowMsg((m) => ({ ...m, [uid]: "未授权" }));
        return;
      }
      if (body.code !== 0) {
        setRowMsg((m) => ({ ...m, [uid]: body.message || `错误码 ${body.code}` }));
        return;
      }
      setEditOpen(false);
      setEditRow(null);
      await load();
    } catch (e) {
      setRowMsg((m) => ({
        ...m,
        [uid]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setBusy(null);
    }
  }, [workspaceId, editRow, eNickname, eEmail, eRole, ePassword, eCustom, ePerms, load, me?.user_id]);

  const onInlineRoleChange = useCallback(
    async (row: ManagedUserRow, newRole: string) => {
      const uid = String(row.user_id ?? "");
      if (!workspaceId || !canManage || !uid || isTenantOwnerMembership(row)) {
        return;
      }
      if (!isTenantAssignableRole(newRole)) {
        return;
      }
      const cur = normalizeRole(row.role);
      if (cur === newRole) {
        return;
      }
      setBusy(`role:${uid}`);
      setRowMsg((m) => ({ ...m, [uid]: "" }));
      try {
        const { res, body } = await patchManagedUser(workspaceId, uid, { role: newRole });
        if (res.status === 401 || body.code === 401) {
          setRowMsg((m) => ({ ...m, [uid]: "未授权" }));
          return;
        }
        if (body.code !== 0) {
          setRowMsg((m) => ({ ...m, [uid]: body.message || `错误码 ${body.code}` }));
          return;
        }
        await load();
      } catch (e) {
        setRowMsg((m) => ({
          ...m,
          [uid]: e instanceof Error ? e.message : String(e),
        }));
      } finally {
        setBusy(null);
      }
    },
    [workspaceId, canManage, load],
  );

  const onRemove = useCallback(
    async (row: ManagedUserRow) => {
      const uid = String(row.user_id ?? "");
      if (!workspaceId || !uid) {
        return;
      }
      if (isTenantOwnerMembership(row)) {
        return;
      }
      if (!window.confirm(`确定将 ${row.email ?? uid} 从当前工作空间移除？`)) {
        return;
      }
      setBusy(`rm:${uid}`);
      setRowMsg((m) => ({ ...m, [uid]: "" }));
      try {
        const { res, body } = await deleteManagedUser(workspaceId, uid);
        if (res.status === 401 || body.code === 401) {
          setRowMsg((m) => ({ ...m, [uid]: "未授权" }));
          return;
        }
        if (body.code !== 0) {
          setRowMsg((m) => ({ ...m, [uid]: body.message || `错误码 ${body.code}` }));
          return;
        }
        await load();
      } catch (e) {
        setRowMsg((m) => ({
          ...m,
          [uid]: e instanceof Error ? e.message : String(e),
        }));
      } finally {
        setBusy(null);
      }
    },
    [workspaceId, load],
  );

  const togglePerm = (setFn: Dispatch<SetStateAction<Set<TboxPermission>>>, p: TboxPermission) => {
    setFn((prev) => {
      const n = new Set(prev);
      if (n.has(p)) {
        n.delete(p);
      } else {
        n.add(p);
      }
      return n;
    });
  };

  return (
    <div style={{ maxWidth: 1040 }}>
      <h1 style={{ marginTop: 0 }}>用户与角色</h1>
      <p className="muted">
        与后端 <code>user_tenant.role</code> 一致的四档角色在本表展示；<strong>管理员 / 所有者</strong>可改成员角色、增删成员、配置<strong>TBOX
        权限</strong>与<strong>RSA 初始登录密码</strong>（不写邀请邮件）。成员可查看列表并在本页离开团队。
      </p>
      <section
        style={{
          marginBottom: "1.25rem",
          padding: "0.85rem 1rem",
          background: "#f8fafc",
          border: "1px solid var(--border-subtle)",
          borderRadius: 6,
          fontSize: "0.88rem",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>空间内四档角色</div>
        <ul className="muted" style={{ margin: 0, paddingLeft: "1.15rem", lineHeight: 1.55 }}>
          <li>
            <strong>所有者（owner）</strong>：每个工作空间唯一；不可被移除或改为其它角色；可改自己的账号与密码。
          </li>
          <li>
            <strong>管理员（admin）</strong>：与所有者同级管理成员与权限（本页能力一致，具体 API 仍以服务端为准）。
          </li>
          <li>
            <strong>成员（normal）</strong>：默认业务角色；可在表格中改为「待接受」或管理员等。
          </li>
          <li>
            <strong>待接受（invite）</strong>：后端原用于邮件邀请态；此处仍可作为一档角色保存。若已由管理者设置密码并加入空间，用户可直接登录并在登录后自行改密。
          </li>
        </ul>
      </section>

      {workspaceOptions.length > 1 ? (
        <div style={{ marginBottom: "1rem" }}>
          <label className="muted" style={{ marginRight: 8 }}>
            当前工作空间
          </label>
          <select
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            style={{ minWidth: 220 }}
          >
            {workspaceOptions.map((id) => (
              <option key={id} value={id}>
                {id === me?.user_id ? `${id}（我的）` : id}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {error ? (
        <ApiErrorBanner
          onRetry={() => void load()}
          retryLabel="重试加载"
          retryDisabled={loading || !workspaceId || !canViewMembers}
          retryBusy={loading}
        >
          {error}
        </ApiErrorBanner>
      ) : null}

      {workspaceId && !canViewMembers ? (
        <p className="muted">当前账号无法访问该工作空间的成员列表。</p>
      ) : null}

      {workspaceId && canViewMembers ? (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            background: "#fff",
            border: "1px solid var(--border-subtle)",
            borderRadius: 4,
          }}
        >
          <h2 style={{ fontSize: "1.05rem", marginTop: 0, marginBottom: "0.65rem" }}>
            成员维护（新增用户、改角色、TBOX 权限、初始密码）
          </h2>
          {!canManage ? (
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.55 }}>
              您当前在本空间为<strong>普通成员</strong>：仅可查看下方成员表；增删用户与修改他人设置需<strong>空间所有者或管理员</strong>。若您应是管理员但仍看到本提示，请刷新页面或核对{" "}
              <code>/v1/tbox/me</code> 中该空间的 <code>role</code> 字段。
            </p>
          ) : null}
          {canManage ? (
            <>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>新增用户</div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", maxWidth: 720 }}>
            <label>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                邮箱
              </span>
              <input
                type="email"
                value={cEmail}
                onChange={(e) => setCEmail(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "0.35rem 0.5rem" }}
              />
            </label>
            <label>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                昵称
              </span>
              <input
                value={cNickname}
                onChange={(e) => setCNickname(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "0.35rem 0.5rem" }}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                初始密码（明文，提交前由浏览器 RSA 加密）
              </span>
              <input
                type="password"
                value={cPassword}
                onChange={(e) => setCPassword(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "0.35rem 0.5rem" }}
              />
            </label>
            <label>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                角色
              </span>
              <select
                value={cRole}
                onChange={(e) => setCRole(e.target.value as TenantAssignableRole)}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "0.35rem 0.5rem" }}
              >
                {TENANT_ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {tenantRoleLabel(r)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22 }}>
              <input type="checkbox" checked={cCustomPerms} onChange={(e) => setCCustomPerms(e.target.checked)} />
              <span>自定义 TBOX 权限（关闭则按角色默认）</span>
            </label>
          </div>
          {cCustomPerms ? (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                flexWrap: "wrap",
                gap: "0.35rem 0.75rem",
                fontSize: "0.88rem",
              }}
            >
              {TBOX_PERMISSIONS.map((p) => (
                <label key={p} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={cPerms.has(p)}
                    onChange={() => togglePerm(setCPerms, p)}
                  />
                  <code>{p}</code>
                </label>
              ))}
            </div>
          ) : null}
          <p style={{ marginTop: 12 }}>
            <button type="button" onClick={() => void onCreate()} disabled={busy === "create"}>
              {busy === "create" ? "提交中…" : "创建并加入空间"}
            </button>
          </p>
          {formMsg ? <p style={{ color: "#b91c1c", fontSize: "0.9rem" }}>{formMsg}</p> : null}
            </>
          ) : null}
        </div>
      ) : null}

      <p>
        <button type="button" onClick={() => void load()} disabled={loading || !workspaceId || !canViewMembers}>
          {loading ? "刷新中…" : "刷新"}
        </button>
      </p>

      {!workspaceId ? (
        <p className="muted">等待用户信息…</p>
      ) : !canViewMembers ? null : loading && members.length === 0 ? (
        <p className="muted">加载中…</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              background: "#fff",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.92rem",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border-subtle)", textAlign: "left" }}>
                <th style={{ padding: "0.5rem" }}>邮箱（登录账号）</th>
                <th style={{ padding: "0.5rem" }}>昵称</th>
                <th style={{ padding: "0.5rem" }}>空间角色</th>
                <th style={{ padding: "0.5rem" }}>TBOX 权限</th>
                <th style={{ padding: "0.5rem" }}>状态</th>
                <th style={{ padding: "0.5rem" }}>最近更新</th>
                <th style={{ padding: "0.5rem" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted" style={{ padding: "1rem" }}>
                    暂无成员
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const uid = String(m.user_id ?? "");
                  const owner = isTenantOwnerMembership(m);
                  const msg = rowMsg[uid];
                  return (
                    <tr
                      key={`${m.user_tenant_id ?? ""}-${uid}`}
                      style={{ borderBottom: "1px solid #eee", verticalAlign: "top" }}
                    >
                      <td style={{ padding: "0.5rem" }}>{m.email ?? "—"}</td>
                      <td style={{ padding: "0.5rem" }}>{m.nickname ?? "—"}</td>
                      <td style={{ padding: "0.5rem" }}>
                        {canManage && !owner ? (
                          <select
                            value={
                              isTenantAssignableRole(normalizeRole(m.role))
                                ? (normalizeRole(m.role) as TenantAssignableRole)
                                : "normal"
                            }
                            disabled={Boolean(busy)}
                            onChange={(e) => void onInlineRoleChange(m, e.target.value)}
                            style={{ maxWidth: "100%", padding: "0.25rem 0.35rem", fontSize: "0.88rem" }}
                          >
                            {TENANT_ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {tenantRoleLabel(r)}（{r}）
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span title={String(m.role ?? "")}>
                            {tenantRoleLabel(m.role)}
                            {m.role ? (
                              <span className="muted" style={{ fontSize: "0.78rem", marginLeft: 6 }}>
                                ({String(m.role).toLowerCase()})
                              </span>
                            ) : null}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.5rem", maxWidth: 280 }} className="muted">
                        {m.uses_permission_override && m.permissions?.length ? (
                          <span title={(m.permissions ?? []).join(", ")}>
                            自定义 {m.permissions?.length} 项
                            <br />
                            <code style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>
                              {(m.permissions ?? []).slice(0, 4).join(", ")}
                              {(m.permissions ?? []).length > 4 ? " …" : ""}
                            </code>
                          </span>
                        ) : (
                          <>按「{tenantRoleLabel(m.role)}」TBOX 默认</>
                        )}
                      </td>
                      <td style={{ padding: "0.5rem" }}>{formatMemberStatus(m.status)}</td>
                      <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>{formatLastActive(m)}</td>
                      <td style={{ padding: "0.5rem" }}>
                        {owner && me?.user_id !== uid ? (
                          <span className="muted">—</span>
                        ) : canManage ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <button type="button" onClick={() => openEdit(m)} disabled={Boolean(busy)}>
                              编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => void onRemove(m)}
                              disabled={Boolean(busy)}
                              style={{ color: "#b91c1c" }}
                            >
                              移出
                            </button>
                            {msg ? <span style={{ fontSize: "0.78rem", color: "#b91c1c" }}>{msg}</span> : null}
                          </div>
                        ) : me?.user_id === uid ? (
                          <button type="button" onClick={() => void onRemove(m)} disabled={Boolean(busy)}>
                            离开团队
                          </button>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {editOpen && editRow ? (
        <div
          role="dialog"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              maxWidth: 520,
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              padding: "1.25rem",
              borderRadius: 6,
              border: "1px solid var(--border-subtle)",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>编辑用户</h2>
            <div style={{ display: "grid", gap: 10 }}>
              <label>
                <span className="muted">昵称</span>
                <input
                  value={eNickname}
                  onChange={(e) => setENickname(e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "0.35rem" }}
                />
              </label>
              <label>
                <span className="muted">邮箱</span>
                <input
                  type="email"
                  value={eEmail}
                  onChange={(e) => setEEmail(e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "0.35rem" }}
                />
              </label>
              {editRow && !isTenantOwnerMembership(editRow) ? (
                <>
                  <label>
                    <span className="muted">角色</span>
                    <select
                      value={eRole}
                      onChange={(e) => {
                        const v = e.target.value as TenantAssignableRole;
                        setERole(v);
                        if (eCustom) {
                          setEPerms(new Set(defaultPermissionsForRole(v)));
                        }
                      }}
                      style={{ display: "block", width: "100%", marginTop: 4, padding: "0.35rem" }}
                    >
                      {TENANT_ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {tenantRoleLabel(r)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={eCustom} onChange={(e) => setECustom(e.target.checked)} />
                    <span>自定义权限</span>
                  </label>
                  {eCustom ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem 0.5rem", fontSize: "0.85rem" }}>
                      {TBOX_PERMISSIONS.map((p) => (
                        <label key={p} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={ePerms.has(p)}
                            onChange={() => togglePerm(setEPerms, p)}
                          />
                          <code>{p}</code>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                  工作空间所有者仅可修改自己的昵称、邮箱与密码。
                </p>
              )}
              <label>
                <span className="muted">新密码（留空不改，RSA 加密）</span>
                <input
                  type="password"
                  value={ePassword}
                  onChange={(e) => setEPassword(e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "0.35rem" }}
                />
              </label>
            </div>
            <p style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setEditOpen(false)}>
                取消
              </button>
              <button type="button" onClick={() => void onSaveEdit()} disabled={Boolean(busy)}>
                保存
              </button>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
