import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logoutServer } from "../api/auth";
import { clearSession } from "../auth/session";
import { hasPermission } from "../constants/permissions";
import type { TboxPermission } from "../constants/permissions";
import { useAuth } from "../context/AuthContext";

type NavItem = { to: string; label: string; perm: TboxPermission; end?: boolean };

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "对话", perm: "chat.use", end: true },
  { to: "/search", label: "检索", perm: "search.use" },
  { to: "/documents", label: "文档 / 知识库", perm: "doc.view" },
  { to: "/crawl", label: "采集", perm: "crawl.manage" },
  { to: "/kb", label: "知识库配置", perm: "kb.configure" },
  { to: "/audit", label: "审计", perm: "audit.read" },
  { to: "/users", label: "用户与角色", perm: "user.manage" },
];

export function MainLayout() {
  const navigate = useNavigate();
  const { me, permissions, loading, error, refresh } = useAuth();

  async function onLogout() {
    await logoutServer();
    clearSession();
    await refresh();
    navigate("/login", { replace: true });
  }

  const displayName = me?.nickname || me?.email || "已登录";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: "var(--sidebar-width)",
          flexShrink: 0,
          background: "#fff",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "1rem 1rem 0.75rem", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--color-primary)" }}>TBOX</div>
          <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
            TBOX 知识库（单库）
          </div>
        </div>
        <nav style={{ flex: 1, padding: "0.75rem 0" }}>
          {NAV_ITEMS.filter((item) => hasPermission(permissions, item.perm)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: "block",
                padding: "0.55rem 1rem",
                textDecoration: "none",
                color: isActive ? "var(--color-primary)" : "var(--text-primary)",
                fontWeight: isActive ? 600 : 400,
                background: isActive ? "rgba(37, 99, 235, 0.08)" : "transparent",
                borderLeft: isActive ? "3px solid var(--color-primary)" : "3px solid transparent",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        {error ? (
          <div style={{ padding: "0 1rem 0.5rem", fontSize: "0.8rem", color: "#b91c1c" }}>{error}</div>
        ) : null}
        {loading ? <div className="muted" style={{ padding: "0 1rem", fontSize: "0.8rem" }}>同步用户信息…</div> : null}
      </aside>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            height: 56,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0 1.25rem",
            background: "#fff",
            borderBottom: "1px solid var(--border-subtle)",
            gap: "1rem",
          }}
        >
          <span className="muted" style={{ fontSize: "0.9rem" }}>
            {displayName}
          </span>
          <button type="button" onClick={() => void onLogout()} style={{ cursor: "pointer" }}>
            退出
          </button>
        </header>
        <main style={{ flex: 1, padding: "1.25rem 1.5rem 2rem", overflow: "auto" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
