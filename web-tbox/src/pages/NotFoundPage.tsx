import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>页面不存在</h1>
      <p className="muted">路径未注册。</p>
      <p>
        <Link to="/">返回首页</Link>
      </p>
    </div>
  );
}
