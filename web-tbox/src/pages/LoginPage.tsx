import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { loginWithEmailPassword } from "../api/auth";
import { ApiErrorBanner } from "../components/ApiErrorBanner";
import { PageReviewPanel } from "../components/PageReviewPanel";
import { fetchTboxHealth } from "../api/tbox";
import { getAuthorizationHeader } from "../auth/session";
import { useAuth } from "../context/AuthContext";
import { reviewPagesEnabled } from "../review/reviewGate";
import { TBOX_API_CONTRACT_VERSION_EXPECTED } from "../constants/tboxContract";

/** Only same-origin relative paths; avoid open redirects and `/login` loops. */
function safeRedirectPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }
  const pathOnly = raw.split("?")[0] || "";
  if (pathOnly === "/login") {
    return "/";
  }
  return raw;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get("redirect");
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [healthHint, setHealthHint] = useState<{ tone: "muted" | "ok" | "warn" | "err"; text: string } | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);
  /** `pending` = localStorage 已有 token，正在 refresh 后决定跳转或留下登录 */
  const [sessionBootstrap, setSessionBootstrap] = useState<"pending" | "done">(() =>
    getAuthorizationHeader() ? "pending" : "done",
  );

  const runHealthCheck = useCallback(async () => {
    setHealthBusy(true);
    setHealthHint({ tone: "muted", text: "正在检测 TBOX API…" });
    try {
      const { res, body } = await fetchTboxHealth();
      if (!res.ok || body.code !== 0) {
        setHealthHint({
          tone: "err",
          text: "无法读取 TBOX 健康检查（请确认后端已启动，且开发时代理 /v1 指向正确地址，见 web-tbox/.env.example）。",
        });
        return;
      }
      const st = body.data?.status;
      const v = body.data?.tbox_api_contract_version;
      if (st !== "ok") {
        setHealthHint({ tone: "warn", text: `TBOX API 已响应，但 status 为 ${String(st)}（预期 ok）。` });
        return;
      }
      if (v != null && v !== TBOX_API_CONTRACT_VERSION_EXPECTED) {
        setHealthHint({
          tone: "warn",
          text: `后端契约版本为 ${v}，本控制台按 ${TBOX_API_CONTRACT_VERSION_EXPECTED} 构建，登录后部分能力可能不一致。`,
        });
        return;
      }
      setHealthHint({
        tone: "ok",
        text: `TBOX API 正常（契约 v${v ?? TBOX_API_CONTRACT_VERSION_EXPECTED}）。`,
      });
    } catch (e) {
      setHealthHint({
        tone: "err",
        text: `无法连接 TBOX API：${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setHealthBusy(false);
    }
  }, []);

  useEffect(() => {
    void runHealthCheck();
  }, [runHealthCheck]);

  useEffect(() => {
    if (sessionBootstrap !== "pending") {
      return;
    }
    let cancelled = false;
    (async () => {
      await refresh();
      if (cancelled) {
        return;
      }
      if (getAuthorizationHeader()) {
        navigate(safeRedirectPath(redirectTarget), { replace: true });
        return;
      }
      if (!cancelled) {
        setSessionBootstrap("done");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionBootstrap, refresh, navigate, redirectTarget]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await loginWithEmailPassword(email.trim(), password);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      await refresh();
      navigate(safeRedirectPath(redirectTarget), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const showHealthRetry = healthHint && (healthHint.tone === "err" || healthHint.tone === "warn");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <header
        style={{
          padding: "0.75rem 1.5rem",
          borderBottom: "1px solid var(--border-subtle)",
          background: "#fff",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--color-primary)" }}>TBOX</span>
        <span className="muted" style={{ marginLeft: 12, fontSize: "0.9rem" }}>
          知识库（单库）
        </span>
      </header>
      <main
        style={{
          maxWidth: 400,
          margin: "2rem auto",
          padding: "0 1rem",
        }}
      >
        <h1 style={{ marginTop: 0 }}>登录</h1>
        {sessionBootstrap === "pending" ? (
          <p className="muted" role="status">
            正在验证已有会话…
          </p>
        ) : null}
        {healthHint ? (
          <div style={{ marginBottom: "1rem" }}>
            <p
              style={{
                marginTop: 0,
                marginBottom: showHealthRetry ? "0.5rem" : 0,
                fontSize: "0.88rem",
                padding: "0.5rem 0.65rem",
                borderRadius: 6,
                background:
                  healthHint.tone === "ok"
                    ? "#ecfdf5"
                    : healthHint.tone === "warn"
                      ? "#fffbeb"
                      : healthHint.tone === "err"
                        ? "#fef2f2"
                        : "#f1f5f9",
                color:
                  healthHint.tone === "ok"
                    ? "#065f46"
                    : healthHint.tone === "warn"
                      ? "#92400e"
                      : healthHint.tone === "err"
                        ? "#991b1b"
                        : "var(--text-secondary)",
                border:
                  healthHint.tone === "ok"
                    ? "1px solid #a7f3d0"
                    : healthHint.tone === "warn"
                      ? "1px solid #fde68a"
                      : healthHint.tone === "err"
                        ? "1px solid #fecaca"
                        : "1px solid var(--border-subtle)",
              }}
            >
              {healthHint.text}
            </p>
            {showHealthRetry ? (
              <button type="button" disabled={healthBusy} onClick={() => void runHealthCheck()} style={{ cursor: healthBusy ? "wait" : "pointer" }}>
                {healthBusy ? "检测中…" : "重新检测 TBOX API"}
              </button>
            ) : null}
          </div>
        ) : null}
        {sessionBootstrap === "pending" ? null : (
          <>
            <p className="muted">
              使用您的 TBOX 账号（邮箱 + 密码）。请求 <code>POST /api/v1/auth/login</code>，密码经 RSA 公钥加密后提交，与本系统登录接口一致。
            </p>
            <form onSubmit={onSubmit} aria-busy={loading}>
              <label style={{ display: "block", marginBottom: "0.75rem" }}>
                <div style={{ marginBottom: 4 }}>邮箱</div>
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  required
                  disabled={loading}
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </label>
              <label style={{ display: "block", marginBottom: "1rem" }}>
                <div style={{ marginBottom: 4 }}>密码</div>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  required
                  disabled={loading}
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </label>
              {error ? (
                <ApiErrorBanner showLoginLink={false} style={{ marginBottom: "0.75rem" }}>
                  {error}
                </ApiErrorBanner>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                style={{ padding: "0.5rem 1.25rem", cursor: loading ? "wait" : "pointer" }}
              >
                {loading ? "登录中…" : "登录"}
              </button>
            </form>
            <p style={{ marginTop: "2rem", fontSize: "0.9rem" }} className="muted">
              登录成功后将进入主界面；无权限的菜单不会显示。
            </p>
            <p style={{ fontSize: "0.9rem" }}>
              <Link to="/">尝试进入首页</Link>（未登录将自动跳回此处）
            </p>
            {reviewPagesEnabled() ? (
              <p style={{ fontSize: "0.85rem" }} className="muted">
                动线评审：<Link to="/review">页面确认索引</Link>（每步独立 URL，本机勾选与备注）；右下角<strong>本页验收</strong>可在当前页直接勾选。
              </p>
            ) : null}
            {reviewPagesEnabled() ? <PageReviewPanel forcedStepId="login" /> : null}
          </>
        )}
      </main>
    </div>
  );
}
