import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { loginWithEmailPassword } from "../api/auth";
import { useAuth } from "../context/AuthContext";

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
          {error ? <p style={{ color: "#b91c1c", marginTop: 0 }}>{error}</p> : null}
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
