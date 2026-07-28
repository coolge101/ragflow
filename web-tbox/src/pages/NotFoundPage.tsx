import { Link, useNavigate } from "react-router-dom";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>页面不存在</h1>
      <p className="muted">路径未注册。</p>
      <p style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        <Link to="/">返回首页</Link>
        <button type="button" onClick={() => navigate(-1)} style={{ cursor: "pointer" }}>
          返回上一页
        </button>
      </p>
    </div>
  );
}
