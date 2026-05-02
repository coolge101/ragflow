import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { loginWithEmailPassword } from "../api/auth";
import { ApiErrorBanner } from "../components/ApiErrorBanner";
import { fetchTboxHealth } from "../api/tbox";
import { useAuth } from "../context/AuthContext";
import { TBOX_API_CONTRACT_VERSION_EXPECTED } from "../constants/tboxContract";

function safeRedirectPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }
  return raw;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [healthHint, setHealthHint] = useState<{ tone: "muted" | "ok" | "warn" | "err"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setHealthHint({ tone: "muted", text: "正在检测 TBOX API…" });
      try {
        const { res, body } = await fetchTboxHealth();
        if (cancelled) {
          return;
        }
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
        if (!cancelled) {
          setHealthHint({
            tone: "err",
            text: `无法连接 TBOX API：${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      const next = safeRedirectPath(searchParams.get("redirect"));
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

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
        {healthHint ? (
          <p
            style={{
              marginTop: 0,
              marginBottom: "1rem",
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
                      : "transparent",
              color:
                healthHint.tone === "ok"
                  ? "#065f46"
                  : healthHint.tone === "warn"
                    ? "#92400e"
                    : healthHint.tone === "err"
                      ? "#991b1b"
                      : "var(--text-muted)",
              border:
                healthHint.tone === "ok"
                  ? "1px solid #a7f3d0"
                  : healthHint.tone === "warn"
                    ? "1px solid #fde68a"
                    : healthHint.tone === "err"
                      ? "1px solid #fecaca"
                      : "none",
            }}
          >
            {healthHint.text}
          </p>
        ) : null}
        <p className="muted">
          使用与 RAGFlow 相同的账号（邮箱 + 密码）。请求 <code>POST /api/v1/auth/login</code>，与官方{" "}
          <code>web/</code> 加密方式一致。
        </p>
        <form onSubmit={onSubmit}>
          <label style={{ display: "block", marginBottom: "0.75rem" }}>
            <div style={{ marginBottom: 4 }}>邮箱</div>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
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
      </main>
    </div>
  );
}
