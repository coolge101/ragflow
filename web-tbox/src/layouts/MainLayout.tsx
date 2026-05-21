import { Fragment, useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { TboxMeResponse } from "../api/tbox";
import { logoutServer } from "../api/auth";
import { ApiErrorBanner } from "../components/ApiErrorBanner";
import { PageReviewPanel } from "../components/PageReviewPanel";
import { clearSession } from "../auth/session";
import { hasPermission } from "../constants/permissions";
import type { TboxPermission } from "../constants/permissions";
import { useAuth } from "../context/AuthContext";
import { useNarrowLayout } from "../hooks/useNarrowLayout";
import { canManageAnyWorkspaceTenant } from "../utils/tenantWorkspace";

type MeData = TboxMeResponse["data"] | null | undefined;

type NavItem = {
  to: string;
  label: string;
  perm: TboxPermission;
  end?: boolean;
  alsoIf?: (me: MeData) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "对话", perm: "chat.use", end: true },
  { to: "/search", label: "检索", perm: "search.use" },
  { to: "/documents", label: "文档 / 知识库", perm: "doc.view" },
  { to: "/crawl", label: "采集", perm: "crawl.manage" },
  { to: "/kb", label: "知识库配置", perm: "kb.configure" },
  { to: "/audit", label: "审计", perm: "audit.read" },
  {
    to: "/users",
    label: "用户与角色",
    perm: "user.manage",
    alsoIf: (m) => canManageAnyWorkspaceTenant(m),
  },
];

export function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const narrow = useNarrowLayout();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { me, permissions, loading, error, contractWarning, refresh } = useAuth();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!narrow || !mobileNavOpen) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [narrow, mobileNavOpen]);

  useEffect(() => {
    if (!narrow || !mobileNavOpen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [narrow, mobileNavOpen]);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  async function onLogout() {
    await logoutServer();
    clearSession();
    await refresh();
    navigate("/login", { replace: true });
  }

  const displayName = me?.nickname || me?.email || "已登录";

  const asideBase = {
    background: "#fff" as const,
    borderRight: "1px solid var(--border-subtle)",
    display: "flex" as const,
    flexDirection: "column" as const,
  };

  const asideStyle = narrow
    ? {
        ...asideBase,
        position: "fixed" as const,
        left: 0,
        top: 0,
        bottom: 0,
        width: "var(--sidebar-width)",
        maxWidth: "86vw",
        zIndex: 1001,
        transform: mobileNavOpen ? ("translateX(0)" as const) : ("translateX(-105%)" as const),
        transition: "transform 0.2s ease",
        boxShadow: mobileNavOpen ? "4px 0 24px rgba(15, 23, 42, 0.12)" : "none",
      }
    : {
        ...asideBase,
        width: "var(--sidebar-width)",
        flexShrink: 0,
      };

  return (
    <Fragment>
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {narrow && mobileNavOpen ? (
        <button
          type="button"
          aria-label="关闭菜单"
          onClick={closeMobileNav}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            border: "none",
            padding: 0,
            margin: 0,
            cursor: "pointer",
            background: "rgba(15, 23, 42, 0.35)",
          }}
        />
      ) : null}
      <aside style={asideStyle}>
        <div style={{ padding: "1rem 1rem 0.75rem", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--color-primary)" }}>TBOX</div>
              <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
                TBOX 知识库（单库）
              </div>
            </div>
            {narrow ? (
              <button type="button" aria-label="关闭侧栏" onClick={closeMobileNav} style={{ cursor: "pointer", flexShrink: 0 }}>
                ✕
              </button>
            ) : null}
          </div>
        </div>
        <nav id="tbox-sidebar-nav" style={{ flex: 1, padding: "0.75rem 0", overflowY: "auto" }}>
          {NAV_ITEMS.filter(
            (item) => hasPermission(permissions, item.perm) || (item.alsoIf?.(me) ?? false),
          ).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => {
                if (narrow) {
                  closeMobileNav();
                }
              }}
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
          <ApiErrorBanner
            style={{ margin: "0 0.75rem 0.5rem", padding: "0.45rem 0.65rem", fontSize: "0.8rem" }}
            onRetry={() => void refresh()}
            retryLabel="重试同步"
            retryDisabled={loading}
            retryBusy={loading}
          >
            {error}
          </ApiErrorBanner>
        ) : null}
        {contractWarning ? (
          <div
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.78rem",
              color: "#92400e",
              background: "#fffbeb",
              borderTop: "1px solid #fde68a",
              whiteSpace: "pre-wrap",
              lineHeight: 1.45,
            }}
          >
            {contractWarning}
          </div>
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
            justifyContent: "space-between",
            padding: "0 1rem 0 0.85rem",
            background: "#fff",
            borderBottom: "1px solid var(--border-subtle)",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            {narrow ? (
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-expanded={mobileNavOpen}
                aria-controls="tbox-sidebar-nav"
                style={{
                  cursor: "pointer",
                  padding: "0.4rem 0.65rem",
                  fontSize: "0.9rem",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                  background: "#fff",
                }}
              >
                菜单
              </button>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0 }}>
            <span className="muted" style={{ fontSize: "0.9rem", maxWidth: "42vw", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayName}
            </span>
            <button type="button" onClick={() => void onLogout()} style={{ cursor: "pointer" }}>
              退出
            </button>
          </div>
        </header>
        <main style={{ flex: 1, padding: narrow ? "1rem 1rem 1.5rem" : "1.25rem 1.5rem 2rem", overflow: "auto" }}>
          <Outlet />
        </main>
      </div>
    </div>
    <PageReviewPanel />
    </Fragment>
  );
}
