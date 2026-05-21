import { Link } from "react-router-dom";

export function ReviewDisabledPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", padding: "2rem 1.5rem" }}>
      <h1 style={{ marginTop: 0 }}>页面确认入口未开启</h1>
      <p className="muted" style={{ maxWidth: 560 }}>
        路由 <code>/review</code> 仅在<strong>开发模式</strong>默认开放，或在任意环境于 <code>.env</code> 设置{" "}
        <code>VITE_REVIEW_PAGES=1</code> 后重新构建。设置为 <code>0</code> 可在开发中关闭。
      </p>
      <p style={{ marginTop: "1.5rem" }}>
        <Link to="/login">去登录</Link>
        {" · "}
        <Link to="/">尝试首页</Link>
      </p>
    </div>
  );
}
